import { FormEvent, useState } from 'react';
import { LocalConfig, LocalConfigFormData } from '../types';
import { listQzPrinters } from '../lib/thermalPrint';
import ReportsPanel from './ReportsPanel';
import UsersManagement from './UsersManagement';

type AdminTab = 'reports' | 'config' | 'users';

// El selector de impresora del ticket solo se muestra en el escritorio de
// Windows; en la web no existe la detección por QZ.
const IS_WINDOWS = typeof window !== 'undefined' && window.electronAPI?.platform === 'win32';

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
  printer_name: '',
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
          printer_name: localConfig.printer_name,
        }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [printers, setPrinters] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);
  const [printerError, setPrinterError] = useState<string | null>(null);

  async function detectPrinters() {
    setDetecting(true);
    setPrinterError(null);
    try {
      setPrinters(await listQzPrinters());
    } catch (err) {
      setPrinterError(err instanceof Error ? err.message : String(err));
      setPrinters([]);
    } finally {
      setDetecting(false);
    }
  }

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

      {IS_WINDOWS && (
        <div className="mb-3">
          <label className="block text-xs font-semibold text-zinc-500 mb-1">Impresora del ticket</label>
          <div className="flex items-center gap-2">
            <select
              value={form.printer_name}
              onChange={(e) => setForm({ ...form, printer_name: e.target.value })}
              className="flex-1 border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            >
              <option value="">Predeterminada de Windows</option>
              {form.printer_name && !printers.includes(form.printer_name) && (
                <option value={form.printer_name}>{form.printer_name}</option>
              )}
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={detectPrinters}
              disabled={detecting}
              className="shrink-0 text-sm font-semibold border border-zinc-300 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 py-2 px-3 rounded-lg transition-colors"
            >
              {detecting ? 'Detectando...' : 'Detectar'}
            </button>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Si queda vacío se usa la impresora predeterminada de Windows. Con un nombre, QZ Tray la busca
            entre las instaladas (coincidencia exacta o parcial).
          </p>
          {printerError && <p className="text-xs text-red-600 mt-1">Error: {printerError}</p>}
        </div>
      )}

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
