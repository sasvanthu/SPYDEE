import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  const handleLogout = () => {
    localStorage.removeItem('spydee_token');
    localStorage.removeItem('spydee_user');
    navigate('/login');
  };

  const navSections = caseId ? [
    {
      heading: 'Overview',
      items: [{ label: 'Case Overview', path: `/cases/${caseId}`, icon: '○' }],
    },
    {
      heading: 'Evidence & Site',
      items: [
        { label: 'Evidence', path: `/cases/${caseId}/evidence`, icon: '▣' },
        { label: 'Entities', path: `/cases/${caseId}/entities`, icon: '●' },
        { label: 'Graph', path: `/cases/${caseId}/graph`, icon: '◈' },
        { label: 'Map', path: `/cases/${caseId}/map`, icon: '◎' },
        { label: 'Timeline', path: `/cases/${caseId}/timeline`, icon: '▷' },
      ],
    },
    {
      heading: 'Intelligence',
      items: [
        { label: 'Workbench', path: `/cases/${caseId}/workbench`, icon: '◆' },
        { label: 'Contradictions', path: `/cases/${caseId}/contradictions`, icon: '≠' },
        { label: 'Hypotheses & Leads', path: `/cases/${caseId}/hypotheses`, icon: '◇' },
        { label: 'Leads, Gaps & Actions', path: `/cases/${caseId}/leads`, icon: '↦' },
      ],
    },
    {
      heading: 'Partner Tools',
      items: [{ label: 'Copilot', path: `/cases/${caseId}/copilot`, icon: '▹' }],
    },
    {
      heading: 'Output',
      items: [{ label: 'Reports', path: `/cases/${caseId}/reports`, icon: '▤' }],
    },
  ] : [];

  const caseNav = (navSections || []).flatMap(s => s.items);
  const currentSection = caseNav.find(n => location.pathname === n.path)?.label || '';

  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-[#0f172a] text-gray-300 flex flex-col flex-shrink-0 border-r border-[#1e293b]">
        <div className="p-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
              <circle cx="16" cy="24" r="6" stroke="#94a3b8" strokeWidth="2.5" fill="none" />
              <circle cx="32" cy="16" r="5" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
              <circle cx="34" cy="32" r="5" stroke="#22d3ee" strokeWidth="2.5" fill="none" />
              <line x1="21" y1="21" x2="28" y2="17" stroke="#94a3b8" strokeWidth="2" />
              <line x1="21" y1="27" x2="29" y2="31" stroke="#94a3b8" strokeWidth="2" />
              <line x1="32" y1="21" x2="33" y2="27" stroke="#22d3ee" strokeWidth="2" />
            </svg>
            <span className="font-bold text-lg text-white tracking-wide">SPYDEE</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto text-sm">
          <button onClick={() => navigate('/cases')}
            className={`w-full text-left px-3 py-2 rounded font-medium transition-colors ${!caseId ? 'bg-[#22d3ee] text-[#0f172a]' : 'hover:bg-[#1e293b] text-gray-400 hover:text-gray-200'}`}>
            Cases
          </button>
          {caseId && (
            <div className="mt-1 mb-1 px-3">
              <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Case Menu</div>
            </div>
          )}
          {navSections.map(section => (
            <div key={section.heading} className="mb-3">
              <div className="px-3 text-[10px] uppercase tracking-wider text-gray-600 mb-1">{section.heading}</div>
              {section.items.map(item => (
                <button key={item.path} onClick={() => navigate(item.path)}
                  className={`w-full text-left px-3 py-1.5 rounded flex items-center gap-2 transition-colors ${
                    location.pathname === item.path
                      ? 'bg-[#22d3ee] text-[#0f172a] font-semibold'
                      : 'hover:bg-[#1e293b] text-gray-400 hover:text-gray-200'
                  }`}>
                  <span className="text-[10px] opacity-60">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-[#1e293b]">
          <div className="text-xs text-gray-500 mb-1">{user?.display_name || user?.username}</div>
          <div className="text-[10px] text-gray-600 uppercase mb-2">{user?.role}</div>
          <button onClick={handleLogout} className="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-[#1e293b] text-red-400 hover:text-red-300 transition-colors">
            Sign Out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto bg-gray-50">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            {caseData ? (
              <div>
                <div className="text-sm font-semibold text-gray-900">{caseData.title}</div>
                <div className="text-xs text-gray-500">{caseData.case_code} {currentSection ? `· ${currentSection}` : ''}</div>
              </div>
            ) : (
              <div className="text-sm font-medium text-gray-700">
                {location.pathname === '/cases' ? 'All Cases' : 'SPYDEE Investigative Platform'}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Prototype v0.1</span>
            <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded font-medium">SYNTHETIC DATA</span>
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}