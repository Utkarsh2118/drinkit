import React, { useState } from 'react';
import { X, Lock, Shield, UserCheck, AlertCircle, RefreshCw, KeyRound, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface AdminLoginModalProps {
  onSuccess?: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ onSuccess }) => {
  const { isAdminAuthModalOpen, setIsAdminAuthModalOpen, adminLogin } = useAuth();

  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isAdminAuthModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId.trim() || !password.trim()) {
      setErrorMessage('Please enter both Admin ID and Password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    try {
      await adminLogin(adminId.trim(), password);
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid administrator credentials. Access restricted.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutofillDemoAdmin = () => {
    setAdminId('admin@drinkit.demo');
    setPassword('admin123');
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-black tracking-tight">DrinkIt Admin Portal</div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Restricted Operational Access
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsAdminAuthModalOpen(false)}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900">Administrator Sign In</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter authorized administrator credentials to manage catalog, inventory, and stores.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin ID / Email
              </label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-emerald-600 focus-within:bg-white transition-colors">
                <UserCheck className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  value={adminId}
                  onChange={e => setAdminId(e.target.value)}
                  placeholder="admin@drinkit.demo or admin ID"
                  required
                  autoFocus
                  className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin Password
              </label>
              <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 focus-within:border-emerald-600 focus-within:bg-white transition-colors">
                <KeyRound className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-transparent text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !adminId.trim() || !password.trim()}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-xs tracking-wide shadow-md transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Authenticate Admin Session</span>
                </>
              )}
            </button>
          </form>

          {/* Quick Helper for Reviewer Testing */}
          <div className="pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAutofillDemoAdmin}
              className="w-full py-2 px-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors text-center flex items-center justify-center gap-1.5"
            >
              <span>🔑 Autofill Demo Admin Credentials</span>
            </button>
            <div className="text-[10px] text-slate-400 text-center mt-1">
              Admin ID: admin@drinkit.demo • Password: admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
