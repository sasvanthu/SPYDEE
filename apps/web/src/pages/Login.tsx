import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { Shield, Key, UserCheck, AlertTriangle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(username, password);
      localStorage.setItem('spydee_token', res.access_token);
      localStorage.setItem('spydee_user', JSON.stringify(res.user));
      navigate('/');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'AUTHENTICATION REJECTED // INVALID CREDENTIALS');
    } finally {
      setLoading(false);
    }
  };

  const setCredentials = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-[#080c08] flex items-center justify-center p-4 font-mono text-[#f59e0b] relative select-none">
      {/* CRT scanlines effect overlay */}
      <div className="absolute inset-0 scanlines pointer-events-none opacity-40 z-10" />

      <div className="w-full max-w-md space-y-4 relative z-20">
        {/* Terminal Header Banner */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 border border-amber-500/40 bg-[#0a0f0a] text-[11px] text-amber-500 rounded-xs uppercase tracking-wider mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            SECURE INTELLIGENCE GATEWAY // PORT 3000
          </div>
          <h1 className="text-3xl font-black tracking-widest text-amber-300 flex items-center justify-center gap-2 font-chakra amber-glow">
            <span>◈</span> SPYDEE OS
          </h1>
          <p className="text-xs text-amber-500/80 uppercase tracking-widest">
            Criminal Network Analysis & Intelligence Terminal
          </p>
        </div>

        {/* Authentication Panel */}
        <TerminalPanel title="SECURE ACCESS // CREDENTIAL CHALLENGE" subtitle="SECURITY ENCLAVE" glow>
          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-amber-500/80 mb-1">
                OPERATOR IDENTIFIER [USERNAME]:
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-amber-500/40 text-amber-300 text-xs focus:border-amber-400 focus:outline-none placeholder-amber-500/30"
                placeholder="e.g. investigator"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-wider text-amber-500/80 mb-1">
                SECURITY ACCESS KEY [PASSWORD]:
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-amber-500/40 text-amber-300 text-xs focus:border-amber-400 focus:outline-none placeholder-amber-500/30"
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="p-2 border border-red-500/60 bg-red-950/30 text-red-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors text-xs tracking-wider uppercase shadow-[0_0_10px_rgba(245,158,11,0.5)] disabled:opacity-50"
            >
              {loading ? 'VERIFYING SECURITY TOKENS...' : 'AUTHENTICATE SESSION ▶'}
            </button>
          </form>

          {/* Quick Operator Profiles */}
          <div className="mt-4 pt-3 border-t border-amber-500/20 text-xs">
            <div className="text-[10px] text-amber-500/70 uppercase tracking-wider mb-2">
              QUICK CREDENTIAL PRESETS:
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setCredentials('investigator', 'invest123')}
                className="p-1.5 border border-amber-500/30 bg-black hover:border-amber-400 text-[10px] text-left transition-colors"
              >
                <div className="text-amber-300 font-bold">INVESTIGATOR</div>
                <div className="text-amber-500/60 text-[9px]">Field Level</div>
              </button>
              <button
                type="button"
                onClick={() => setCredentials('admin', 'admin123')}
                className="p-1.5 border border-amber-500/30 bg-black hover:border-amber-400 text-[10px] text-left transition-colors"
              >
                <div className="text-emerald-400 font-bold">ADMIN</div>
                <div className="text-amber-500/60 text-[9px]">Full Clearance</div>
              </button>
              <button
                type="button"
                onClick={() => setCredentials('supervisor', 'super123')}
                className="p-1.5 border border-amber-500/30 bg-black hover:border-amber-400 text-[10px] text-left transition-colors"
              >
                <div className="text-amber-200 font-bold">SUPERVISOR</div>
                <div className="text-amber-500/60 text-[9px]">Audit Authority</div>
              </button>
            </div>
          </div>
        </TerminalPanel>

        <div className="text-center text-[10px] text-amber-500/60 tracking-wider uppercase">
          PROTECTED UNDER CLASSIFIED INTELLIGENCE PROTOCOLS // RESTRICTED ACCESS
        </div>
      </div>
    </div>
  );
}
