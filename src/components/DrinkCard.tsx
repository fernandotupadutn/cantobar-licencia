import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Drink } from '../types';
import { formatCurrency } from '../lib/format';

interface DrinkCardProps {
  drink: Drink;
  editMode: boolean;
  onAddToCart: (drink: Drink) => void;
  onEdit: (drink: Drink) => void;
  onDelete: (drink: Drink) => void;
}

export default function DrinkCard({ drink, editMode, onAddToCart, onEdit, onDelete }: DrinkCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-center justify-between gap-3 hover:shadow-sm transition-shadow">
      <div className="min-w-0">
        <p className="font-bold text-zinc-900 truncate">{drink.name}</p>
        {drink.description && (
          <p className="text-xs text-zinc-500 truncate">{drink.description}</p>
        )}
        <p className="text-[#E06D00] font-bold mt-1">{formatCurrency(drink.price)}</p>
        {!drink.is_available && (
          <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            No disponible
          </span>
        )}
      </div>

      {editMode ? (
        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onEdit(drink)}
            aria-label={`Editar ${drink.name}`}
            className="p-2 rounded-full bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(drink)}
            aria-label={`Eliminar ${drink.name}`}
            className="p-2 rounded-full bg-red-50 text-red-600 hover:bg-red-100"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onAddToCart(drink)}
          disabled={!drink.is_available}
          aria-label={`Agregar ${drink.name} al pedido`}
          className="w-10 h-10 shrink-0 rounded-full bg-[#E06D00] text-white flex items-center justify-center hover:bg-[#D97706] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
