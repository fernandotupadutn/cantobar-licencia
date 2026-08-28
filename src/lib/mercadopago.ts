import { supabase } from './supabaseClient';
import { CartItem, MpOrderRequest, MpOrderResponse, MpOrderStatus } from '../types';

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
    const detail = (data as { error?: string } | null)?.error ? `: ${(data as { error: string }).error}` : '';
    throw new Error(`No se pudo crear la order de pago${detail}`);
  }

  return data as MpOrderResponse;
}

export async function checkMpOrder(orderId: string): Promise<MpOrderStatus> {
  const { data, error } = await supabase.functions.invoke(
    `check-mp-order?order_id=${encodeURIComponent(orderId)}`
  );

  if (error) {
    console.error('checkMpOrder error:', error);
    throw new Error('No se pudo consultar el estado del pago');
  }

  return data as MpOrderStatus;
}
