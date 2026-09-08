// ============================================================
// Edge Function "create-mp-order": crea una order de pago en
// Mercado Pago (Orders API, type: "qr", modo híbrido) y devuelve
// el `qr_data` para que el POS renderice el código QR en pantalla
// (producto "Código QR" de Mercado Pago). El comprador lo escanea
// con su app de Mercado Pago y paga el monto exacto de la order.
//
// En modo HÍBRIDO la order queda vinculada al QR estático de la
// caja (el que se imprime o se pega en la barra) Y se genera un QR
// dinámico único. Si el pago se realiza con cualquiera de los dos,
// el otro queda automáticamente inhabilitado (sin cobro doble).
//
// El Access Token y la caja QR son SECRETS del servidor:
//   MERCADOPAGO_ACCESS_TOKEN – Access Token de producción de MP.
//   MERCADOPAGO_QR_POS_ID    – external_id de la caja QR creada vía
//                              POST /v2/pos (p.ej. CANTOBARQR01).
// Nunca se exponen al cliente.
//
// Cómo funciona:
//   1. El POS llama con { items, total_amount, external_reference }.
//   2. Se crea una order type "qr" (mode "hybrid") vinculada a la
//      caja QR. MP genera un código exclusivo para esta order y
//      habilita el QR estático de la caja para la misma order.
//   3. Se devuelve { order_id, expiration_time, qr_data }. El POS
//      muestra el QR ("qr_data") y hace polling con check-mp-order
//      hasta que el pago se acredite.
//
// Deploy:
//   SUPABASE_ACCESS_TOKEN=... pnpm dlx supabase functions deploy create-mp-order
// ============================================================

const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
const MP_QR_POS_ID = Deno.env.get('MERCADOPAGO_QR_POS_ID');

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
  if (!MP_QR_POS_ID) {
    return json({ error: 'Falta configurar MERCADOPAGO_QR_POS_ID en el servidor' }, { status: 500 });
  }

  let body: { items?: { title: string; unit_price: number; quantity: number }[]; total_amount?: number; external_reference?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'JSON inválido' }, { status: 400 });
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const total = Number(body.total_amount);
  const externalReference = String(body.external_reference ?? '');

  if (items.length === 0 || !Number.isFinite(total) || total <= 0) {
    return json({ error: 'Carrito vacío o monto inválido' }, { status: 400 });
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(externalReference)) {
    return json({ error: 'external_reference inválida (máx 64 chars, solo letras/números/_/-)' }, { status: 400 });
  }

  const mpPayload: Record<string, unknown> = {
    type: 'qr',
    total_amount: total.toFixed(2),
    description: 'CantoBar - Venta en local',
    external_reference: externalReference,
    // 15 min de validez: es el default de MP para Código QR y alcanza
    // de sobra para que el comprador escanee y pague.
    expiration_time: 'PT15M',
    config: {
      qr: {
        // external_id de la caja QR creada con POST /v2/pos.
        external_pos_id: MP_QR_POS_ID,
        // "hybrid": MP genera un QR dinámico exclusivo por order (del
        // campo `qr_data`) Y vincula la order al QR estático de la
        // caja. Pagando con cualquiera de los dos, el otro se inhabilita.
        mode: 'hybrid',
      },
    },
    transactions: {
      payments: [{ amount: total.toFixed(2) }],
    },
  };

  // Nota: no se envían "items" a MP porque exige "unit_measure" por
  // item (obligatorio en orders QR) y el detalle del carrito ya queda
  // registrado en nuestra DB al confirmar la venta. El "description"
  // alcanza para identificar la order en el panel de MP.

  let mpRes: Response;
  try {
    mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        'X-Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify(mpPayload),
    });
  } catch (err) {
    console.error('create-mp-order: error llamando a MercadoPago', err);
    return json({ error: 'No se pudo contactar a MercadoPago' }, { status: 502 });
  }

  const mpData = await mpRes.json().catch(() => ({}));

  if (!mpRes.ok) {
    console.error('create-mp-order: MercadoPago respondió error', mpRes.status, mpData);
    return json(
      { error: 'MercadoPago rechazó la order', status: mpRes.status, detail: mpData },
      { status: 502 }
    );
  }

  // MP devuelve el código único de la order en "type_response.qr_data"
  // (puede ser objeto o array según el caso).
  const typeResponse = mpData?.type_response;
  const qrData = Array.isArray(typeResponse) ? typeResponse[0]?.qr_data : typeResponse?.qr_data;

  if (!qrData) {
    console.error('create-mp-order: la order no devolvió qr_data', mpData);
    return json({ error: 'MercadoPago no generó el código QR para esta order' }, { status: 502 });
  }

  return json({
    order_id: mpData?.id,
    expiration_time: mpData?.expiration_time ?? 'PT15M',
    qr_data: qrData,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  try {
    return await handleRequest(req);
  } catch (err) {
    console.error('create-mp-order error:', err);
    return json({ error: 'Error interno del servidor' }, { status: 500 });
  }
});