// ============================================================
// Edge Function "qz-sign": firma los requests de QZ Tray desde la
// versión WEB (como el escritorio hace con las claves en auth/).
//
// Es la manera de imprimir por QZ Tray en la web SIN que QZ muestre
// su diálogo de permiso en cada impresión.
//
// Cómo funciona:
//   - GET  -> devuelve el certificado público (QZ lo descarga una vez
//             por conexión vía qz.security.setCertificatePromise).
//   - POST { toSign } -> firma ese texto con la clave privada
//             (SHA512 + RSA PKCS1 v1.5) y devuelve { signature }.
//
// La clave privada es UN SECRET del servidor (QZ_PRIVATE_KEY_PEM).
// Nunca viaja al navegador: la firma la hace Supabase, no el cliente.
//
// Requisitos (UNA vez, para todo el negocio):
//   1. Generar un par de claves propio:
//      openssl req -x509 -newkey rsa:2048 -sha256 -keyout qz-sign.key \
//        -out qz-sign.crt -days 3650 -nodes -subj "/CN=CantoBar POS"
//   2. En CADA PC que imprima desde la web, copiar qz-sign.crt como:
//      C:\Program Files\QZ Tray\override.crt
//      (QZ Tray lee ese archivo como "raíz de confianza" además del
//      store de Windows. Alternativa: instalarlo como CA raíz).
//   3. Secrets de Supabase:
//      QZ_CERT_PEM         = contenido de qz-sign.crt
//      QZ_PRIVATE_KEY_PEM  = contenido de qz-sign.key
//   4. Deploy:
//      SUPABASE_ACCESS_TOKEN=... pnpm dlx supabase functions deploy qz-sign
//
// La clave privada DEBE ser RSA (pkcs8). Salió de un
// "openssl req ... -newkey rsa:2048 -nodes" que ya trae formato
// PKCS#8 ("BEGIN PRIVATE KEY"), que es el que importa crypto.subtle.
// ============================================================

const SIGN_ALG = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' } as const;
const MAX_TO_SIGN_LENGTH = 100_000;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

function pemToRaw(pem: string): ArrayBuffer {
  const base64 = pem
    .split('\n')
    .filter((line) => !line.startsWith('-----') && line.trim() !== '')
    .map((line) => line.trim())
    .join('');
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function sign(toSign: string, keyPem: string): Promise<string> {
  const key = await crypto.subtle.importKey('pkcs8', pemToRaw(keyPem), SIGN_ALG, false, ['sign']);
  const data = new TextEncoder().encode(toSign);
  const sig = await crypto.subtle.sign(SIGN_ALG, key, data);
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function handleRequest(req: Request): Promise<Response> {
  const cert = Deno.env.get('QZ_CERT_PEM');
  const key = Deno.env.get('QZ_PRIVATE_KEY_PEM');

  if (req.method === 'GET') {
    if (!cert) {
      return json({ error: 'Falta configurar QZ_CERT_PEM en el servidor' }, { status: 500 });
    }
    return json({ certificate: cert });
  }

  if (req.method === 'POST') {
    if (!key) {
      return json({ error: 'Falta configurar QZ_PRIVATE_KEY_PEM en el servidor' }, { status: 500 });
    }

    let body: { toSign?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'JSON inválido' }, { status: 400 });
    }

    const toSign = typeof body?.toSign === 'string' ? body.toSign : '';
    if (!toSign) {
      return json({ error: 'Falta toSign' }, { status: 400 });
    }
    if (toSign.length > MAX_TO_SIGN_LENGTH) {
      return json({ error: 'toSign demasiado largo' }, { status: 413 });
    }

    try {
      const signature = await sign(toSign, key);
      return json({ signature });
    } catch (err) {
      console.error('qz-sign: no se pudo firmar', err);
      return json({ error: 'No se pudo firmar (revisá QZ_PRIVATE_KEY_PEM)' }, { status: 500 });
    }
  }

  return json({ error: 'Método no permitido' }, { status: 405 });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error('qz-sign error:', err);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});