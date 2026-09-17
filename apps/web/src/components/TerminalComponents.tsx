import React from 'react';
export { TerminalPanel } from './common/TerminalPanel';
export { StatusBadge } from './common/StatusBadge';
export { ConfidenceMeter } from './common/ConfidenceMeter';
export { IntelligenceSignal } from './common/IntelligenceSignal';

// ==========================================
// TerminalButton: Compact technical control
// ==========================================
interface TerminalButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'xs';
}

export function TerminalButton({
  variant = 'secondary',
  size = 'md',
  children,
  className = '',
  disabled,
  ...props
}: TerminalButtonProps) {
  const sizeClasses =
    size === 'xs'
      ? 'px-2 py-0.5 text-[10px]'
      : size === 'sm'
      ? 'px-2.5 py-1 text-xs'
      : 'px-3.5 py-1.5 text-xs';

  let variantClasses = '';
  switch (variant) {
    case 'primary':
      variantClasses =
        'bg-[#f59e0b] text-[#080c08] font-bold border border-[#f59e0b] hover:bg-[#fbbf24] active:bg-[#d97706] shadow-[0_0_10px_rgba(245,158,11,0.4)]';
      break;
    case 'danger':
      variantClasses =
        'border border-red-500 text-red-400 bg-red-950/20 hover:bg-red-900/40 active:bg-red-950/60 shadow-[0_0_6px_rgba(239,68,68,0.2)]';
      break;
    case 'success':
      variantClasses =
        'border border-emerald-500 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-900/40 active:bg-emerald-950/60 shadow-[0_0_6px_rgba(52,211,153,0.2)]';
      break;
    case 'secondary':
    default:
      variantClasses =
        'border border-amber-500/40 text-amber-300 bg-black/60 hover:border-amber-400 hover:text-amber-200 hover:bg-amber-950/30';
      break;
  }

  return (
    <button
      className={`font-mono uppercase tracking-wider transition-all inline-flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${sizeClasses} ${variantClasses} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

// ==========================================
// WorkspaceHeader: Consistent Workspace Bar
// ==========================================
interface WorkspaceHeaderProps {
  code?: string;
  title: string;
  description?: string;
  statusBadge?: React.ReactNode;
  children?: React.ReactNode;
}

export function WorkspaceHeader({
  code,
  title,
  description,
  statusBadge,
  children,
}: WorkspaceHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 mb-3 border-b border-amber-500/40 font-mono">
      <div>
        {code && (
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase mb-0.5 flex items-center gap-2">
            <span>{code}</span>
          </div>
        )}
        <h1 className="text-base md:text-lg font-black text-amber-300 tracking-wider flex items-center gap-2">
          <span>//</span>
          <span>{title}</span>
        </h1>
        {description && (
          <p className="text-[10px] text-amber-500/80 tracking-wide mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
        {statusBadge}
        {children}
      </div>
    </div>
  );
}

// ==========================================
// MetricCell: Technical numeric display
// ==========================================
interface MetricCellProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  highlight?: boolean;
  alert?: boolean;
}

export function MetricCell({
  label,
  value,
  sublabel,
  icon,
  onClick,
  highlight,
  alert,
}: MetricCellProps) {
  const borderClass = alert
    ? 'border-red-500 text-red-400'
    : highlight
    ? 'border-amber-400 text-amber-200'
    : 'border-amber-500/35 hover:border-amber-400 text-amber-300';

  const Comp = onClick ? 'button' : 'div';

  return (
    <Comp
      onClick={onClick}
      className={`border ${borderClass} bg-[#0c120c]/90 p-3 text-left transition-all w-full relative font-mono group overflow-hidden ${
        onClick ? 'cursor-pointer hover:bg-amber-950/20' : ''
      }`}
    >
      <div className="text-[10px] text-amber-500/70 uppercase tracking-widest mb-1 truncate flex items-center justify-between">
        <span>{label}</span>
        {icon && <span className="text-amber-500/60">{icon}</span>}
      </div>
      <div className="text-xl md:text-2xl font-black text-amber-300 tracking-tight group-hover:text-amber-200">
        {value}
      </div>
      {sublabel && (
        <div className="mt-1 text-[9px] text-amber-500/50 truncate">
          {sublabel}
        </div>
      )}
      <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-amber-500/50" />
    </Comp>
  );
}
