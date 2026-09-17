import { SaleItem } from '../types';

export interface DrinkStat {
  drinkName: string;
  quantity: number;
  revenue: number;
}

export interface HourStat {
  hour: number;
  sales: number;
  items: number;
  revenue: number;
}

export interface RankedDrinks {
  ranked: DrinkStat[];
  top: DrinkStat[];
  bottom: DrinkStat[];
}

type ItemRow = Pick<SaleItem, 'drink_name' | 'quantity' | 'subtotal'>;

// Ranking de bebidas por cantidad vendida (empates por plata y luego alfabético).
export function rankDrinksByQuantity(items: ItemRow[]): DrinkStat[] {
  const byName = new Map<string, DrinkStat>();
  for (const item of items) {
    const entry = byName.get(item.drink_name) ?? {
      drinkName: item.drink_name,
      quantity: 0,
      revenue: 0,
    };
    entry.quantity += item.quantity;
    entry.revenue += item.subtotal;
    byName.set(item.drink_name, entry);
  }
  return Array.from(byName.values()).sort(
    (a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.drinkName.localeCompare(b.drinkName)
  );
}

// Top N más vendidas y top N menos vendidas.
export function topAndBottomDrinks(items: ItemRow[], n = 5): RankedDrinks {
  const ranked = rankDrinksByQuantity(items);
  const bottom = [...ranked]
    .sort(
      (a, b) => a.quantity - b.quantity || a.revenue - b.revenue || a.drinkName.localeCompare(b.drinkName)
    )
    .slice(0, n);
  return {
    ranked,
    top: ranked.slice(0, n),
    bottom,
  };
}

type HourRow = { sale_id: string; quantity: number; subtotal: number };

// Distribución de ventas por hora del día. Conecta cada item con su venta
// para leer created_at y obtener la hora local del registro.
export function salesByHour(
  items: HourRow[],
  createdAtBySaleId: Record<string, string>
): HourStat[] {
  const byHour = new Map<number, HourStat>();
  for (const item of items) {
    const createdAt = createdAtBySaleId[item.sale_id];
    if (!createdAt) continue;
    const hour = new Date(createdAt).getHours();
    const entry = byHour.get(hour) ?? { hour, sales: 0, items: 0, revenue: 0 };
    entry.sales += 1;
    entry.items += item.quantity;
    entry.revenue += item.subtotal;
    byHour.set(hour, entry);
  }
  return Array.from(byHour.values()).sort((a, b) => a.hour - b.hour);
}

// Hora del día con más recaudación (empate por cantidad de ventas).
export function peakHour(stats: HourStat[]): HourStat | null {
  if (stats.length === 0) return null;
  return stats.reduce(
    (max, cur) => (cur.revenue > max.revenue || (cur.revenue === max.revenue && cur.sales > max.sales) ? cur : max),
    stats[0]
  );
}