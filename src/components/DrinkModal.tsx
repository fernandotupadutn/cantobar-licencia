import { FormEvent, useState } from 'react';
import { Category, Drink, DrinkFormData } from '../types';
import ModalShell from './ModalShell';

interface DrinkModalProps {
  drink: Drink | null; // null = alta, con valor = edición
  categories: Category[];
  defaultCategoryId?: string;
  onClose: () => void;
  onSave: (data: DrinkFormData) => Promise<void>;
}

export default function DrinkModal({ drink, categories, defaultCategoryId, onClose, onSave }: DrinkModalProps) {
  const [form, setForm] = useState<DrinkFormData>(
    drink
      ? {
          category_id: drink.category_id,
          name: drink.name,
          description: drink.description,
          price: drink.price,
          is_available: drink.is_available,
        }
      : {
          category_id: defaultCategoryId ?? categories[0]?.id ?? '',
          name: '',
          description: '',
          price: 0,
          is_available: true,
        }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.category_id) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={drink ? 'Editar bebida' : 'Nueva bebida'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Categoría</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombre</label>
          <input
            autoFocus
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Fernet con coca"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Descripción / formato</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ej: Botella 500ml"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Precio</label>
          <input
            type="number"
            min={0}
            step={1}
            value={form.price}
            onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={form.is_available}
            onChange={(e) => setForm({ ...form, is_available: e.target.checked })}
            className="rounded border-zinc-300 text-[#E06D00] focus:ring-[#E06D00]/40"
          />
          Disponible para la venta
        </label>

        <button
          type="submit"
          disabled={saving || categories.length === 0}
          className="w-full bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
        >
          {saving ? 'Guardando...' : drink ? 'Guardar cambios' : 'Crear bebida'}
        </button>
        {categories.length === 0 && (
          <p className="text-xs text-red-500 mt-2">Creá primero una categoría para poder cargar bebidas.</p>
        )}
      </form>
    </ModalShell>
  );
}
