import { FormEvent, useState } from 'react';
import { Category, CategoryFormData } from '../types';
import ModalShell from './ModalShell';

interface CategoryModalProps {
  category: Category | null; // null = alta, con valor = edición
  nextDisplayOrder: number;
  onClose: () => void;
  onSave: (data: CategoryFormData) => Promise<void>;
}

export default function CategoryModal({ category, nextDisplayOrder, onClose, onSave }: CategoryModalProps) {
  const [form, setForm] = useState<CategoryFormData>(
    category
      ? { name: category.name, display_order: category.display_order, is_active: category.is_active }
      : { name: '', display_order: nextDisplayOrder, is_active: true }
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={category ? 'Editar categoría' : 'Nueva categoría'} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombre</label>
          <input
            autoFocus
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ej: Cervezas"
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Orden de visualización</label>
          <input
            type="number"
            value={form.display_order}
            onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
            className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
          />
        </div>

        <label className="flex items-center gap-2 mb-4 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            className="rounded border-zinc-300 text-[#E06D00] focus:ring-[#E06D00]/40"
          />
          Categoría activa (visible en el catálogo)
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
        >
          {saving ? 'Guardando...' : category ? 'Guardar cambios' : 'Crear categoría'}
        </button>
      </form>
    </ModalShell>
  );
}
