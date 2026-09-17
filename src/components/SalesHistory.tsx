import { useState } from 'react';
import { ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { PaymentMethod, SaleWithItems } from '../types';
import { formatCurrency, formatDateTime, shortTicketNumber } from '../lib/format';

export const PAYMENT_METHODS: PaymentMethod[] = ['Efectivo', 'Transferencia', 'MercadoPago'];

interface SalesHistoryProps {
  sales: SaleWithItems[];
  pendingSales: SaleWithItems[];
  loading: boolean;
  onReprint: (sale: SaleWithItems) => void;
  onChangePaymentMethod: (saleId: string, method: PaymentMethod) => Promise<void>;
}

export default function SalesHistory({
  sales,
  pendingSales,
  loading,
  onReprint,
  onChangePaymentMethod,
}: SalesHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingMethodId, setSavingMethodId] = useState<string | null>(null);

  const allSales = [...pendingSales, ...sales];
  const pendingIds = new Set(pendingSales.map((s) => s.id));

  if (loading && allSales.length === 0) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando historial de ventas...</p>;
  }

  if (allSales.length === 0) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Todavía no hay ventas registradas.</p>;
  }

  return (
    <div className="space-y-3">
      {allSales.map((sale) => {
        const isOpen = expandedId === sale.id;
        const isCash = sale.payment_method === 'Efectivo';
        const isPending = pendingIds.has(sale.id);

        return (
          <div key={sale.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : sale.id)}
              className="w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div>
                  <p className="font-bold text-zinc-900 text-sm">
                    Ticket #{shortTicketNumber(sale.id)}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {formatDateTime(sale.created_at)}
                    {sale.seller_name && ` · ${sale.seller_name}`}
                  </p>
                </div>
                {isPending ? (
                  <span className="text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 bg-amber-50 text-amber-700">
                    Pendiente
                  </span>
                ) : (
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                      isCash ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                    }`}
                  >
                    {sale.payment_method}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="font-bold text-zinc-900">{formatCurrency(sale.total_amount)}</span>
                {isOpen ? (
                  <ChevronUp className="w-4 h-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-zinc-400" />
                )}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-zinc-100 px-4 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-400 text-left">
                      <th className="font-semibold pb-2">Producto</th>
                      <th className="font-semibold pb-2 text-center">Cant.</th>
                      <th className="font-semibold pb-2 text-right">P. unit.</th>
                      <th className="font-semibold pb-2 text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items.map((item) => (
                      <tr key={item.id} className="border-t border-zinc-50">
                        <td className="py-1.5 text-zinc-700">{item.drink_name}</td>
                        <td className="py-1.5 text-center text-zinc-700">{item.quantity}</td>
                        <td className="py-1.5 text-right text-zinc-700">{formatCurrency(item.unit_price)}</td>
                        <td className="py-1.5 text-right font-semibold text-zinc-900">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mt-3 pt-3 border-t border-zinc-100 space-y-3">
                  {!isPending && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-500 shrink-0">Método de pago:</span>
                      <div className="flex gap-1.5">
                        {PAYMENT_METHODS.map((method) => {
                          const isActive = sale.payment_method === method;
                          const saving = savingMethodId === sale.id;
                          return (
                            <button
                              key={method}
                              onClick={() => {
                                if (isActive || saving) return;
                                setSavingMethodId(sale.id);
                                onChangePaymentMethod(sale.id, method)
                                  .catch(() => {})
                                  .finally(() => setSavingMethodId(null));
                              }}
                              disabled={isActive || saving}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
                                isActive
                                  ? 'bg-[#E06D00] border-[#E06D00] text-white'
                                  : 'border-zinc-200 text-zinc-600 hover:border-[#E06D00] hover:text-[#E06D00]'
                              }`}
                            >
                              {saving && isActive ? '...' : method}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {isPending && (
                    <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                      Venta guardada sin conexión. Se sube sola al volver internet y aparece acá como normal.
                    </p>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-zinc-900">
                      Total: {formatCurrency(sale.total_amount)}
                    </span>
                    <button
                      onClick={() => onReprint(sale)}
                      className="flex items-center gap-1.5 text-sm font-semibold text-[#E06D00] bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reimprimir ticket
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
