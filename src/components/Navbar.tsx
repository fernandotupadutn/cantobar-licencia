import { Martini, History, ShieldCheck, LogOut } from 'lucide-react';
import { LocalConfig, Profile } from '../types';

export type ActiveView = 'sell' | 'history' | 'admin';

interface NavbarProps {
  localConfig: LocalConfig | null;
  profile: Profile;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onSignOut: () => void;
}

export default function Navbar({ localConfig, profile, activeView, onChangeView, onSignOut }: NavbarProps) {
  const isAdmin = profile.role === 'admin';

  return (
    <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-3 sticky top-0 z-20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-[#E06D00] flex items-center justify-center shrink-0">
            <Martini className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-zinc-900 leading-tight truncate">
              {localConfig?.name ?? 'CantoBar'}
            </h1>
            <p className="text-xs text-zinc-500 leading-tight truncate">
              {localConfig?.subtitle ?? 'Punto de venta'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onChangeView('sell')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeView === 'sell' ? 'bg-[#E06D00] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <Martini className="w-4 h-4" />
            <span className="hidden sm:inline">Vender</span>
          </button>

          <button
            onClick={() => onChangeView('history')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeView === 'history' ? 'bg-[#E06D00] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Historial</span>
          </button>

          {isAdmin && (
            <button
              onClick={() => onChangeView('admin')}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeView === 'admin' ? 'bg-[#E06D00] text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Administración</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-zinc-700 truncate">{profile.full_name || profile.email}</span>
          <span
            className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
              isAdmin ? 'bg-orange-100 text-[#B45309]' : 'bg-zinc-100 text-zinc-600'
            }`}
          >
            {isAdmin ? 'Admin' : 'Vendedor'}
          </span>
        </div>
        <button
          onClick={onSignOut}
          className="flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-red-600"
        >
          <LogOut className="w-3.5 h-3.5" />
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
