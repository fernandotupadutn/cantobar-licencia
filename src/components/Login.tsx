import { FormEvent, useState } from 'react';
import { Martini, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError('Email o contraseña incorrectos.');
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F4F5] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#E06D00] flex items-center justify-center mb-3">
            <Martini className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900">CantoBar</h1>
          <p className="text-sm text-zinc-500">Iniciá sesión para continuar</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-zinc-200 p-6">
          <div className="mb-4">
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@cantobar.com"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            />
          </div>

          <div className="mb-5">
            <label className="block text-xs font-semibold text-zinc-500 mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full border border-zinc-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#E06D00]/40"
            />
          </div>

          {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#E06D00] hover:bg-[#D97706] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <p className="text-xs text-zinc-400 text-center mt-4">
          ¿No tenés cuenta? Pedile a un administrador que te dé de alta desde "Gestión de usuarios".
        </p>
      </div>
    </div>
  );
}
