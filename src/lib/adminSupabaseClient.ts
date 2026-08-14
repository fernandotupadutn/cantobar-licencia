import { createClient } from '@supabase/supabase-js';

// ============================================================
// Cliente de Supabase para la base de datos CENTRAL de licencias.
//
// Es un cliente totalmente independiente del de `supabaseClient.ts`
// (que apunta a la base propia de este cantobar). Nunca se mezclan:
// este cliente solo se usa para consultar el estado de suscripción
// en la tabla `projects` de tu panel de administración.
// ============================================================

const adminSupabaseUrl = import.meta.env.VITE_ADMIN_SUPABASE_URL as string;
const adminSupabaseAnonKey = import.meta.env.VITE_ADMIN_SUPABASE_ANON_KEY as string;

if (!adminSupabaseUrl || !adminSupabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'Faltan las variables VITE_ADMIN_SUPABASE_URL / VITE_ADMIN_SUPABASE_ANON_KEY. ' +
      'Sin ellas, SubscriptionGuard no va a poder validar la licencia.'
  );
}

export const adminSupabase = createClient(adminSupabaseUrl, adminSupabaseAnonKey, {
  auth: {
    // Este cliente solo hace lecturas anónimas a `projects`, no maneja
    // sesión de usuario propia. Evitamos que persista tokens en
    // localStorage y así no interfiere para nada con la sesión de
    // auth del cantobar (que usa su propio Supabase y su propio storage).
    persistSession: false,
    autoRefreshToken: false,
  },
});
