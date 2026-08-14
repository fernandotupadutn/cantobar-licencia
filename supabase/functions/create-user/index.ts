// ============================================================
// Edge Function "create-user": alta de usuarios desde el servidor.
//
// Reemplaza el supabase.auth.signUp() del cliente (que deja de
// funcionar cuando desactivás el signup público) por
// auth.admin.createUser(), que usa la service_role key del
// servidor y funciona aunque "Allow new users to sign up" esté OFF.
//
// Autorización propia:
//   * Solo puede llamarla un usuario logueado con rol 'admin'.
//   * La service_role key NO sale del servidor (la inyecta Supabase).
//
// Deploy (desde la carpeta del proyecto):
//   SUPABASE_ACCESS_TOKEN=tu_token pnpm deploy:functions
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const ADMIN_BASE_URL = Deno.env.get('SUPABASE_URL');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// CORS: necesario para que el navegador pueda llamar la función desde
// la app (en dev: http://localhost:5173). Con "*" funciona para
// cualquier origen; si querés restringir, cambiá el origen acá.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, { status: 405 });
  }

  if (!ADMIN_BASE_URL || !SERVICE_ROLE_KEY) {
    return json({ error: 'Configuración de servidor incompleta' }, { status: 500 });
  }

  const supabaseAdmin = createClient(ADMIN_BASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) ¿Quién llama? Solo admins autenticados. El token viaja en el
  // header Authorization que envía supabase.functions.invoke().
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return json({ error: 'No autenticado' }, { status: 401 });
  }

  const { data: caller, error: callerError } = await supabaseAdmin.auth.getUser(token);
  if (callerError || !caller.user) {
    return json({ error: 'Sesión inválida' }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', caller.user.id)
    .maybeSingle();

  if (profileError || !profile || profile.role !== 'admin') {
    return json({ error: 'Requiere rol admin' }, { status: 403 });
  }

  // 2) Datos del alta.
  let body: { email?: string; password?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, { status: 400 });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const fullName = (body.full_name ?? '').trim();
  const role = body.role === 'admin' ? 'admin' : 'vendedor';

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return json({ error: 'Email inválido' }, { status: 400 });
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, { status: 400 });
  }

  // 3) Crear el usuario. email_confirm: true para que pueda entrar
  // enseguida con la contraseña provisoria (no hay flujo de
  // confirmación por mail en la app).
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    return json({ error: createError?.message ?? 'No se pudo crear el usuario' }, { status: 400 });
  }

  // 4) Asignar nombre y rol en profiles (el trigger ya creó la fila
  // con rol 'vendedor'; acá lo ajustamos).
  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ full_name: fullName, role })
    .eq('id', created.user.id);

  if (updateError) {
    return json({ error: updateError.message }, { status: 500 });
  }

  return json({ id: created.user.id, email: created.user.email, role });
}

Deno.serve(async (req) => {
  // Preflight del navegador (OPTIONS): debe responder 200 con los
  // headers CORS o el fetch se bloquea antes de llegar al POST.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    return await handleRequest(req);
  } catch (err) {
    // Nunca cerrar la conexión sin responder: cualquier error inesperado
    // devuelve un JSON 500 (el navegador lo muestra como error, no como
    // ERR_CONNECTION_CLOSED).
    console.error('create-user error:', err);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});
