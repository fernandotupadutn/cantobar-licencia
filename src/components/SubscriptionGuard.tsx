import { ReactNode, useEffect, useState } from 'react';
import { Loader2, ShieldAlert, WifiOff } from 'lucide-react';
import { adminSupabase } from '../lib/adminSupabaseClient';

type LicenseStatus = 'checking' | 'activo' | 'suspendido' | 'error';

interface SubscriptionGuardProps {
  children: ReactNode;
}

const PROJECT_ID = import.meta.env.VITE_PROJECT_ID as string;

const RECHECK_INTERVAL_MS = 60_000;

// La consulta de licencia no puede quedar colgada sin internet: si no
// responde en este tiempo, se trata como falla de red.
const CHECK_TIMEOUT_MS = 8_000;

// ------------------------------------------------------------
// Fail-open con gracia: si la verificación de licencia FALLA por red
// (no hay internet / el servidor no responde), la app sigue funcionando
// usando la última verificación válida cacheada durante GRACE_DAYS días.
// Solo se bloquea por "suspendido" (respuesta explícita del servidor)
// o si nunca pudo verificarse y tampoco hay cache válido.
// ------------------------------------------------------------
const GRACE_DAYS = 7;

interface LicenseCache {
  projectId: string;
  checkedAt: number;
}

const STORAGE_KEY = 'cantobar_license_cache_v1';

function readCache(): LicenseCache | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LicenseCache;
    if (parsed && parsed.projectId === PROJECT_ID && typeof parsed.checkedAt === 'number') {
      return parsed;
    }
  } catch {
    // Cache corrupto: se ignora.
  }
  return null;
}

function isCacheValid(cache: LicenseCache | null): boolean {
  if (!cache) return false;
  const validUntil = cache.checkedAt + GRACE_DAYS * 24 * 60 * 60 * 1000;
  return Date.now() <= validUntil;
}

function saveCache(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ projectId: PROJECT_ID, checkedAt: Date.now() }));
  } catch {
    // Sin storage disponible: no se cachea, no es un error fatal.
  }
}

function clearCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ídem.
  }
}

// Rechaza con un error claro si la promesa no resuelve en ms.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const [status, setStatus] = useState<LicenseStatus>('checking');
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Sin forma de verificar (sin cache vigente), el app se bloquea.
    function failCheck() {
      if (!cancelled) setStatus('error');
    }

    // Atajo sin red: el navegador ya sabe que no hay conexión, no
    // esperamos al timeout del fetch (que puede tardar).
    function applyOfflineFallback() {
      if (isCacheValid(readCache())) {
        if (!cancelled) {
          setStatus('activo');
          setDegraded(true);
        }
      } else {
        failCheck();
      }
    }

    async function checkLicense() {
      if (!PROJECT_ID) {
        // eslint-disable-next-line no-console
        console.error('Falta VITE_PROJECT_ID en el .env: no se puede validar la licencia.');
        failCheck();
        return;
      }

      if (navigator.onLine === false) {
        applyOfflineFallback();
        return;
      }

      let data: { status: string } | null = null;
      let error: { message: string } | null = null;
      try {
        // Timeout para no quedarnos en "Verificando licencia..." con la
        // red cortada: la consulta se cancela sola y cae en el fallback.
        const res = await withTimeout(
          adminSupabase.from('projects').select('status').eq('id', PROJECT_ID).maybeSingle(),
          CHECK_TIMEOUT_MS
        );
        data = (res.data ?? null) as { status: string } | null;
        error = res.error;
      } catch (err) {
        error = { message: err instanceof Error ? err.message : String(err) };
      }

      if (cancelled) return;

      // El servidor respondió y la licencia está activa: refrescamos el cache.
      if (data && data.status === 'activo') {
        saveCache();
        setStatus('activo');
        setDegraded(false);
        return;
      }

      // El servidor respondió explícitamente "suspendido": se bloquea
      // sí o sí y se invalida el cache para que un reload no lo bypassee.
      if (data && data.status !== 'activo') {
        clearCache();
        setStatus('suspendido');
        setDegraded(false);
        return;
      }

      // No pudimos verificar (error, timeout o fila inexistente): solo
      // seguimos si hay un cache de gracia vigente (fail-open con gracia).
      if (error && isCacheValid(readCache())) {
        setStatus('activo');
        setDegraded(true);
        return;
      }

      if (error) {
        // eslint-disable-next-line no-console
        console.error('Error verificando la licencia:', error.message);
      } else {
        // eslint-disable-next-line no-console
        console.error('No se encontró ningún proyecto con ese ID en la tabla "projects".');
      }
      failCheck();
    }

    // Chequeo inicial + re-chequeo periódico: si la suscripción se
    // suspende con la app abierta, se bloquea en menos de un minuto.
    checkLicense();
    const interval = setInterval(checkLicense, RECHECK_INTERVAL_MS);

    // Re-chequeo también cuando la ventana recupera el foco o la
    // conexión vuelve (así la franja ámbar desaparece sola).
    const handleVisibility = () => {
      if (!document.hidden) checkLicense();
    };
    const handleOnline = () => checkLicense();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('online', handleOnline);
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
  // Error de validación sin gracia (sin proyecto configurado, fila
  // inexistente, cache expirado, etc.): se bloquea para no operar
  // con una licencia que no se pudo validar.
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
            Hubo un problema de conexión al validar la suscripción y no hay una verificación guardada vigente.
            Intentá recargar la página en unos minutos o contactá al administrador si el problema persiste.
          </p>
        </div>
      </div>
    );
  }

  // status === 'activo'
  return (
    <>
      {degraded && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-800 flex items-center gap-2 justify-center">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          Sin conexión con el servidor de licencias: usando la última verificación guardada. Podés seguir operando.
        </div>
      )}
      {children}
    </>
  );
}
