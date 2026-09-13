import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export default function CaseList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newCase, setNewCase] = useState({ title: '', case_code: '', description: '' });

  const { data: cases, isLoading } = useQuery({
    queryKey: ['cases', search],
    queryFn: () => api.getCases(search || undefined),
  });

  const createMutation = useMutation({
    mutationFn: api.createCase,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cases'] }); setShowCreate(false); setNewCase({ title: '', case_code: '', description: '' }); },
  });

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    under_review: 'bg-amber-100 text-amber-700',
    archived: 'bg-red-100 text-red-600',
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-700">Cases</h1>
        <div className="flex gap-3">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search cases..." className="px-3 py-2 border rounded-md text-sm w-64 focus:ring-2 focus:ring-azure-500 outline-none" />
          <button onClick={() => setShowCreate(true)}
            className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600">
            + New Case
          </button>
        </div>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-6 mb-6 shadow-sm">
          <h3 className="font-semibold mb-4">Create New Case</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Case title" value={newCase.title} onChange={e => setNewCase({ ...newCase, title: e.target.value })}
              className="px-3 py-2 border rounded-md text-sm" />
            <input placeholder="Case code (e.g. BRK-2026-001)" value={newCase.case_code} onChange={e => setNewCase({ ...newCase, case_code: e.target.value })}
              className="px-3 py-2 border rounded-md text-sm" />
            <textarea placeholder="Description" value={newCase.description} onChange={e => setNewCase({ ...newCase, description: e.target.value })}
              className="px-3 py-2 border rounded-md text-sm col-span-2" rows={2} />
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => createMutation.mutate(newCase)} disabled={!newCase.title || !newCase.case_code}
              className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
              Create
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-md text-sm border hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-navy-400">Loading cases...</div>
      ) : cases && cases.length > 0 ? (
        <div className="grid gap-4">
          {cases.map((c: any) => (
            <div key={c.id} onClick={() => navigate(`/cases/${c.id}`)}
              className="bg-white border rounded-lg p-5 hover:shadow-md cursor-pointer transition">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-navy-700">{c.title}</h3>
                    {c.is_synthetic && (
                      <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-medium">SYNTHETIC DEMO</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[c.status] || 'bg-gray-100'}`}>{c.status}</span>
                  </div>
                  <p className="text-sm text-navy-400 mt-1">{c.case_code}</p>
                </div>
                <div className="flex gap-6 text-sm text-navy-400">
                  <div className="text-center"><div className="font-semibold text-navy-700">{c.entity_count || 0}</div>entities</div>
                  <div className="text-center"><div className="font-semibold text-navy-700">{c.evidence_count || 0}</div>evidence</div>
                  <div className="text-center"><div className="font-semibold text-navy-700">{c.hypothesis_count || 0}</div>hypotheses</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-navy-400">No cases found. Create one to get started.</div>
      )}
    </div>
  );
}
