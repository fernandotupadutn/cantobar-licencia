import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Banknote, CheckCircle2, History, Lock, Wallet, X } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { CashRegister, Profile, Sale } from '../types';
import { formatCurrency, formatDateTime } from '../lib/format';
import { computeClosingSummary, sumSalesTotals, expectedCashAmount } from '../lib/cashRegister';

interface CashRegisterPanelProps {
  openRegister: CashRegister | null;
  profile: Profile;
  onRegisterChange: () => void;
}

export default function CashRegisterPanel({ openRegister, profile, onRegisterChange }: CashRegisterPanelProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [liveSales, setLiveSales] = useState<Sale[]>([]);
  const [recentRegisters, setRecentRegisters] = useState<CashRegister[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [openingAmount, setOpeningAmount] = useState('');
  const [countedAmount, setCountedAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastClosing, setLastClosing] = useState<CashRegister | null>(null);

  useEffect(() => {
    loadBaseData();
  }, []);

  useEffect(() => {
    if (openRegister) {
      loadRegisterSales(openRegister.id);
    } else {
      setLiveSales([]);
    }
  }, [openRegister?.id]);

  async function loadBaseData() {
    setLoadingData(true);
    const [profilesRes, historyRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('cash_registers').select('*').eq('status', 'closed').order('closed_at', { ascending: false }).limit(10),
    ]);
    if (profilesRes.error) console.error(profilesRes.error.message);
    if (historyRes.error) console.error(historyRes.error.message);
    setProfiles((profilesRes.data ?? []) as Profile[]);
    setRecentRegisters((historyRes.data ?? []) as CashRegister[]);
    setLoadingData(false);
  }

  async function loadRegisterSales(registerId: string) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, total_amount, payment_method')
      .eq('cash_register_id', registerId);
    if (error) {
      console.error('Error cargando ventas de la caja:', error.message);
      return;
    }
    setLiveSales((data ?? []) as Sale[]);
  }

  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of profiles) map.set(p.id, p.full_name || p.email);
    return map;
  }, [profiles]);

  const totals = useMemo(() => sumSalesTotals(liveSales), [liveSales]);

  const liveExpected = openRegister
    ? expectedCashAmount(openRegister.opening_amount, totals.efectivo)
    : 0;

  const previewSummary =
    openRegister && countedAmount !== '' && !Number.isNaN(Number(countedAmount))
      ? computeClosingSummary(Number(countedAmount), openRegister.opening_amount, liveSales)
      : null;

  async function handleOpen() {
    const amount = openingAmount.trim() === '' ? 0 : Number(openingAmount);
    if (Number.isNaN(amount) || amount < 0) {
      setError('Ingresá un monto inicial válido.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('open_cash_register', { p_opening_amount: amount });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(error.message.replace(/^.*?:\s*/i, ''));
      return;
    }
    setOpeningAmount('');
    await loadBaseData();
    onRegisterChange();
  }

  async function handleClose() {
    const counted = Number(countedAmount);
    if (countedAmount === '' || Number.isNaN(counted) || counted < 0) {
      setError('Ingresá el dinero contado en la caja.');
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error } = await supabase.rpc('close_cash_register', {
      p_counted_amount: counted,
      p_note: note.trim(),
    });
    setBusy(false);
    if (error) {
      console.error(error);
      setError(error.message.replace(/^.*?:\s*/i, ''));
      return;
    }
    setCountedAmount('');
    setNote('');
    setLastClosing(data as CashRegister);
    await loadBaseData();
    onRegisterChange();
  }

  if (loadingData && !openRegister) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando caja...</p>;
  }

  return (
    <div className="space-y-4">
      {lastClosing && <ClosingResultBanner closing={lastClosing} onDismiss={() => setLastClosing(null)} />}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {openRegister ? (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-zinc-900">Caja abierta</h3>
            </div>
            <span className="text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
              Abierta
            </span>
          </div>

          <div className="px-5 py-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SummaryCell label="Abierta por" value={names.get(openRegister.started_by ?? '') ?? (profile.full_name || profile.email)} />
              <SummaryCell label="Hora de apertura" value={formatDateTime(openRegister.opened_at)} />
              <SummaryCell label="Monto inicial" value={formatCurrency(openRegister.opening_amount)} />
              <SummaryCell label="Efectivo esperado (ahora)" value={formatCurrency(liveExpected)} highlight />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MethodCell label="Efectivo vendido" color="text-emerald-600" value={formatCurrency(totals.efectivo)} />
              <MethodCell label="Transferencias" color="text-sky-600" value={formatCurrency(totals.transferencia)} />
              <MethodCell label="Mercado Pago" color="text-indigo-600" value={formatCurrency(totals.mercadoPago)} />
            </div>

            <p className="text-xs text-zinc-400">Ventas del turno: {totals.count}</p>

            <div className="border-t border-zinc-100 pt-4">
              <label className="block text-xs font-semibold text-zinc-500 mb-1">Dinero contado en la caja</label>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={countedAmount}
                onChange={(e) => setCountedAmount(e.target.value)}
                placeholder="0"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
              />

              <label className="block text-xs font-semibold text-zinc-500 mb-1 mt-3">Nota (opcional)</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Por ejemplo: sobró porque se vendió cerveza del stock anterior"
                className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
              />

              {previewSummary && (
                <div className="mt-3 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold">Esperado</p>
                    <p className="font-bold text-zinc-900">{formatCurrency(previewSummary.expected)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold">Contado</p>
                    <p className="font-bold text-zinc-900">{formatCurrency(previewSummary.counted)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold">Diferencia</p>
                    <p className={`font-bold ${previewSummary.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(previewSummary.difference)}
                    </p>
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                disabled={busy}
                className="mt-4 w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
              >
                <Lock className="w-4 h-4" />
                {busy ? 'Cerrando caja...' : 'Cerrar caja'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 p-5 max-w-lg">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-[#E06D00]" />
            <h3 className="font-bold text-zinc-900">Abrir caja</h3>
          </div>
          <p className="text-sm text-zinc-500 mb-4">
            No hay una caja abierta. Abrí la caja para poder registrar ventas.
          </p>
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Monto inicial en la caja (opcional)</label>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            value={openingAmount}
            onChange={(e) => setOpeningAmount(e.target.value)}
            placeholder="0"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
          <button
            onClick={handleOpen}
            disabled={busy}
            className="mt-4 w-full bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {busy ? 'Abriendo caja...' : 'Abrir caja'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-zinc-100">
          <History className="w-5 h-5 text-zinc-700" />
          <h3 className="font-bold text-zinc-900">Últimos cierres</h3>
        </div>
        {recentRegisters.length === 0 ? (
          <p className="text-sm text-zinc-400 text-center py-8">Todavía no hay cierres registrados.</p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {recentRegisters.map((cr) => {
              const diff = cr.difference ?? 0;
              return (
                <div key={cr.id} className="px-5 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-800">{names.get(cr.closed_by ?? '') ?? 'Vendedor'}</p>
                    <p className="text-xs text-zinc-400">
                      Apertura {formatDateTime(cr.opened_at)} · Cierre {cr.closed_at ? formatDateTime(cr.closed_at) : '—'}
                    </p>
                    {cr.note && <p className="text-xs text-zinc-500 mt-0.5 truncate">{cr.note}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-900">{formatCurrency(cr.expected_amount ?? 0)}</p>
                    <p className={`text-xs font-bold ${diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {diff >= 0 ? 'Sobra' : 'Faltan'} {formatCurrency(Math.abs(diff))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCell({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="bg-zinc-50 rounded-xl px-3 py-2.5">
      <p className="text-[11px] font-semibold text-zinc-500">{label}</p>
      <p className={`text-sm font-bold truncate ${highlight ? 'text-[#E06D00]' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}

function MethodCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-xl px-4 py-3">
      <p className={`text-xs font-bold ${color}`}>{label}</p>
      <p className="font-bold text-zinc-900 mt-0.5">{value}</p>
    </div>
  );
}

function ClosingResultBanner({ closing, onDismiss }: { closing: CashRegister; onDismiss: () => void }) {
  const diff = closing.difference ?? 0;
  const ok = diff === 0;
  return (
    <div className={`rounded-2xl border p-4 flex items-start gap-3 ${ok ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-zinc-900 text-sm">Caja cerrada</p>
        <p className="text-sm text-zinc-700 mt-0.5">
          Esperado: <span className="font-semibold">{formatCurrency(closing.expected_amount ?? 0)}</span> · Contado:{' '}
          <span className="font-semibold">{formatCurrency(closing.counted_amount ?? 0)}</span>
        </p>
        <p className={`text-sm font-bold mt-0.5 ${diff >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {diff === 0 ? 'Diferencia: $0 (exacto)' : `Diferencia: ${diff > 0 ? 'sobran' : 'faltan'} ${formatCurrency(Math.abs(diff))}`}
        </p>
      </div>
      <button onClick={onDismiss} aria-label="Cerrar aviso" className="p-1.5 rounded-lg text-zinc-400 hover:bg-white hover:text-zinc-600 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}