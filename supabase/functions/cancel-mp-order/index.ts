// ============================================================
// Edge Function "cancel-mp-order": cancela una order de Mercado
// Pago pendiente (estado "created") para no dejar cobros colgados
// en la caja QR ni en la terminal.
//
// Uso: POST con { order_id }
// Devolución: { order_id, status }
// ============================================================

const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

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

  if (!MP_ACCESS_TOKEN) {
    return json({ error: 'Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor' }, { status: 500 });
  }

  let body: { order_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, { status: 400 });
  }

  const orderId = String(body?.order_id ?? '');
  if (!orderId) {
    return json({ error: 'Falta order_id' }, { status: 400 });
  }

  let mpRes: Response;
  try {
    mpRes = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
    });
  } catch (err) {
    console.error('cancel-mp-order: error llamando a MercadoPago', err);
    return json({ error: 'No se pudo contactar a MercadoPago' }, { status: 502 });
  }

  const mpData = await mpRes.json().catch(() => ({}));

  if (!mpRes.ok) {
    console.error('cancel-mp-order: MercadoPago respondió error', mpRes.status, mpData);
    return json({ error: 'MercadoPago no pudo cancelar la order', status: mpRes.status }, { status: 502 });
  }

  return json({
    order_id: mpData?.id,
    status: mpData?.status,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error('cancel-mp-order error:', err);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});