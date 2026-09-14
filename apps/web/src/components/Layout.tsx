import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [caseId, setCaseId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('spydee_user');
    if (stored) setUser(JSON.parse(stored));
    const parts = location.pathname.split('/');
    const ci = parts.indexOf('cases');
    if (ci >= 0 && parts[ci + 1]) setCaseId(parts[ci + 1]);
    else setCaseId(null);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('spydee_token');
    localStorage.removeItem('spydee_user');
    navigate('/login');
  };

  const caseNav = caseId ? [
    { label: 'Overview', path: `/cases/${caseId}` },
    { label: 'Evidence', path: `/cases/${caseId}/evidence` },
    { label: 'Entities', path: `/cases/${caseId}/entities` },
    { label: 'Graph', path: `/cases/${caseId}/graph` },
    { label: 'Map', path: `/cases/${caseId}/map` },
    { label: 'Timeline', path: `/cases/${caseId}/timeline` },
    { label: 'Workbench', path: `/cases/${caseId}/workbench` },
    { label: 'Hypotheses', path: `/cases/${caseId}/hypotheses` },
    { label: 'Copilot', path: `/cases/${caseId}/copilot` },
    { label: 'Reports', path: `/cases/${caseId}/reports` },
  ] : [];

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-navy-700 text-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-navy-600">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <circle cx="16" cy="24" r="6" stroke="white" strokeWidth="2.5" fill="none" />
              <circle cx="32" cy="16" r="5" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
              <circle cx="34" cy="32" r="5" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
              <line x1="21" y1="21" x2="28" y2="17" stroke="white" strokeWidth="2" />
              <line x1="21" y1="27" x2="29" y2="31" stroke="white" strokeWidth="2" />
              <line x1="32" y1="21" x2="33" y2="27" stroke="#22d3ee" strokeWidth="2" />
            </svg>
            <span className="font-bold text-lg">SPYDEE</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <button onClick={() => navigate('/cases')}
            className={`w-full text-left px-3 py-2 rounded text-sm ${!caseId ? 'bg-azure-500' : 'hover:bg-navy-600'}`}>
            Cases
          </button>
          {caseNav.map(item => (
            <button key={item.path} onClick={() => navigate(item.path)}
              className={`w-full text-left px-3 py-2 rounded text-sm ${location.pathname === item.path ? 'bg-azure-500' : 'hover:bg-navy-600'}`}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-navy-600">
          <div className="text-xs text-navy-300 mb-2">{user?.display_name} ({user?.role})</div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-2 rounded text-sm hover:bg-navy-600 text-red-300">
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <header className="bg-white border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="text-sm text-navy-400">
            {caseId && <span className="font-medium text-navy-700">Case Workspace</span>}
            {!caseId && location.pathname === '/cases' && <span className="font-medium text-navy-700">All Cases</span>}
          </div>
          <div className="text-xs text-navy-400">Prototype v0.1</div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
