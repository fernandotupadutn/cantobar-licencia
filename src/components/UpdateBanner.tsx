import { useEffect, useState } from 'react';
import { Download, RefreshCw, XCircle } from 'lucide-react';

type UpdateStatusPayload =
  | { type: 'checking' }
  | { type: 'available'; version: string }
  | { type: 'not-available' }
  | { type: 'error'; message: string }
  | { type: 'downloading'; percent: number; bytesPerSecond: number; transferred: number; total: number }
  | { type: 'downloaded'; version: string };

export default function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatusPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const api = window.electronAPI?.updater;
    if (!api) return;
    const off = api.onStatus(setStatus);
    // Lanza la verificación automática al montar la app de escritorio.
    api.check();
    return off;
  }, []);

  if (!status || dismissed) return null;

  if (status.type === 'downloading') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,380px)] rounded-2xl bg-zinc-900 text-white shadow-2xl p-4">
        <div className="flex items-center gap-3">
          <Download className="w-5 h-5 text-[#E06D00] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Descargando actualización…</p>
            <p className="text-xs text-zinc-400 mt-0.5">{status.percent}%</p>
          </div>
          <span className="text-lg font-bold text-[#E06D00]">{status.percent}%</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-zinc-700 overflow-hidden">
          <div
            className="h-full bg-[#E06D00] rounded-full transition-all duration-300"
            style={{ width: `${status.percent}%` }}
          />
        </div>
      </div>
    );
  }

  if (status.type === 'available') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,380px)] rounded-2xl bg-zinc-900 text-white shadow-2xl p-4">
        <p className="text-sm font-semibold">
          Hay una nueva versión disponible ({status.version})
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => window.electronAPI?.updater.download()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#E06D00] hover:bg-[#D97706] text-white text-sm font-semibold py-2 transition-colors"
          >
            <Download className="w-4 h-4" /> Descargar
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <XCircle className="w-4 h-4" /> Ahora no
          </button>
        </div>
      </div>
    );
  }

  if (status.type === 'downloaded') {
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] w-[min(92vw,380px)] rounded-2xl bg-zinc-900 text-white shadow-2xl p-4">
        <p className="text-sm font-semibold">Actualización lista para instalar.</p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => window.electronAPI?.updater.install()}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-[#E06D00] hover:bg-[#D97706] text-white text-sm font-semibold py-2 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reiniciar y actualizar
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-semibold px-4 py-2 transition-colors"
          >
            <XCircle className="w-4 h-4" /> Más tarde
          </button>
        </div>
      </div>
    );
  }

  return null;
}
