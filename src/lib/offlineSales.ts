import { supabase } from './supabaseClient';
import { CartItem, PaymentMethod, SaleItem, SaleWithItems } from '../types';

// Outbox de ventas offline. Solo se usa en la versión de escritorio
// (Electron): si no hay internet la venta se guarda acá con un id
// local, se imprime el ticket y al reconectar se sincroniza sola.
const OUTBOX_KEY = 'cantobar_outbox';

export interface OfflineSaleItem {
  drink_id: string;
  drink_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface PendingSale {
  local_id: string;
  created_at: string;
  payment_method: PaymentMethod;
  cash_register_id: string;
  seller_name?: string;
  mp_order_id?: string | null;
  mp_payment_id?: string | null;
  items: OfflineSaleItem[];
  total_amount: number;
}

export interface SyncResult {
  synced: number;
  errorMessage?: string;
}

// UUID v4 con fallback para entornos de test sin crypto.
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function getPendingSales(): PendingSale[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as PendingSale[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function savePendingSales(list: PendingSale[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(list));
  } catch {
    // localStorage lleno o bloqueado: no se puede encolar.
    console.error('No se pudo guardar la venta offline (localStorage lleno).');
  }
}

export function pendingSalesCount(): number {
  return getPendingSales().length;
}

export function enqueuePendingSale(pending: PendingSale): void {
  const list = getPendingSales();
  list.push(pending);
  savePendingSales(list);
}

export function removePendingSale(localId: string): void {
  const list = getPendingSales().filter((p) => p.local_id !== localId);
  savePendingSales(list);
}

export function clearPendingSales(): void {
  savePendingSales([]);
}

export function isNetworkError(err: unknown): boolean {
  if (navigator && typeof navigator.onLine === 'boolean' && !navigator.onLine) return true;
  const e = err as { message?: string; code?: string } | null;
  const msg = (e?.message ?? '').toLowerCase();
  return (
    e?.code === 'FETCH_ERROR' ||
    /failed to fetch|networkerror|network error|fetch failed/i.test(msg)
  );
}

interface BuildPendingArgs {
  cart: CartItem[];
  method: PaymentMethod;
  cashRegisterId: string;
  sellerName?: string;
  mpOrderId?: string;
  mpPaymentId?: string;
}

// Construye la venta pendiente a partir del carrito. Guarda los items
// desnormalizados (nombre/precio) para poder mostrar el historial y
// reimprimir el ticket sin conexión.
export function buildPendingSale(args: BuildPendingArgs): PendingSale {
  const localId = uuid();
  return {
    local_id: localId,
    created_at: new Date().toISOString(),
    payment_method: args.method,
    cash_register_id: args.cashRegisterId,
    seller_name: args.sellerName,
    mp_order_id: args.mpOrderId ?? null,
    mp_payment_id: args.mpPaymentId ?? null,
    items: args.cart.map((item) => ({
      drink_id: item.drink_id,
      drink_name: item.name,
      unit_price: item.unit_price,
      quantity: item.quantity,
      subtotal: item.unit_price * item.quantity,
    })),
    total_amount: args.cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0),
  };
}

// Convierte una venta pendiente a SaleWithItems (para historial/ticket local).
export function pendingToSale(pending: PendingSale): SaleWithItems {
  const items: SaleItem[] = pending.items.map((item) => ({
    id: uuid(),
    sale_id: pending.local_id,
    drink_id: item.drink_id,
    drink_name: item.drink_name,
    unit_price: item.unit_price,
    quantity: item.quantity,
    subtotal: item.subtotal,
  }));
  return {
    id: pending.local_id,
    total_amount: pending.total_amount,
    payment_method: pending.payment_method,
    seller_id: null,
    created_at: pending.created_at,
    mp_order_id: pending.mp_order_id,
    mp_payment_id: pending.mp_payment_id,
    cash_register_id: pending.cash_register_id,
    items,
    seller_name: pending.seller_name,
  };
}

// Sincroniza la cola en orden FIFO contra Supabase. Cada venta se crea
// con su p_sale_id (el id local), así el ticket impreso offline coincide
// con el de la venta registrada. Ante un error de servidor (caja cerrada,
// bebida no disponible, etc.) corta y deja el resto en cola para reintentar.
export async function syncPendingSales(): Promise<SyncResult> {
  const pending = getPendingSales();
  let synced = 0;

  for (const p of pending) {
    const { data, error } = await supabase.rpc('create_sale', {
      p_payment_method: p.payment_method,
      p_items: p.items.map((i) => ({ drink_id: i.drink_id, quantity: i.quantity })),
      p_mp_order_id: p.mp_order_id ?? null,
      p_mp_payment_id: p.mp_payment_id ?? null,
      p_cash_register_id: p.cash_register_id,
      p_sale_id: p.local_id,
    });

    if (error || !data) {
      const message = error?.message?.replace(/^.*?: create_sale:\s*/i, '') || 'Error desconocido';
      return { synced, errorMessage: message };
    }
    removePendingSale(p.local_id);
    synced++;
  }

  return { synced };
}