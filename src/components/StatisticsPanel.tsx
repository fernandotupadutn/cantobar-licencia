import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Clock, Crown, Trophy } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Sale, SaleItem } from '../types';
import { formatCurrency } from '../lib/format';
import { peakHour, salesByHour, topAndBottomDrinks, DrinkStat, HourStat } from '../lib/statistics';

type RangeOption = 'today' | '7d' | '30d' | 'all';

const rangeLabels: Record<RangeOption, string> = {
  today: 'Hoy',
  '7d': 'Últimos 7 días',
  '30d': 'Últimos 30 días',
  all: 'Todo el historial',
};

export default function StatisticsPanel() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>('7d');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesRes, itemsRes] = await Promise.all([
      supabase.from('sales').select('id, created_at, total_amount'),
      supabase.from('sale_items').select('sale_id, drink_name, quantity, subtotal'),
    ]);
    if (salesRes.error) console.error(salesRes.error.message);
    if (itemsRes.error) console.error(itemsRes.error.message);
    setSales((salesRes.data ?? []) as Sale[]);
    setItems((itemsRes.data ?? []) as SaleItem[]);
    setLoading(false);
  }

  const cutoff = useMemo(() => {
    if (range === 'all') return null;
    const now = new Date();
    const c = new Date(now);
    if (range === 'today') c.setHours(0, 0, 0, 0);
    else if (range === '7d') c.setDate(now.getDate() - 7);
    else if (range === '30d') c.setDate(now.getDate() - 30);
    return c;
  }, [range]);

  const rangeStats = useMemo(() => {
    const inRangeSales = cutoff
      ? sales.filter((s) => new Date(s.created_at) >= cutoff)
      : sales;
    const validIds = new Set(inRangeSales.map((s) => s.id));
    const itemsInRange = items.filter((i) => validIds.has(i.sale_id));
    const createdAtBySaleId: Record<string, string> = {};
    for (const s of inRangeSales) createdAtBySaleId[s.id] = s.created_at;

    const drinks = topAndBottomDrinks(itemsInRange, 5);
    const hours = salesByHour(itemsInRange, createdAtBySaleId);
    const peak = peakHour(hours);
    const totalRevenue = inRangeSales.reduce((acc, s) => acc + s.total_amount, 0);
    const totalItems = itemsInRange.reduce((acc, i) => acc + i.quantity, 0);

    return { itemsInRange, drinks, hours, peak, totalRevenue, totalItems, salesCount: inRangeSales.length };
  }, [sales, items, cutoff]);

  if (loading) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando estadísticas...</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {(Object.keys(rangeLabels) as RangeOption[]).map((opt) => (
          <button
            key={opt}
            onClick={() => setRange(opt)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              range === opt ? 'bg-[#E06D00] text-white' : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
            }`}
          >
            {rangeLabels[opt]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold text-zinc-500 mb-1">Ventas en el período</p>
          <p className="text-2xl font-extrabold text-zinc-900">{rangeStats.salesCount}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold text-zinc-500 mb-1">Items vendidos</p>
          <p className="text-2xl font-extrabold text-zinc-900">{rangeStats.totalItems}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold text-zinc-500 mb-1">Recaudación</p>
          <p className="text-2xl font-extrabold text-zinc-900">{formatCurrency(rangeStats.totalRevenue)}</p>
        </div>
      </div>

      {rangeStats.itemsInRange.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-10">No hay datos en este período.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <DrinksRanking drinks={rangeStats.drinks} />
          <HoursChart hours={rangeStats.hours} peakHour={rangeStats.peak} />
        </div>
      )}
    </div>
  );
}

function DrinkRow({ index, drink, highlight }: { index: number; drink: DrinkStat; highlight: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 ${highlight ? 'bg-orange-50/60' : ''}`}
    >
      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${highlight ? 'bg-[#E06D00] text-white' : 'bg-zinc-100 text-zinc-600'}`}>
        {index}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-zinc-800 truncate">{drink.drinkName}</p>
        <p className="text-xs text-zinc-400">{drink.quantity} vendida(s)</p>
      </div>
      <span className="font-bold text-zinc-900 text-sm">{formatCurrency(drink.revenue)}</span>
    </div>
  );
}

function DrinksRanking({ drinks }: { drinks: { top: DrinkStat[]; bottom: DrinkStat[] } }) {
  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
          <Crown className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-zinc-900">Bebidas más vendidas</h3>
        </div>
        {drinks.top.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">Sin datos.</p>
        ) : (
          drinks.top.map((d, i) => <DrinkRow key={d.drinkName} index={i + 1} drink={d} highlight={i === 0} />)
        )}
      </div>

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
          <BarChart3 className="w-5 h-5 text-zinc-400" />
          <h3 className="font-bold text-zinc-900">Bebidas menos vendidas</h3>
        </div>
        {drinks.bottom.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-6">Sin datos.</p>
        ) : (
          drinks.bottom.map((d, i) => <DrinkRow key={d.drinkName} index={i + 1} drink={d} highlight={false} />)
        )}
      </div>
    </div>
  );
}

function HoursChart({ hours, peakHour }: { hours: HourStat[]; peakHour: HourStat | null }) {
  const max = Math.max(...hours.map((h) => h.revenue), 0);

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
        <Clock className="w-5 h-5 text-[#E06D00]" />
        <h3 className="font-bold text-zinc-900">Ventas por hora del día</h3>
      </div>
      {hours.length === 0 ? (
        <p className="text-sm text-zinc-400 text-center py-6">Sin datos.</p>
      ) : (
        <div className="px-5 py-4 space-y-2.5">
          {hours.map((h) => {
            const isPeak = peakHour?.hour === h.hour;
            const pct = max > 0 ? Math.round((h.revenue / max) * 100) : 0;
            return (
              <div key={h.hour} className="flex items-center gap-3">
                <span className="w-10 text-xs font-bold text-zinc-500 text-right shrink-0">
                  {String(h.hour).padStart(2, '0')}:00
                </span>
                <div className="flex-1 h-7 bg-zinc-100 rounded-lg overflow-hidden relative">
                  <div
                    className={`h-full rounded-lg ${isPeak ? 'bg-[#E06D00]' : 'bg-orange-200'}`}
                    style={{ width: `${Math.max(pct, 4)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center pl-2.5 text-[11px] font-semibold text-zinc-600 truncate">
                    {h.sales} venta(s) · {formatCurrency(h.revenue)}
                    {isPeak && (
                      <span className="ml-2 inline-flex items-center gap-1 text-[#B45309] font-bold">
                        <Trophy className="w-3 h-3" /> Hora pico
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}