// ============================================================
// Caché offline liviana (localStorage).
//
// Guarda copias de los datos que se consultan a Supabase para que
// la app siga funcionando sin internet (perfil, catálogo, caja
// abierta). Es solo de LECTURA: los cambios siguen yendo por red.
// ============================================================

const PREFIX = 'cantobar_cache_';

export function cacheSave(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (err) {
    console.error('No se pudo cachear', key, err);
  }
}

export function cacheRead<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function cacheClear(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // Sin storage: no es un error fatal.
  }
}

// Prefijo para el perfil del usuario logueado (un clave por usuario).
export const profileCacheKey = (userId: string) => `profile:${userId}`;