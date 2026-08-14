import { FormEvent, useEffect, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Profile, UserRole } from '../types';

export default function UsersManagement() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Alta de usuario nuevo
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState<UserRole>('vendedor');
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    setLoading(true);
    const { data, error } = await supabase.from('profiles').select('*').order('full_name', { ascending: true });
    if (error) {
      console.error('Error cargando usuarios:', error.message);
    } else {
      setProfiles((data ?? []) as Profile[]);
    }
    setLoading(false);
  }

  async function changeRole(profile: Profile, role: UserRole) {
    setSavingId(profile.id);
    const { error } = await supabase.from('profiles').update({ role }).eq('id', profile.id);
    if (error) {
      console.error(error);
      alert('No se pudo actualizar el rol.');
    } else {
      setProfiles((prev) => prev.map((p) => (p.id === profile.id ? { ...p, role } : p)));
    }
    setSavingId(null);
  }

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviteError(null);

    if (invitePassword.length < 8) {
      setInviteError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setInviting(true);

    // El alta se hace en el servidor vía la Edge Function "create-user",
    // que usa auth.admin.createUser(). Así funciona aunque el signup
    // público esté desactivado, y no reemplaza la sesión del admin.
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: inviteEmail,
        password: invitePassword,
        full_name: inviteName,
        role: inviteRole,
      },
    });

    if (error) {
      setInviteError(await readErrorMessage(error));
      setInviting(false);
      return;
    }

    setInviting(false);
    setShowInvite(false);
    setInviteEmail('');
    setInvitePassword('');
    setInviteName('');
    setInviteRole('vendedor');
    loadProfiles();
  }

  async function readErrorMessage(error: unknown): Promise<string> {
    if (typeof error === 'object' && error !== null && 'context' in error) {
      const res = (error as { context: Response }).context;
      try {
        const body = await res.json();
        if (body?.error) return body.error;
      } catch {
        // respuesta sin cuerpo JSON: usamos el mensaje genérico
      }
    }
    return 'No se pudo crear el usuario. Verificá la conexión y volvé a intentar.';
  }

  if (loading) {
    return <p className="text-sm text-zinc-400 py-10 text-center">Cargando usuarios...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-zinc-900">Usuarios</h3>
        <button
          onClick={() => setShowInvite((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-semibold text-[#E06D00] bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg"
        >
          <UserPlus className="w-4 h-4" />
          Nuevo usuario
        </button>
      </div>

      {showInvite && (
        <form
          onSubmit={handleInvite}
          className="bg-white rounded-2xl border border-zinc-200 p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Nombre completo</label>
            <input
              required
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Email</label>
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Contraseña provisoria</label>
            <input
              type="password"
              required
              minLength={8}
              value={invitePassword}
              onChange={(e) => setInvitePassword(e.target.value)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Rol</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          {inviteError && <p className="text-sm text-red-600 sm:col-span-2">{inviteError}</p>}

          <button
            type="submit"
            disabled={inviting}
            className="sm:col-span-2 bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {inviting ? 'Creando...' : 'Crear usuario'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 divide-y divide-zinc-100">
        {profiles.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900 text-sm truncate">{p.full_name || '(sin nombre)'}</p>
              <p className="text-xs text-zinc-500 truncate">{p.email}</p>
            </div>
            <select
              value={p.role}
              disabled={savingId === p.id}
              onChange={(e) => changeRole(p, e.target.value as UserRole)}
              className="border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40 shrink-0"
            >
              <option value="vendedor">Vendedor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
        {profiles.length === 0 && (
          <p className="text-sm text-zinc-400 text-center py-8">No hay usuarios cargados todavía.</p>
        )}
      </div>
    </div>
  );
}
