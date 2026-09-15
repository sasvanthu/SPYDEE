import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

const statusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  needs_clarification: 'bg-orange-100 text-orange-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-600',
};

export default function Contradictions() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [createForm, setCreateForm] = useState({
    title: '',
    statementA: '',
    statementB: '',
    time_context: '',
    detection_method: '',
    explanation: '',
  });

  const { data: contradictions, isLoading } = useQuery({
    queryKey: ['contradictions', caseId, statusFilter],
    queryFn: () => api.getContradictions(caseId!, statusFilter || undefined),
    enabled: !!caseId,
  });

  const { data: detail } = useQuery({
    queryKey: ['contradiction', caseId, selected?.id],
    queryFn: () => api.getContradiction(caseId!, selected!.id),
    enabled: !!caseId && !!selected,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: any) => api.reviewContradiction(caseId!, selected!.id, { decision, note: reviewNote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contradictions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['contradiction', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setReviewNote('');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.createContradiction(caseId!, {
      title: createForm.title,
      statements: [
        { text: createForm.statementA, source_ref: {} },
        { text: createForm.statementB, source_ref: {} },
      ],
      time_context: createForm.time_context || undefined,
      detection_method: createForm.detection_method || undefined,
      explanation: createForm.explanation || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contradictions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setShowCreate(false);
      setCreateForm({ title: '', statementA: '', statementB: '', time_context: '', detection_method: '', explanation: '' });
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contradictions</h1>
          <p className="text-sm text-gray-500 mt-1">Conflicting statements and evidence, tracked with reviewer decisions.</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700">
          {showCreate ? 'Cancel' : '+ Record Contradiction'}
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-900">New Contradiction</h2>
          <input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Title" className="w-full px-3 py-2 border rounded-md text-sm" />
          <textarea value={createForm.statementA} onChange={e => setCreateForm({ ...createForm, statementA: e.target.value })}
            placeholder="Statement 1 (e.g. evidence claiming X)" className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
          <textarea value={createForm.statementB} onChange={e => setCreateForm({ ...createForm, statementB: e.target.value })}
            placeholder="Statement 2 (conflicting evidence claiming not-X)" className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <input value={createForm.time_context} onChange={e => setCreateForm({ ...createForm, time_context: e.target.value })}
              placeholder="Time context (optional)" className="px-3 py-2 border rounded-md text-sm" />
            <input value={createForm.detection_method} onChange={e => setCreateForm({ ...createForm, detection_method: e.target.value })}
              placeholder="Detection method (optional)" className="px-3 py-2 border rounded-md text-sm" />
          </div>
          <textarea value={createForm.explanation} onChange={e => setCreateForm({ ...createForm, explanation: e.target.value })}
            placeholder="Explanation / reasoning (optional)" className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
          <button onClick={() => createMutation.mutate()} disabled={!createForm.title || !createForm.statementA || !createForm.statementB || createMutation.isPending}
            className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">
            {createMutation.isPending ? 'Saving...' : 'Save Contradiction'}
          </button>
        </div>
      )}

      <div className="flex gap-3 mb-5">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-white">
          <option value="">All statuses</option>
          {Object.keys(statusColors).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : contradictions && contradictions.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          {contradictions.map((c: any) => (
            <div key={c.id} className={`bg-white border rounded-lg p-4 text-sm cursor-pointer hover:shadow-md ${selected?.id === c.id ? 'border-cyan-400' : 'border-gray-200'}`}
              onClick={() => setSelected(c)}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{c.title}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${statusColors[c.status] || 'bg-gray-100'}`}>{c.status.replace('_', ' ')}</span>
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                {(c.statements || []).map((s: any, i: number) => (
                  <div key={i} className="bg-gray-50 p-2 rounded">"{s.text}"</div>
                ))}
              </div>
              {c.detection_method && <div className="mt-2 text-[11px] text-gray-400">Detected by: {c.detection_method}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">No contradictions recorded yet</div>
      )}

      {selected && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{detail.contradiction.title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded ${statusColors[detail.contradiction.status]}`}>
                {detail.contradiction.status.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-2 mb-4">
              {(detail.contradiction.statements || []).map((s: any, i: number) => (
                <div key={i} className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm text-gray-800">"{s.text}"</div>
                  {s.source_ref && (s.source_ref.excerpt || s.source_ref.locator) && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      {s.source_ref.locator && <span>Locator: {s.source_ref.locator}</span>}
                      {s.source_ref.locator && s.source_ref.excerpt && <span> · </span>}
                      {s.source_ref.excerpt && <span className="italic">"{s.source_ref.excerpt}"</span>}
                      {s.source_ref.evidence_id && <span> · evidence #{s.source_ref.evidence_id.slice(0, 8)}</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {detail.contradiction.time_context && (
              <div className="text-xs text-gray-500 mb-2"><span className="font-medium">Time context:</span> {detail.contradiction.time_context}</div>
            )}
            {detail.contradiction.explanation && (
              <div className="text-xs text-gray-500 mb-4"><span className="font-medium">Explanation:</span> {detail.contradiction.explanation}</div>
            )}

            {detail.review_history?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 text-sm mb-2">Review History</h3>
                <div className="space-y-1">
                  {detail.review_history.map((h: any) => (
                    <div key={h.id} className="text-xs bg-gray-50 p-2 rounded">
                      <span className="font-medium capitalize">{h.decision.replace('_', ' ')}</span>
                      <span className="text-gray-400"> · {h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                      {h.note && <div className="text-gray-600 mt-1">{h.note}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t pt-4">
              <h3 className="font-medium text-gray-700 text-sm mb-2">Apply Decision</h3>
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Decision note (optional)" className="w-full px-3 py-2 border rounded text-sm mb-2" rows={2} />
              <div className="flex gap-2 flex-wrap">
                {['open', 'needs_clarification', 'resolved', 'dismissed'].map(dec => (
                  <button key={dec} onClick={() => reviewMutation.mutate({ decision: dec })}
                    className={`text-xs px-3 py-1.5 rounded font-medium ${
                      dec === 'resolved' ? 'bg-green-500 text-white hover:bg-green-600' :
                      dec === 'dismissed' ? 'bg-gray-400 text-white hover:bg-gray-500' :
                      dec === 'needs_clarification' ? 'bg-orange-500 text-white hover:bg-orange-600' :
                      'bg-amber-500 text-white hover:bg-amber-600'
                    }`}>
                    {dec === 'needs_clarification' ? 'Needs Clarification' : dec[0].toUpperCase() + dec.slice(1)}
                  </button>
                ))}
              </div>
              <button onClick={() => setSelected(null)} className="mt-4 text-xs text-gray-500 hover:underline">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}