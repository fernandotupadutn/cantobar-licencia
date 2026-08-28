import { ShoppingCart, Trash2 } from 'lucide-react';
import { CartItem, PaymentMethod } from '../types';
import { formatCurrency } from '../lib/format';
import CartItemRow from './CartItemRow';

interface CartProps {
  items: CartItem[];
  isCharging: boolean;
  onIncrement: (drinkId: string) => void;
  onDecrement: (drinkId: string) => void;
  onRemove: (drinkId: string) => void;
  onClear: () => void;
  onCheckout: (method: PaymentMethod) => void;
  onMercadoPago: () => void;
}

export default function Cart({
  items,
  isCharging,
  onIncrement,
  onDecrement,
  onRemove,
  onClear,
  onCheckout,
  onMercadoPago,
}: CartProps) {
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0);
  const total = items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0);
  const isEmpty = items.length === 0;

  return (
    <aside className="bg-white rounded-2xl border border-zinc-200 flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-zinc-100">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-[18px] h-[18px] text-zinc-700" />
          <h2 className="font-bold text-zinc-900">Pedido actual</h2>
          <span className="min-w-[1.5rem] h-6 px-1.5 rounded-full bg-amber-400 text-white text-xs font-bold flex items-center justify-center">
            {totalItems}
          </span>
        </div>
        <button
          onClick={onClear}
          disabled={isEmpty}
          aria-label="Vaciar carrito"
          className="p-2 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {isEmpty ? (
          <div className="h-full flex items-center justify-center text-center py-10">
            <p className="text-sm text-zinc-400">
              Todavía no agregaste tragos.
              <br />
              Tocá el botón <span className="font-semibold text-[#E06D00]">+</span> de un producto para empezar.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <CartItemRow
              key={item.drink_id}
              item={item}
              onIncrement={onIncrement}
              onDecrement={onDecrement}
              onRemove={onRemove}
            />
          ))
        )}
      </div>

      <div className="px-4 py-4 border-t border-zinc-100">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-zinc-500">Total</span>
          <span className="text-3xl font-extrabold text-zinc-900">{formatCurrency(total)}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onCheckout('Efectivo')}
            disabled={isEmpty || isCharging}
            className="bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            Contado
          </button>
          <button
            onClick={() => onCheckout('Transferencia')}
            disabled={isEmpty || isCharging}
            className="bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            Transferencia
          </button>
        </div>

        <button
          onClick={onMercadoPago}
          disabled
          title="Próximamente"
          className="mt-2 w-full border-2 border-zinc-200 text-zinc-400 font-bold py-3 rounded-xl transition-colors cursor-not-allowed"
        >
          Mercado Pago (QR) — No disponible
        </button>

        <p className="text-xs text-zinc-400 text-center mt-3">
          Cobrá con el método elegido para generar el ticket
        </p>
      </div>
    </aside>
  );
}
