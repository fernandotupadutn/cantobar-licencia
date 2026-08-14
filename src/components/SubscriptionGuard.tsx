import { ReactNode, useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { adminSupabase } from '../lib/adminSupabaseClient';

type LicenseStatus = 'checking' | 'activo' | 'suspendido' | 'error';

interface SubscriptionGuardProps {
  children: ReactNode;
}

const PROJECT_ID = import.meta.env.VITE_PROJECT_ID as string;

const RECHECK_INTERVAL_MS = 60_000;

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const [status, setStatus] = useState<LicenseStatus>('checking');

  useEffect(() => {
    let cancelled = false;

    async function checkLicense() {
      if (!PROJECT_ID) {
        // eslint-disable-next-line no-console
        console.error('Falta VITE_PROJECT_ID en el .env: no se puede validar la licencia.');
        if (!cancelled) setStatus('error');
        return;
      }

      const { data, error } = await adminSupabase
        .from('projects')
        .select('status')
        .eq('id', PROJECT_ID)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error verificando la licencia:', error.message);
        setStatus('error');
        return;
      }

      if (!data) {
        // eslint-disable-next-line no-console
        console.error('No se encontró ningún proyecto con ese ID en la tabla "projects".');
        setStatus('error');
        return;
      }

      setStatus(data.status === 'activo' ? 'activo' : 'suspendido');
    }

    // Chequeo inicial + re-chequeo periódico: si la suscripción se
    // suspende con la app abierta, se bloquea en menos de un minuto.
    checkLicense();
    const interval = setInterval(checkLicense, RECHECK_INTERVAL_MS);

    // Re-chequeo también cuando la ventana recupera el foco.
    const handleVisibility = () => {
      if (!document.hidden) checkLicense();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // ------------------------------------------------------------
  // Cargando: overlay sutil, no bloquea con una pantalla completa
  // agresiva mientras se resuelve la consulta (suele tardar <1s).
  // ------------------------------------------------------------
  if (status === 'checking') {
    return (
      <div className="fixed inset-0 z-[9999] bg-white/70 backdrop-blur-sm flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-zinc-500 bg-white px-4 py-2.5 rounded-full shadow-sm border border-zinc-200">
          <Loader2 className="w-4 h-4 animate-spin text-[#E06D00]" />
          Verificando licencia...
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Suspendido: bloqueo total, no se renderizan los children.
  // ------------------------------------------------------------
  if (status === 'suspendido') {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#F4F4F5] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 mb-2">Servicio suspendido</h1>
          <p className="text-sm text-zinc-500">
            Contacte al administrador para regularizar la suscripción y reactivar el sistema.
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------
  // Error de validación (sin conexión, project id inválido, etc.):
  // se bloquea también, por seguridad ("fail closed"). Ver nota en
  // el mensaje de error de más abajo si preferís "fail open".
  // ------------------------------------------------------------
  if (status === 'error') {
    return (
      <div className="fixed inset-0 z-[9999] bg-[#F4F4F5] flex items-center justify-center p-4">
        <div className="max-w-sm w-full text-center bg-white rounded-2xl border border-zinc-200 p-8 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 mb-2">No se pudo verificar la licencia</h1>
          <p className="text-sm text-zinc-500">
            Hubo un problema de conexión al validar la suscripción. Intentá recargar la página en unos minutos o
            contactá al administrador si el problema persiste.
          </p>
        </div>
      </div>
    );
  }

  // status === 'activo'
  return <>{children}</>;
}
