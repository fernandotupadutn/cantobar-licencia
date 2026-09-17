import { CloudOff, RefreshCw, Wifi } from 'lucide-react';

interface OfflineSyncBannerProps {
  isElectron: boolean;
  isOnline: boolean;
  pendingCount: number;
  syncing: boolean;
  errorMessage?: string;
  onSync: () => void;
}

// Solo se muestra en la app de escritorio. Avisa que no hay conexión o
// que hay ventas guardadas localmente esperando sincronizarse.
export default function OfflineSyncBanner({
  isElectron,
  isOnline,
  pendingCount,
  syncing,
  errorMessage,
  onSync,
}: OfflineSyncBannerProps) {
  if (!isElectron) return null;

  if (pendingCount > 0) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,380px)] rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 shadow-2xl p-4">
        <div className="flex items-center gap-3">
          <Wifi className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold">
              {pendingCount} {pendingCount === 1 ? 'venta pendiente' : 'ventas pendientes'} de sincronizar
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Se guardaron localmente. Se suben solas cuando vuelva la conexión.
            </p>
          </div>
          <button
            onClick={onSync}
            disabled={syncing || !isOnline}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold px-3 py-2 shrink-0 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar
          </button>
        </div>
        {errorMessage && (
          <p className="mt-3 text-xs bg-amber-100 rounded-lg px-3 py-2">
            No se pudo sincronizar: {errorMessage}
          </p>
        )}
        {!isOnline && (
          <p className="mt-3 text-xs bg-amber-100 rounded-lg px-3 py-2">
            Sin conexión: se intentará de nuevo automáticamente.
          </p>
        )}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-[60] w-[min(92vw,320px)] rounded-2xl bg-zinc-900 text-white shadow-2xl p-4 flex items-center gap-3">
        <CloudOff className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <p className="text-sm font-bold">Sin conexión</p>
          <p className="text-xs text-zinc-400 mt-0.5">Las ventas se guardan y sincronizan solas.</p>
        </div>
      </div>
    );
  }

  return null;
}