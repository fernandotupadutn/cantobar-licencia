import { describe, expect, it } from 'vitest';
import {
  peakHour,
  rankDrinksByQuantity,
  salesByHour,
  topAndBottomDrinks,
} from './statistics';

const items = [
  { drink_name: 'Fernet', quantity: 3, subtotal: 3000 },
  { drink_name: 'Fernet', quantity: 2, subtotal: 2000 },
  { drink_name: 'Gin Tonic', quantity: 1, subtotal: 1500 },
  { drink_name: 'Gin Tonic', quantity: 1, subtotal: 1500 },
  { drink_name: 'Agua', quantity: 1, subtotal: 500 },
];

describe('rankDrinksByQuantity', () => {
  it('agrupa por bebida y ordena por cantidad descendente', () => {
    const ranked = rankDrinksByQuantity(items);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].drinkName).toBe('Fernet');
    expect(ranked[0]).toEqual({ drinkName: 'Fernet', quantity: 5, revenue: 5000 });
    expect(ranked[2].drinkName).toBe('Agua');
  });
});

describe('topAndBottomDrinks', () => {
  it('devuelve la más vendida y la menos vendida', () => {
    const { top, bottom } = topAndBottomDrinks(items, 1);
    expect(top).toEqual([{ drinkName: 'Fernet', quantity: 5, revenue: 5000 }]);
    expect(bottom).toEqual([{ drinkName: 'Agua', quantity: 1, revenue: 500 }]);
  });

  it('devuelve listas vacías sin items', () => {
    const { ranked, top, bottom } = topAndBottomDrinks([], 5);
    expect(ranked).toEqual([]);
    expect(top).toEqual([]);
    expect(bottom).toEqual([]);
  });
});

describe('salesByHour', () => {
  const createdAt: Record<string, string> = {
    s1: '2026-09-14T20:15:00',
    s2: '2026-09-14T22:30:00',
    s3: '2026-09-13T22:45:00',
  };

  it('agrupa por hora local y ordena ascendente', () => {
    const rows = [
      { sale_id: 's1', quantity: 2, subtotal: 2000 },
      { sale_id: 's2', quantity: 1, subtotal: 1000 },
      { sale_id: 's3', quantity: 1, subtotal: 1000 },
    ];
    const stats = salesByHour(rows, createdAt);
    expect(stats.map((s) => s.hour)).toEqual([20, 22]);
    expect(stats[1]).toEqual({ hour: 22, sales: 2, items: 2, revenue: 2000 });
  });

  it('ignora items sin venta asociada', () => {
    const stats = salesByHour([{ sale_id: 'nada', quantity: 1, subtotal: 100 }], createdAt);
    expect(stats).toEqual([]);
  });
});

describe('peakHour', () => {
  it('devuelve la hora con más recaudación', () => {
    const stats = [
      { hour: 20, sales: 5, items: 5, revenue: 4000 },
      { hour: 22, sales: 1, items: 1, revenue: 8000 },
    ];
    expect(peakHour(stats)?.hour).toBe(22);
  });

  it('empata por cantidad de ventas cuando hay igual recaudación', () => {
    const stats = [
      { hour: 20, sales: 5, items: 6, revenue: 4000 },
      { hour: 22, sales: 3, items: 3, revenue: 4000 },
    ];
    expect(peakHour(stats)?.hour).toBe(20);
  });

  it('devuelve null sin datos', () => {
    expect(peakHour([])).toBeNull();
  });
});