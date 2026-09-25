import React, { useState, useEffect } from 'react';
import { Info, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import { api } from '../services/api.ts';
import { PlatformComplianceSettings } from '../types.ts';

export const ResponsibleBanner: React.FC = () => {
  const [compliance, setCompliance] = useState<PlatformComplianceSettings | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .get<PlatformComplianceSettings>('/compliance')
      .then(res => {
        if (isMounted && res) {
          setCompliance(res);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  if (compliance?.dryDayActive) {
    return (
      <div className="bg-rose-600 text-white py-1.5 px-3 sm:px-4 text-xs font-semibold shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0 animate-pulse" />
            <span>
              <strong>STATUTORY DRY DAY:</strong> Alcohol sales & dispatch paused in the active jurisdiction (
              {compliance.dryDayReason || 'Excise Order'}). Non-alcoholic beverages & bar snacks remain open.
            </span>
          </div>
          <span className="text-[10px] tracking-wider uppercase font-bold bg-white/20 px-2 py-0.5 rounded-full">
            State Excise Lockout Active
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100/90 border-b border-slate-200/80 text-slate-600 py-1 px-3 sm:px-4 text-[11px] transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">
            <span className="font-semibold text-slate-700">Excise Notice:</span>{' '}
            {compliance?.jurisdiction ? `${compliance.jurisdiction} • ` : ''}
            Legal age {compliance?.legalDrinkingAge || 21}+. Govt photo ID mandatory at doorstep.
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3 text-slate-500 text-[10px] shrink-0 font-medium">
          {compliance?.operatingHoursOnly && (
            <span className="flex items-center gap-1 text-slate-600 font-semibold">
              <Clock className="w-3 h-3 text-amber-600" />
              <span>
                Hours: {compliance.operatingHoursStart || '10:00'} - {compliance.operatingHoursEnd || '22:30'}
              </span>
            </span>
          )}
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            <span>Lic: {compliance?.exciseLicenseNumber || 'CONFIGURE_PER_LICENSED_STORE'}</span>
          </span>
          <span className="text-slate-400 font-bold">•</span>
          <span className="text-emerald-800 font-bold uppercase tracking-wider">
            Be Safe — Don&apos;t Drink & Drive
          </span>
        </div>
      </div>
    </div>
  );
};
