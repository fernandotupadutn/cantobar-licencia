// ============================================================
// Edge Function "create-mp-order": crea una order de pago en
// Mercado Pago (Orders API, type: "point") configurada para que el
// Terminal Point Smart muestre el QR Code en su propia pantalla.
//
// El Access Token de MercadoPago y el terminal_id son SECRETS del
// servidor (MERCADOPAGO_ACCESS_TOKEN / MP_TERMINAL_ID). Nunca se
// exponen al cliente.
//
// Cómo funciona:
//   1. El POS llama con { items, total_amount, external_reference }.
//   2. Se crea la order type "point" con
//      config.payment_method.default_type = "qr".
//   3. MercadoPago "envía" la order a la terminal Point Smart, que
//      la carga y muestra el QR en su pantalla táctil (el comprador
//      lo escanea con la app de MercadoPago).
//   4. Se devuelve { order_id, expiration_time }. El POS hace polling
//      con check-mp-order hasta que el pago se acredite.
//
// PyLD / requisitos:
//   - Terminal Point en modo PDV (asociado a una caja/store).
//   - Secrets: MERCADOPAGO_ACCESS_TOKEN y MP_TERMINAL_ID.
//
// Deploy:
//   SUPABASE_ACCESS_TOKEN=... pnpm dlx supabase functions deploy create-mp-order
//   Y cargar MERCADOPAGO_ACCESS_TOKEN y MP_TERMINAL_ID como secrets.
// ============================================================

const MP_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
const MP_TERMINAL_ID = Deno.env.get('MERCADOPAGO_TERMINAL_ID');

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
  if (!MP_TERMINAL_ID) {
    return json({ error: 'Falta configurar MERCADOPAGO_TERMINAL_ID en el servidor' }, { status: 500 });
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

  const mpPayload = {
    type: 'point',
    external_reference: externalReference,
    description: 'CantoBar - Venta en local',
    expiration_time: 'PT5M',
    processing_mode: 'automatic',
    // default_type "qr" hace que la terminal Point Smart muestre el
    // QR code en su pantalla (short de la order que carga el terminal).
    config: {
      point: {
        terminal_id: MP_TERMINAL_ID,
        print_on_terminal: 'no_ticket',
      },
      payment_method: {
        default_type: 'qr',
      },
    },
    transactions: {
      payments: [{ amount: total.toFixed(2) }],
    },
  };

  let mpRes: Response;
  try {
    mpRes = await fetch('https://api.mercadopago.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
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

  return json({
    order_id: mpData?.id,
    expiration_time: mpData?.expiration_time ?? 'PT5M',
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
