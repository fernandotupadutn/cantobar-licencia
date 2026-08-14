import { Pencil, Trash2, Plus } from 'lucide-react';
import { Category, Drink } from '../types';
import DrinkCard from './DrinkCard';

interface CategorySectionProps {
  category: Category;
  drinks: Drink[];
  editMode: boolean;
  onAddToCart: (drink: Drink) => void;
  onEditDrink: (drink: Drink) => void;
  onDeleteDrink: (drink: Drink) => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onAddDrinkToCategory: (category: Category) => void;
}

export default function CategorySection({
  category,
  drinks,
  editMode,
  onAddToCart,
  onEditDrink,
  onDeleteDrink,
  onEditCategory,
  onDeleteCategory,
  onAddDrinkToCategory,
}: CategorySectionProps) {
  if (drinks.length === 0 && !editMode) return null;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-5 bg-orange-600 rounded-full" />
          <h2 className="text-base font-bold text-zinc-800">{category.name}</h2>
        </div>

        {editMode && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onAddDrinkToCategory(category)}
              className="flex items-center gap-1 text-xs font-semibold text-[#E06D00] bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Bebida
            </button>
            <button
              onClick={() => onEditCategory(category)}
              aria-label={`Editar categoría ${category.name}`}
              className="p-1.5 rounded-lg bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onDeleteCategory(category)}
              aria-label={`Eliminar categoría ${category.name}`}
              className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {drinks.map((drink) => (
          <DrinkCard
            key={drink.id}
            drink={drink}
            editMode={editMode}
            onAddToCart={onAddToCart}
            onEdit={onEditDrink}
            onDelete={onDeleteDrink}
          />
        ))}
        {drinks.length === 0 && editMode && (
          <p className="text-sm text-zinc-400 italic">Sin bebidas en esta categoría todavía.</p>
        )}
      </div>
    </section>
  );
}
