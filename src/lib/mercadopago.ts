import { supabase } from './supabaseClient';
import { CartItem, MpOrderRequest, MpOrderResponse, MpOrderStatus } from '../types';

// QR estático de la caja de Mercado Pago (producto "Código QR", modelo
// híbrido). Es el QR que se imprime y se pega en la barra: en modo
// híbrido, cada order creada también queda vinculada a este QR, y si el
// cliente paga con él (o con el QR dinámico), el otro se inhabilita.
// Es un recurso público (impreso en el local), no un secret.
export const MP_POS_STATIC_QR = 'https://mpago.la/pos/137705663';

// Capa delgada que expone las operaciones de Mercado Pago a la UI.
// Internamente invoca las Edge Functions de Supabase (que son las
// únicas que tienen acceso al Access Token de MercadoPago).

export async function createMpOrder(cart: CartItem[], externalReference: string): Promise<MpOrderResponse> {
  const total = cart.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
  const payload: MpOrderRequest = {
    total_amount: total,
    external_reference: externalReference,
    items: cart.map((i) => ({
      title: i.name,
      unit_price: i.unit_price,
      quantity: i.quantity,
    })),
  };

  const { data, error } = await supabase.functions.invoke('create-mp-order', {
    body: payload,
  });

  if (error) {
    console.error('createMpOrder error:', error);
    const body = data as
      | { error?: string; detail?: { errors?: { code: string; message: string; details?: string[] }[] } }
      | null;
    let detail = body?.error ? `: ${body.error}` : '';
    const mpIssue = body?.detail?.errors?.[0];
    if (mpIssue) {
      detail += ` — ${mpIssue.message}${mpIssue.details?.[0] ? ` (${mpIssue.details[0]})` : ''}`;
    }
    throw new Error(`No se pudo crear la order de pago${detail}`);
  }

  return data as MpOrderResponse;
}

export async function checkMpOrder(orderId: string): Promise<MpOrderStatus> {
  const { data, error } = await supabase.functions.invoke('check-mp-order', {
    body: { order_id: orderId },
  });

  if (error) {
    console.error('checkMpOrder error:', error);
    throw new Error('No se pudo consultar el estado del pago');
  }

  return data as MpOrderStatus;
}

export async function cancelMpOrder(orderId: string): Promise<{ order_id?: string; status?: string }> {
  const { data, error } = await supabase.functions.invoke('cancel-mp-order', {
    body: { order_id: orderId },
  });

  if (error) {
    console.error('cancelMpOrder error:', error);
    throw new Error('No se pudo cancelar la order de Mercado Pago');
  }

  return data as { order_id?: string; status?: string };
}
