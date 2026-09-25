import React, { useState, useEffect } from 'react';
import { ShieldCheck, Calendar, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { PlatformComplianceSettings } from '../types.ts';

interface AgeVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AgeVerificationModal: React.FC<AgeVerificationModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, verifyAge } = useAuth();
  const [dob, setDob] = useState(user?.dateOfBirth || '1998-04-12');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [compliance, setCompliance] = useState<PlatformComplianceSettings | null>(null);

  useEffect(() => {
    if (isOpen) {
      api
        .get<PlatformComplianceSettings>('/compliance')
        .then(res => setCompliance(res))
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const minAge = compliance?.legalDrinkingAge || 21;
  const jurisdiction = compliance?.jurisdiction || 'UP + Delhi NCR';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await verifyAge(dob);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || `Age verification failed. You must be at least ${minAge} years old.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-xs shrink-0">
              <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">Age Eligibility Verification</h3>
              <p className="text-[11px] sm:text-xs text-emerald-700 font-semibold">State Excise & Regulatory Compliance</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
            Alcoholic beverages can only be ordered by individuals who have attained the legal drinking age (<strong>{minAge}+ in {jurisdiction}</strong>). Please enter your Date of Birth to verify eligibility.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Enter Date of Birth (as per Government Photo ID)
            </label>
            <div className="relative">
              <input
                type="date"
                required
                max="2005-01-01"
                value={dob}
                onChange={e => setDob(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-emerald-500 font-semibold"
              />
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-[11px] text-slate-500 leading-normal">
            By proceeding, you declare that all information is true and that you will produce original government photo ID (Aadhaar, Passport, DL) to the delivery agent at the time of delivery.
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors disabled:opacity-50 shadow-xs"
            >
              {isSubmitting ? 'Verifying...' : 'Confirm & Verify'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
