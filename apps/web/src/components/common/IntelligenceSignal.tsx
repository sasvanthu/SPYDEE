import React from 'react';
import { ArrowRight, ShieldAlert, Cpu } from 'lucide-react';

export interface IntelligenceSignalProps {
  title?: string;
  sourceLabel?: string;
  targetLabel?: string;
  confidence?: number | string;
  evidenceCount?: number | string;
  status?: string;
  variant?: 'amber' | 'alert' | 'verified';
  onClick?: () => void;
  className?: string;
}

export const IntelligenceSignal: React.FC<IntelligenceSignalProps> = ({
  title = 'HIDDEN LINK DETECTED',
  sourceLabel = 'E-004',
  targetLabel = 'E-008',
  confidence = '67%',
  evidenceCount = '03',
  status = 'REVIEW',
  variant = 'amber',
  onClick,
  className = ''
}) => {
  const borderColor = 
    variant === 'alert' 
      ? 'border-red-500/60 bg-red-950/20 text-red-400' 
      : variant === 'verified'
      ? 'border-emerald-500/60 bg-emerald-950/20 text-emerald-400'
      : 'border-amber-500/60 bg-amber-950/20 text-amber-400';

  const glowClass = variant === 'alert' ? 'shadow-[0_0_10px_rgba(239,68,68,0.25)]' : 'shadow-[0_0_10px_rgba(245,158,11,0.25)]';

  return (
    <div 
      onClick={onClick}
      className={`font-mono text-xs border ${borderColor} ${glowClass} p-3 select-none relative group cursor-pointer transition-all hover:bg-opacity-40 ${className}`}
    >
      {/* Corner bracket markers */}
      <span className="absolute -top-[1px] -left-[1px] w-1.5 h-1.5 border-t-2 border-l-2 border-current pointer-events-none" />
      <span className="absolute -top-[1px] -right-[1px] w-1.5 h-1.5 border-t-2 border-r-2 border-current pointer-events-none" />
      <span className="absolute -bottom-[1px] -left-[1px] w-1.5 h-1.5 border-b-2 border-l-2 border-current pointer-events-none" />
      <span className="absolute -bottom-[1px] -right-[1px] w-1.5 h-1.5 border-b-2 border-r-2 border-current pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-current/20">
        <div className="flex items-center gap-1.5 font-bold tracking-wider text-[11px]">
          <Cpu className="w-3.5 h-3.5 animate-pulse" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 border border-current/40 uppercase tracking-widest font-semibold">
          AI SIGNAL
        </span>
      </div>

      {/* Node relation arrow */}
      <div className="py-2 flex items-center justify-center gap-3 text-sm font-bold tracking-wider bg-black/40 border border-current/20 my-2">
        <span className="px-2 py-0.5 bg-black/60 border border-current/30 text-amber-300">{sourceLabel}</span>
        <span className="text-amber-400 flex items-center gap-1">
          ↝
        </span>
        <span className="px-2 py-0.5 bg-black/60 border border-current/30 text-amber-300">{targetLabel}</span>
      </div>

      {/* Metrics breakdown */}
      <div className="space-y-1 text-[11px] pt-1">
        <div className="flex justify-between items-center">
          <span className="text-amber-500/70">CONFIDENCE:</span>
          <span className="font-bold tracking-wider">{typeof confidence === 'number' ? `${Math.round(confidence * 100)}%` : confidence}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-amber-500/70">EVIDENCE:</span>
          <span className="font-bold tracking-wider">{evidenceCount}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-amber-500/70">STATUS:</span>
          <span className="font-bold tracking-wider px-1 bg-amber-500/20 text-amber-300 border border-amber-500/40">{status}</span>
        </div>
      </div>

      {/* Action cue */}
      <div className="mt-2 pt-1 border-t border-current/20 flex items-center justify-between text-[10px] text-amber-400/80 group-hover:text-amber-300">
        <span className="tracking-widest">[CLICK TO INSPECT PATH]</span>
        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </div>
  );
};
