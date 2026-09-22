import React from 'react';
import { Info, ShieldCheck } from 'lucide-react';

export const ResponsibleBanner: React.FC = () => {
  return (
    <div className="bg-slate-100/90 border-b border-slate-200/80 text-slate-600 py-1 px-3 sm:px-4 text-[11px] transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="truncate">
            <span className="font-semibold text-slate-700">Excise Notice:</span> Age and delivery eligibility checks apply in your area. Valid 21+ photo ID required at delivery.
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1 text-slate-500 text-[10px] shrink-0 font-medium">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          <span>Licensed micro-warehouses • Please consume responsibly</span>
        </div>
      </div>
    </div>
  );
};

