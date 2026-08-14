import { Minus, Plus, X } from 'lucide-react';
import { CartItem } from '../types';
import { formatCurrency } from '../lib/format';

interface CartItemRowProps {
  item: CartItem;
  onIncrement: (drinkId: string) => void;
  onDecrement: (drinkId: string) => void;
  onRemove: (drinkId: string) => void;
}

export default function CartItemRow({ item, onIncrement, onDecrement, onRemove }: CartItemRowProps) {
  const subtotal = item.unit_price * item.quantity;

  return (
    <div className="flex items-center justify-between gap-2 py-3 border-b border-zinc-100 last:border-b-0">
      <div className="min-w-0">
        <p className="font-semibold text-zinc-900 text-sm truncate">{item.name}</p>
        <p className="text-xs text-zinc-500">{formatCurrency(item.unit_price)} c/u</p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center bg-zinc-100 rounded-lg">
          <button
            onClick={() => onDecrement(item.drink_id)}
            aria-label={`Restar ${item.name}`}
            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <span className="w-6 text-center text-sm font-semibold text-zinc-800">{item.quantity}</span>
          <button
            onClick={() => onIncrement(item.drink_id)}
            aria-label={`Sumar ${item.name}`}
            className="w-7 h-7 flex items-center justify-center text-zinc-600 hover:text-zinc-900"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <span className="font-bold text-zinc-900 text-sm w-16 text-right">
          {formatCurrency(subtotal)}
        </span>

        <button
          onClick={() => onRemove(item.drink_id)}
          aria-label={`Quitar ${item.name} del pedido`}
          className="text-zinc-400 hover:text-red-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
