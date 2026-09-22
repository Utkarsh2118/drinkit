import React, { useState } from 'react';
import { Truck, ShieldCheck, ArrowRight, RefreshCw, AlertCircle, KeyRound, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { useRouter } from '../context/RouterContext.tsx';

export const DeliveryLoginView: React.FC = () => {
  const { deliveryLogin } = useAuth();
  const { navigate } = useRouter();

  const [agentId, setAgentId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentId.trim() || !password) {
      setErrorMessage('Please enter Rider ID / Mobile and PIN/Password');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await deliveryLogin(agentId.trim(), password);
      navigate('/delivery/dashboard');
    } catch (err: any) {
      setErrorMessage(err.message || 'Access Denied: Invalid Delivery Partner credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const autofillRider = () => {
    setAgentId('delivery@drinkit.demo');
    setPassword('delivery123');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      {/* Back to store */}
      <button
        onClick={() => navigate('/')}
        className="mb-8 inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Customer Storefront</span>
      </button>

      {/* Delivery Login Card */}
      <div className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-3xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-inner">
            <Truck className="w-7 h-7" />
          </div>
          <div className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-2">
            Rider Operations
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">DrinkIt Delivery Partner</h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
            Order pickups, doorstep 21+ physical ID check & OTP verification
          </p>
        </div>

        {errorMessage && (
          <div className="mb-6 p-3.5 rounded-2xl bg-rose-950/70 border border-rose-800 text-rose-300 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Rider ID / Registered Mobile
            </label>
            <input
              type="text"
              value={agentId}
              onChange={e => setAgentId(e.target.value)}
              placeholder="delivery@drinkit.demo or 9876543212"
              required
              className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm font-semibold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">
              Rider PIN / Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
              className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-white placeholder:text-slate-500 text-sm font-semibold focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !agentId.trim() || !password}
            className="w-full py-3.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 font-black text-sm tracking-wide transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 cursor-pointer"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Launch Rider Shift</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          <div className="pt-3 border-t border-slate-700">
            <button
              type="button"
              onClick={autofillRider}
              className="w-full py-2.5 px-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 text-xs font-bold transition-colors flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Autofill Rider Credentials (delivery@drinkit.demo)</span>
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-700 text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Geo-Fenced Active Shift & Dispatch Tracking</span>
          </p>
        </div>
      </div>
    </div>
  );
};
