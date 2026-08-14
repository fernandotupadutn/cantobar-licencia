import { FormEvent, useState } from 'react';
import { LocalConfig, LocalConfigFormData } from '../types';
import ReportsPanel from './ReportsPanel';
import UsersManagement from './UsersManagement';

type AdminTab = 'reports' | 'config' | 'users';

interface AdminPanelProps {
  localConfig: LocalConfig | null;
  onSaveLocalConfig: (data: LocalConfigFormData) => Promise<void>;
}

const emptyForm: LocalConfigFormData = {
  name: '',
  subtitle: '',
  address: '',
  phone: '',
  cuit: '',
  ticket_footer_message: '',
};

export default function AdminPanel({ localConfig, onSaveLocalConfig }: AdminPanelProps) {
  const [tab, setTab] = useState<AdminTab>('reports');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex gap-2 mb-5 border-b border-zinc-200">
        {(
          [
            ['reports', 'Ganancias'],
            ['config', 'Configuración del local'],
            ['users', 'Usuarios'],
          ] as [AdminTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-[#E06D00] text-[#E06D00]' : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'reports' && <ReportsPanel />}
      {tab === 'config' && <LocalConfigForm localConfig={localConfig} onSave={onSaveLocalConfig} />}
      {tab === 'users' && <UsersManagement />}
    </div>
  );
}

function LocalConfigForm({
  localConfig,
  onSave,
}: {
  localConfig: LocalConfig | null;
  onSave: (data: LocalConfigFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<LocalConfigFormData>(
    localConfig
      ? {
          name: localConfig.name,
          subtitle: localConfig.subtitle,
          address: localConfig.address,
          phone: localConfig.phone,
          cuit: localConfig.cuit,
          ticket_footer_message: localConfig.ticket_footer_message,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const field = (label: string, key: keyof LocalConfigFormData, textarea = false) => (
    <div className="mb-3">
      <label className="block text-xs font-semibold text-zinc-500 mb-1">{label}</label>
      {textarea ? (
        <textarea
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          rows={2}
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
        />
      ) : (
        <input
          type="text"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
        />
      )}
    </div>
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await onSave(form);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-5 max-w-lg">
      {field('Nombre del local', 'name')}
      {field('Subtítulo', 'subtitle')}
      {field('Dirección', 'address')}
      {field('Teléfono', 'phone')}
      {field('CUIT', 'cuit')}
      {field('Mensaje de pie del ticket', 'ticket_footer_message', true)}

      <button
        type="submit"
        disabled={saving}
        className="bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-2.5 px-5 rounded-xl transition-colors"
      >
        {saving ? 'Guardando...' : 'Guardar cambios'}
      </button>
      {saved && <span className="ml-3 text-sm text-emerald-600 font-semibold">Guardado ✓</span>}
    </form>
  );
}
