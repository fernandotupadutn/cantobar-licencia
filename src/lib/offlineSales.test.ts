import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildPendingSale,
  clearPendingSales,
  enqueuePendingSale,
  getPendingSales,
  isNetworkError,
  pendingSalesCount,
  pendingToSale,
  removePendingSale,
  uuid,
} from './offlineSales';

const cart = [
  { drink_id: 'a-b-c', name: 'Fernet', unit_price: 4000, quantity: 2 },
  { drink_id: 'd-e-f', name: 'Coca 500', unit_price: 2000, quantity: 1 },
];

beforeEach(() => {
  localStorage.clear();
});

describe('uuid()', () => {
  it('genera uuids válidos y únicos', () => {
    const a = uuid();
    const b = uuid();
    expect(a).toMatch(/^[0-9a-f-]{36}$/i);
    expect(a).not.toBe(b);
  });
});

describe('outbox', () => {
  it('arranca vacío', () => {
    expect(pendingSalesCount()).toBe(0);
  });

  it('encola, cuenta y elimina ventas pendientes', () => {
    const p1 = buildPendingSale({ cart, method: 'Efectivo', cashRegisterId: 'cr-1' });
    const p2 = buildPendingSale({ cart, method: 'Transferencia', cashRegisterId: 'cr-1', sellerName: 'Cajera' });

    enqueuePendingSale(p1);
    enqueuePendingSale(p2);

    expect(pendingSalesCount()).toBe(2);
    expect(getPendingSales().map((p) => p.local_id)).toEqual([p1.local_id, p2.local_id]);

    removePendingSale(p1.local_id);
    expect(getPendingSales().map((p) => p.local_id)).toEqual([p2.local_id]);

    clearPendingSales();
    expect(pendingSalesCount()).toBe(0);
  });

  it('soporta localStorage corrupto', () => {
    localStorage.setItem('cantobar_outbox', '{invalid json');
    expect(getPendingSales()).toEqual([]);
  });
});

describe('buildPendingSale()', () => {
  it('calcula total e items desnormalizados', () => {
    const p = buildPendingSale({ cart, method: 'Efectivo', cashRegisterId: 'cr-1', sellerName: 'Cajera' });
    expect(p.payment_method).toBe('Efectivo');
    expect(p.seller_name).toBe('Cajera');
    expect(p.total_amount).toBe(10000);
    expect(p.items).toEqual([
      { drink_id: 'a-b-c', drink_name: 'Fernet', unit_price: 4000, quantity: 2, subtotal: 8000 },
      { drink_id: 'd-e-f', drink_name: 'Coca 500', unit_price: 2000, quantity: 1, subtotal: 2000 },
    ]);
  });
});

describe('pendingToSale()', () => {
  it('mapea a SaleWithItems con el mismo id local', () => {
    const p = buildPendingSale({ cart, method: 'MercadoPago', cashRegisterId: 'cr-1' });
    const sale = pendingToSale(p);
    expect(sale.id).toBe(p.local_id);
    expect(sale.payment_method).toBe('MercadoPago');
    expect(sale.total_amount).toBe(10000);
    expect(sale.created_at).toBe(p.created_at);
    expect(sale.items).toHaveLength(2);
    expect(sale.items[0].sale_id).toBe(p.local_id);
    expect(sale.items[0].drink_name).toBe('Fernet');
  });
});

describe('isNetworkError()', () => {
  it('detecta error de red sin depender solo de navigator.onLine', () => {
    expect(isNetworkError({ message: 'Failed to fetch' })).toBe(true);
    expect(isNetworkError({ message: 'NetworkError when attempting to fetch resource.' })).toBe(true);
    expect(isNetworkError({ code: 'FETCH_ERROR' })).toBe(true);
    expect(isNetworkError({ message: 'No autenticado' })).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});