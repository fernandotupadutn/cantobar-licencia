// ============================================================
// Edge Function "check-mp-order": consulta el estado de una order
// de Mercado Pago por su ID (para polling del POS).
//
// El Access Token es un SECRET del servidor (MERCADOPAGO_ACCESS_TOKEN).
//
// Uso: GET ?order_id=ORD...
// Devolución: { id, status, status_detail, external_reference }
//   status posible: created, canceled, accredited, refunded, expired
// ============================================================

const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...(init.headers ?? {}) },
  });
}

async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'GET') {
    return json({ error: 'Método no permitido' }, { status: 405 });
  }

  if (!MP_ACCESS_TOKEN) {
    return json({ error: 'Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor' }, { status: 500 });
  }

  const url = new URL(req.url);
  const orderId = url.searchParams.get('order_id');
  if (!orderId) {
    return json({ error: 'Falta order_id' }, { status: 400 });
  }

  let mpRes: Response;
  try {
    mpRes = await fetch(`https://api.mercadopago.com/v1/orders/${encodeURIComponent(orderId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });
  } catch (err) {
    console.error('check-mp-order: error llamando a MercadoPago', err);
    return json({ error: 'No se pudo contactar a MercadoPago' }, { status: 502 });
  }

  const mpData = await mpRes.json().catch(() => ({}));

  if (!mpRes.ok) {
    console.error('check-mp-order: MercadoPago respondió error', mpRes.status, mpData);
    return json({ error: 'MercadoPago no pudo resolver la order', status: mpRes.status }, { status: 502 });
  }

  const paymentId =
    mpData?.transactions?.payments?.[0]?.id ?? mpData?.transactions?.payments?.[0]?.payment_id ?? null;

  return json({
    id: mpData?.id,
    status: mpData?.status,
    status_detail: mpData?.status_detail,
    external_reference: mpData?.external_reference,
    payment_id: paymentId,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error('check-mp-order error:', err);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});
