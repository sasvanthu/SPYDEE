import React from 'react';

export interface ConfidenceMeterProps {
  value?: number; // 0 to 1
  confidence?: number; // alias for value
  label?: string;
  showSegments?: boolean;
  className?: string;
}

export const ConfidenceMeter: React.FC<ConfidenceMeterProps> = ({
  value,
  confidence,
  label = 'CONFIDENCE',
  showSegments = true,
  className = ''
}) => {
  const rawValue = typeof value === 'number' ? value : typeof confidence === 'number' ? confidence : 0;
  const percentage = isNaN(rawValue) ? 0 : Math.min(Math.max(Math.round(rawValue * 100), 0), 100);
  const totalBlocks = 10;
  const activeBlocks = Math.round((percentage / 100) * totalBlocks);

  let statusText = 'LOW';
  let barColor = 'bg-amber-500';

  if (percentage >= 75) {
    statusText = 'HIGH';
    barColor = 'bg-emerald-400';
  } else if (percentage >= 50) {
    statusText = 'MEDIUM';
    barColor = 'bg-amber-400';
  } else {
    statusText = 'LOW';
    barColor = 'bg-amber-600';
  }

  return (
    <div className={`font-mono text-xs ${className}`}>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-amber-400/80 tracking-wider uppercase">{label}</span>
        <span className="font-bold tracking-widest text-amber-300">
          {percentage}% <span className="text-[10px] text-amber-500/80">({statusText})</span>
        </span>
      </div>

      {showSegments ? (
        <div className="grid grid-cols-10 gap-0.5 h-2 bg-black/60 p-0.5 border border-amber-500/30">
          {Array.from({ length: totalBlocks }).map((_, idx) => (
            <div
              key={idx}
              className={`h-full ${
                idx < activeBlocks 
                  ? `${barColor} shadow-[0_0_3px_currentColor]` 
                  : 'bg-amber-950/20'
              }`}
            />
          ))}
        </div>
      ) : (
        <div className="w-full h-1.5 bg-black/80 border border-amber-500/30 overflow-hidden">
          <div 
            className={`h-full ${barColor}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}
    </div>
  );
};
