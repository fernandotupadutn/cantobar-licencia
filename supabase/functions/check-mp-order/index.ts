// ============================================================
// Edge Function "check-mp-order": consulta el estado de una order
// de Mercado Pago por su ID (para polling del POS).
//
// El Access Token es un SECRET del servidor (MERCADOPAGO_ACCESS_TOKEN).
//
// Uso: GET  ?order_id=ORD...   (o POST con body { order_id })
// Devolución: { id, status, status_detail, external_reference,
//               payment_id, payment_status, payment_status_detail }
//
// Estados (order / transacción):
//   - Pagado: order status = "processed" (status_detail "processed") y/o
//     transacción status "processed" / status_detail "accredited".
//   - Expirada: status "expired". Cancelada: "canceled".
// ============================================================

const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');

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

async function handleRequest(req: Request): Promise<Response> {
  if (!MP_ACCESS_TOKEN) {
    return json({ error: 'Falta configurar MERCADOPAGO_ACCESS_TOKEN en el servidor' }, { status: 500 });
  }

  let orderId: string | null = null;
  if (req.method === 'GET') {
    orderId = new URL(req.url).searchParams.get('order_id');
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      orderId = typeof body?.order_id === 'string' ? body.order_id : null;
    } catch {
      return json({ error: 'JSON inválido' }, { status: 400 });
    }
  } else {
    return json({ error: 'Método no permitido' }, { status: 405 });
  }

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

  const payment = mpData?.transactions?.payments?.[0];
  const paymentId = payment?.id ?? payment?.payment_id ?? null;

  return json({
    id: mpData?.id,
    status: mpData?.status,
    status_detail: mpData?.status_detail,
    external_reference: mpData?.external_reference,
    payment_id: paymentId,
    payment_status: payment?.status ?? null,
    payment_status_detail: payment?.status_detail ?? null,
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
