import React, { useState } from 'react';
import { Building2, ShieldCheck, ArrowRight, RefreshCw, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export const StoreLoginView: React.FC = () => {
  const { storeLogin } = useAuth();
  const { navigate } = useRouter();

  const [staffId, setStaffId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffId.trim() || !password) {
      setErrorMessage('Please enter Staff ID and Password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await storeLogin(staffId.trim(), password);
      navigate('/store/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Access Denied: Invalid Store Staff credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillStaff = () => {
    setStaffId('store@drinkit.demo');
    setPassword('store123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center px-4 py-12 text-slate-900">
      {/* Back to store */}
      <button
        onClick={() => navigate('/')}
        className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Customer Storefront</span>
      </button>

      {/* Store Login Card */}
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-8 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-xs">
            <Building2 className="w-7 h-7" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-widest mb-2">
            Store Operations Hub
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">DrinkIt Dark Store Portal</h1>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            Order packing queue, store stock adjustments & dispatch handoff
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Staff ID / Store Email
            </label>
            <input
              type="text"
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
              placeholder="store@drinkit.demo"
              required
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Staff Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 text-sm font-semibold focus:outline-none focus:border-indigo-600 focus:bg-white transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !staffId.trim() || !password}
            className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Access Store Fulfillment Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={autofillStaff}
              className="w-full py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Autofill Store Staff Credentials (store@drinkit.demo)</span>
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Restricted to Authorized Dark-Store Fulfillment Personnel</span>
          </p>
        </div>
      </div>
    </div>
  );
};
