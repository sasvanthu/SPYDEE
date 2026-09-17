import React from 'react';

export interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'sm',
  className = '' 
}) => {
  const norm = (status || '').toUpperCase().trim();

  let colors = 'bg-amber-950/40 text-amber-400 border-amber-500/40';

  if (
    norm === 'ACTIVE' || 
    norm === 'LINKED' || 
    norm === 'RESOLVED' || 
    norm === 'PROCESSED' || 
    norm === 'VERIFIED' ||
    norm === 'ACCEPT' ||
    norm === 'ACCEPTED' ||
    norm === 'READY' ||
    norm === 'COMPLETED'
  ) {
    colors = 'bg-emerald-950/50 text-emerald-400 border-emerald-500/50 shadow-[0_0_6px_rgba(52,211,153,0.2)]';
  } else if (
    norm === 'FLAGGED' || 
    norm === 'CRITICAL' || 
    norm === 'HIGH' || 
    norm === 'SUSPICIOUS' ||
    norm === 'REJECTED' ||
    norm === 'FAIL' ||
    norm === 'CONTRADICTION'
  ) {
    colors = 'bg-red-950/50 text-red-400 border-red-500/60 shadow-[0_0_6px_rgba(239,68,68,0.2)]';
  } else if (
    norm === 'NEEDS_VERIFICATION' || 
    norm === 'REQUIRES REVIEW' || 
    norm === 'UNCONFIRMED' || 
    norm === 'IN_REVIEW' || 
    norm === 'AWAITING_REVIEW' ||
    norm === 'MEDIUM' ||
    norm === 'OPEN' ||
    norm === 'INVESTIGATING'
  ) {
    colors = 'bg-amber-950/60 text-amber-300 border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.2)]';
  } else if (
    norm === 'NEW' || 
    norm === 'INDEXING' || 
    norm === 'PENDING' ||
    norm === 'LOW'
  ) {
    colors = 'bg-zinc-900/80 text-amber-400/80 border-amber-500/30';
  }

  const padding = size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs';

  return (
    <span className={`inline-flex items-center font-mono font-medium border uppercase tracking-wider ${padding} ${colors} ${className}`}>
      [{norm}]
    </span>
  );
};
