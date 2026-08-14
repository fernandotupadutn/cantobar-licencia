import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Profile, Sale } from '../types';
import { formatCurrency } from '../lib/format';

type RangeOption = 'today' | '7d' | '30d' | 'all';

export default function ReportsPanel() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>('7d');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [salesRes, profilesRes] = await Promise.all([
      supabase.from('sales').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*'),
    ]);
    if (salesRes.error) console.error(salesRes.error.message);
    if (profilesRes.error) console.error(profilesRes.error.message);
    setSales((salesRes.data ?? []) as Sale[]);
    setProfiles((profilesRes.data ?? []) as Profile[]);
    setLoading(false);
  }

  const filteredSales = useMemo(() => {
    if (range === 'all') return sales;
    const now = new Date();
    const cutoff = new Date(now);
    if (range === 'today') {
      cutoff.setHours(0, 0, 0, 0);
    } else if (range === '7d') {
      cutoff.setDate(now.getDate() - 7);
    } else if (range === '30d') {
      cutoff.setDate(now.getDate() - 30);
    }
    return sales.filter((s) => new Date(s.created_at) >= cutoff);
  }, [sales, range]);

  const totals = useMemo(() => {
    const total = filteredSales.reduce((acc, s) => acc + s.total_amount, 0);
    const efectivo = filteredSales
      .filter((s) => s.payment_method === 'Efectivo')
      .reduce((acc, s) => acc + s.total_amount, 0);
    const transferencia = filteredSales
      .filter((s) => s.payment_method === 'Transferencia')
      .reduce((acc, s) => acc + s.total_amount, 0);
    return { total, efectivo, transferencia, count: filteredSales.length };
  }, [filteredSales]);

  const bySeller = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number }>();
    for (const sale of filteredSales) {
      const key = sale.seller_id ?? 'sin-vendedor';
      const seller = profiles.find((p) => p.id === sale.seller_id);
      const name = seller?.full_name || seller?.email || 'Sin vendedor asignado';
      const entry = map.get(key) ?? { name, total: 0, count: 0 };
      entry.total += sale.total_amount;
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filteredSales, profiles]);

  const rangeLabels: Record<RangeOption, string> = {
    today: 'Hoy',
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
    all: 'Todo el historial',
  };

  if (loading) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando reportes...</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          <p className="text-xs font-semibold text-zinc-500 mb-1">Ganancia total</p>
          <p className="text-2xl font-extrabold text-zinc-900">{formatCurrency(totals.total)}</p>
          <p className="text-xs text-zinc-400 mt-1">{totals.count} venta(s)</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold text-emerald-600 mb-1">Efectivo</p>
          <p className="text-2xl font-extrabold text-zinc-900">{formatCurrency(totals.efectivo)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200 p-4">
          <p className="text-xs font-semibold text-sky-600 mb-1">Transferencia</p>
          <p className="text-2xl font-extrabold text-zinc-900">{formatCurrency(totals.transferencia)}</p>
        </div>
      </div>

      <h4 className="text-sm font-bold text-zinc-800 mb-2">Desglose por vendedor</h4>
      <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
        {bySeller.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-zinc-800">{entry.name}</p>
              <p className="text-xs text-zinc-400">{entry.count} venta(s)</p>
            </div>
            <span className="font-bold text-zinc-900 text-sm">{formatCurrency(entry.total)}</span>
          </div>
        ))}
        {bySeller.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-8">No hay ventas en este período.</p>
        )}
      </div>
    </div>
  );
}
