import React from 'react';

export interface TerminalPanelProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  action?: React.ReactNode;
  variant?: string;
  children: React.ReactNode;
  className?: string;
  cornerAccents?: boolean;
  glow?: boolean;
  actionButtons?: React.ReactNode;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  title,
  subtitle,
  headerRight,
  action,
  variant,
  children,
  className = '',
  cornerAccents = true,
  glow = false,
  actionButtons
}) => {
  return (
    <div className={`bg-[#0b100b]/90 border border-amber-500/35 relative font-mono text-amber-400 ${glow ? 'amber-box-glow' : ''} ${className}`}>
      {/* Corner brackets */}
      {cornerAccents && (
        <>
          <span className="absolute -top-[1px] -left-[1px] w-2 h-2 border-t-2 border-l-2 border-amber-400 pointer-events-none" />
          <span className="absolute -top-[1px] -right-[1px] w-2 h-2 border-t-2 border-r-2 border-amber-400 pointer-events-none" />
          <span className="absolute -bottom-[1px] -left-[1px] w-2 h-2 border-b-2 border-l-2 border-amber-400 pointer-events-none" />
          <span className="absolute -bottom-[1px] -right-[1px] w-2 h-2 border-b-2 border-r-2 border-amber-400 pointer-events-none" />
        </>
      )}

      {/* Header bar if title exists */}
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-amber-500/30 bg-[#0e160e]/80 text-xs select-none">
          <div className="flex items-center gap-2">
            <span className="text-amber-500 font-bold">▶</span>
            <span className="font-bold tracking-wider uppercase text-amber-300">{title}</span>
            {subtitle && (
              <span className="text-[11px] text-amber-500/70 hidden sm:inline-block">
                // {subtitle}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {action}
            {actionButtons}
            {headerRight}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};
