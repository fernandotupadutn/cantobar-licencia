import { useState } from 'react';
import { ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { SaleWithItems } from '../types';
import { formatCurrency, formatDateTime, shortTicketNumber } from '../lib/format';

interface SalesHistoryProps {
  sales: SaleWithItems[];
  loading: boolean;
  onReprint: (sale: SaleWithItems) => void;
}

export default function SalesHistory({ sales, loading, onReprint }: SalesHistoryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (loading) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando historial de ventas...</p>;
  }

  if (sales.length === 0) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Todavía no hay ventas registradas.</p>;
  }

  return (
    <div className="space-y-3">
      {sales.map((sale) => {
        const isOpen = expandedId === sale.id;
        const isCash = sale.payment_method === 'Efectivo';

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
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 ${
                    isCash ? 'bg-emerald-50 text-emerald-700' : 'bg-sky-50 text-sky-700'
                  }`}
                >
                  {sale.payment_method}
                </span>
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

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
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
            )}
          </div>
        );
      })}
    </div>
  );
}
