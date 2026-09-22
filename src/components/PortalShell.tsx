import React, { useEffect } from 'react';
import { LogOut, ArrowLeft, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

interface PortalShellProps {
  requiredRole: 'admin' | 'staff' | 'delivery';
  portalTitle: string;
  portalSubtitle: string;
  portalBadge: string;
  portalColor: 'amber' | 'indigo' | 'cyan';
  loginPath: string;
  children: React.ReactNode;
}

export const PortalShell: React.FC<PortalShellProps> = ({
  requiredRole,
  portalTitle,
  portalSubtitle,
  portalBadge,
  portalColor,
  loginPath,
  children,
}) => {
  const { user, isLoading, logout } = useAuth();
  const { navigate } = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user || user.role !== requiredRole) {
        navigate(loginPath);
      }
    }
  }, [user, isLoading, requiredRole, loginPath, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-xs font-semibold">
        Validating secure portal credentials...
      </div>
    );
  }

  if (!user || user.role !== requiredRole) {
    return null;
  }

  const handleLogout = () => {
    logout();
    navigate(loginPath);
  };

  const getThemeStyles = () => {
    switch (portalColor) {
      case 'amber':
        return {
          navBg: 'bg-slate-950 border-slate-800 text-white',
          badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          logoBg: 'bg-amber-500 text-slate-950',
          btnHover: 'hover:bg-slate-900 text-slate-400 hover:text-white',
        };
      case 'indigo':
        return {
          navBg: 'bg-slate-900 border-slate-800 text-white',
          badge: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300',
          logoBg: 'bg-indigo-600 text-white',
          btnHover: 'hover:bg-slate-800 text-slate-300 hover:text-white',
        };
      case 'cyan':
      default:
        return {
          navBg: 'bg-slate-900 border-slate-800 text-white',
          badge: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300',
          logoBg: 'bg-cyan-500 text-slate-950',
          btnHover: 'hover:bg-slate-800 text-slate-300 hover:text-white',
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Dedicated Portal Top Bar */}
      <header className={`sticky top-0 z-40 border-b ${theme.navBg}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
          {/* Left: Portal Identity */}
          <div className="flex items-center gap-3">
            <div className={`px-2.5 py-1 rounded-xl font-black text-xs ${theme.logoBg}`}>
              DrinkIt
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm tracking-tight">{portalTitle}</span>
                <span className={`px-2 py-0.2 rounded-full border text-[9px] font-black uppercase tracking-wider ${theme.badge}`}>
                  {portalBadge}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                {portalSubtitle}
              </p>
            </div>
          </div>

          {/* Right: User Profile & Secure Sign Out */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-right">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold leading-tight">{user.name}</div>
                <div className="text-[10px] text-slate-400 capitalize">{user.role} Account</div>
              </div>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block" />

            <button
              onClick={() => navigate('/')}
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-xl transition-colors ${theme.btnHover} flex items-center gap-1.5`}
              title="Return to Customer Storefront"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Storefront</span>
            </button>

            <button
              onClick={handleLogout}
              className="text-xs font-bold px-3 py-1.5 rounded-xl bg-rose-950/60 border border-rose-800/80 hover:bg-rose-900/60 text-rose-300 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Portal Content */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
};
