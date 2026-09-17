import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

export type AlertType = 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';

export interface TerminalAlert {
  id: string;
  message: string;
  type: AlertType;
  timestamp: string;
}

interface TerminalAlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
}

const TerminalAlertContext = createContext<TerminalAlertContextType | undefined>(undefined);

export const TerminalAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<TerminalAlert[]>([]);

  const showAlert = useCallback((message: string, type: AlertType = 'INFO') => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0];

    setAlerts((prev) => [...prev, { id, message, type, timestamp }]);

    setTimeout(() => {
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    }, 4500);
  }, []);

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <TerminalAlertContext.Provider value={{ showAlert }}>
      {children}

      {/* Terminal Toast Overlay Container */}
      <div className="fixed top-16 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none font-mono text-xs">
        {alerts.map((alert) => {
          const isCrit = alert.type === 'CRITICAL';
          const isSucc = alert.type === 'SUCCESS';
          const isWarn = alert.type === 'WARNING';

          return (
            <div
              key={alert.id}
              className={`pointer-events-auto p-3 border shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 ${
                isCrit
                  ? 'bg-[#180808]/95 border-red-500 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                  : isSucc
                  ? 'bg-[#081808]/95 border-emerald-500 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                  : isWarn
                  ? 'bg-[#181208]/95 border-amber-500 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                  : 'bg-[#0c120c]/95 border-amber-500/80 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]'
              }`}
            >
              <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-current opacity-40 text-[10px]">
                <div className="flex items-center gap-1.5 font-bold tracking-wider">
                  {isCrit && <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse" />}
                  {isSucc && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  {isWarn && <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />}
                  {!isCrit && !isSucc && !isWarn && <Info className="w-3.5 h-3.5 text-amber-400" />}
                  <span>// SYSTEM DISPATCH // {alert.type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>{alert.timestamp}</span>
                  <button
                    onClick={() => dismissAlert(alert.id)}
                    className="hover:opacity-100 opacity-60 p-0.5 hover:bg-white/10"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
              <div className="text-xs leading-relaxed font-mono">
                {alert.message}
              </div>
            </div>
          );
        })}
      </div>
    </TerminalAlertContext.Provider>
  );
};

export const useTerminalAlert = () => {
  const context = useContext(TerminalAlertContext);
  if (!context) {
    return {
      showAlert: (msg: string) => console.log(`[TERMINAL ALERT]: ${msg}`)
    };
  }
  return context;
};
