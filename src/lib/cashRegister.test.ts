import { describe, expect, it } from 'vitest';
import { Sale } from '../types';
import {
  closingDifference,
  computeClosingSummary,
  expectedCashAmount,
  sumSalesTotals,
} from './cashRegister';

function makeSale(payment_method: Sale['payment_method'], total_amount: number): Pick<Sale, 'payment_method' | 'total_amount'> {
  return { payment_method, total_amount };
}

describe('sumSalesTotals', () => {
  it('suma por método de pago', () => {
    const totals = sumSalesTotals([
      makeSale('Efectivo', 1000),
      makeSale('Efectivo', 500),
      makeSale('Transferencia', 2000),
      makeSale('MercadoPago', 3000),
    ]);
    expect(totals).toEqual({ count: 4, efectivo: 1500, transferencia: 2000, mercadoPago: 3000 });
  });

  it('vuelve todo en cero sin ventas', () => {
    expect(sumSalesTotals([])).toEqual({ count: 0, efectivo: 0, transferencia: 0, mercadoPago: 0 });
  });
});

describe('expectedCashAmount', () => {
  it('suma el monto inicial más las ventas en efectivo', () => {
    expect(expectedCashAmount(1500, 4000)).toBe(5500);
  });
});

describe('closingDifference', () => {
  it('positivo cuando sobra plata', () => {
    expect(closingDifference(5500, 5000)).toBe(500);
  });

  it('negativo cuando falta plata', () => {
    expect(closingDifference(4500, 5000)).toBe(-500);
  });
});

describe('computeClosingSummary', () => {
  it('calcula esperado, diferencia y totales', () => {
    const summary = computeClosingSummary(6000, 1000, [
      makeSale('Efectivo', 2000),
      makeSale('Efectivo', 3000),
      makeSale('Transferencia', 1500),
    ]);
    expect(summary).toEqual({
      expected: 6000,
      counted: 6000,
      difference: 0,
      totals: { count: 3, efectivo: 5000, transferencia: 1500, mercadoPago: 0 },
    });
  });

  it('no cuenta transferencias ni mercado pago en la caja en efectivo', () => {
    const summary = computeClosingSummary(1000, 0, [makeSale('MercadoPago', 9000)]);
    expect(summary.expected).toBe(0);
    expect(summary.difference).toBe(1000);
  });
});