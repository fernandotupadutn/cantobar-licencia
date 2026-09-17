import { Sale } from '../types';

export interface RegisterSalesTotals {
  count: number;
  efectivo: number;
  transferencia: number;
  mercadoPago: number;
}

export interface ClosingSummary {
  expected: number;
  counted: number;
  difference: number;
  totals: RegisterSalesTotals;
}

const emptyTotals: RegisterSalesTotals = {
  count: 0,
  efectivo: 0,
  transferencia: 0,
  mercadoPago: 0,
};

// Suma el monto vendido por método de pago sobre las ventas de una caja.
export function sumSalesTotals(
  sales: Pick<Sale, 'payment_method' | 'total_amount'>[]
): RegisterSalesTotals {
  return sales.reduce<RegisterSalesTotals>((acc, sale) => {
    acc.count += 1;
    if (sale.payment_method === 'Efectivo') acc.efectivo += sale.total_amount;
    else if (sale.payment_method === 'Transferencia') acc.transferencia += sale.total_amount;
    else acc.mercadoPago += sale.total_amount;
    return acc;
  }, { ...emptyTotals });
}

// Lo que debería haber en la caja: dinero inicial + ventas en efectivo.
export function expectedCashAmount(openingAmount: number, efectivoSales: number): number {
  return openingAmount + efectivoSales;
}

// Diferencia entre lo contado y lo esperado (positivo = sobra, negativo = falta).
export function closingDifference(countedAmount: number, expectedAmount: number): number {
  return countedAmount - expectedAmount;
}

// Resumen completo para mostrar en el cierre.
export function computeClosingSummary(
  countedAmount: number,
  openingAmount: number,
  sales: Pick<Sale, 'payment_method' | 'total_amount'>[]
): ClosingSummary {
  const totals = sumSalesTotals(sales);
  const expected = expectedCashAmount(openingAmount, totals.efectivo);
  return {
    expected,
    counted: countedAmount,
    difference: closingDifference(countedAmount, expected),
    totals,
  };
}