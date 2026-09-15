import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

const leadStatusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  resolved: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-600',
};
const leadPriorityColors: Record<string, string> = {
  low: 'bg-gray-100 text-gray-600',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};
const gapStatusColors: Record<string, string> = {
  open: 'bg-amber-100 text-amber-700',
  addressed: 'bg-green-100 text-green-700',
  dismissed: 'bg-gray-100 text-gray-600',
};
const actionStatusColors: Record<string, string> = {
  proposed: 'bg-amber-100 text-amber-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

type Tab = 'leads' | 'gaps' | 'actions';

export default function LeadsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('leads');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const emptyForm: any = { title: '', description: '', priority: 'medium', gap_id: '', lead_id: '', proposed_step: '', expected_information: '', outcome_notes: '' };
  const [createForm, setCreateForm] = useState<any>(emptyForm);
  const [leadStatusFilter, setLeadStatusFilter] = useState('');
  const [gapStatusFilter, setGapStatusFilter] = useState('');
  const [actionStatusFilter, setActionStatusFilter] = useState('');

  const leadsQ = useQuery({
    queryKey: ['leads', caseId, leadStatusFilter],
    queryFn: () => api.getLeads(caseId!, leadStatusFilter || undefined),
    enabled: !!caseId,
  });
  const gapsQ = useQuery({
    queryKey: ['gaps', caseId, gapStatusFilter],
    queryFn: () => api.getGaps(caseId!, gapStatusFilter || undefined),
    enabled: !!caseId,
  });
  const actionsQ = useQuery({
    queryKey: ['actions', caseId, actionStatusFilter],
    queryFn: () => api.getActions(caseId!, actionStatusFilter || undefined),
    enabled: !!caseId,
  });
  const leadDetailQ = useQuery({
    queryKey: ['lead', caseId, selectedLead?.id],
    queryFn: () => api.getLead(caseId!, selectedLead!.id),
    enabled: !!caseId && !!selectedLead,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['leads', caseId] });
    queryClient.invalidateQueries({ queryKey: ['gaps', caseId] });
    queryClient.invalidateQueries({ queryKey: ['actions', caseId] });
    queryClient.invalidateQueries({ queryKey: ['lead', caseId] });
    queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
  };

  const reviewLeadMutation = useMutation({
    mutationFn: ({ decision }: any) => api.reviewLead(caseId!, selectedLead!.id, { decision, note: reviewNote }),
    onSuccess: () => { invalidate(); setReviewNote(''); },
  });

  const updateLeadMutation = useMutation({
    mutationFn: (data: any) => api.updateLead(caseId!, selectedLead!.id, data),
    onSuccess: () => { invalidate(); },
  });

  const createLeadMutation = useMutation({
    mutationFn: () => api.createLead(caseId!, {
      title: createForm.title,
      description: createForm.description || undefined,
      priority: createForm.priority,
      origin_type: 'manual',
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm(emptyForm); },
  });

  const createGapMutation = useMutation({
    mutationFn: () => api.createGap(caseId!, {
      title: createForm.title,
      description: createForm.description || undefined,
      lead_id: createForm.lead_id || undefined,
      related_evidence_refs: [],
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm(emptyForm); },
  });

  const createActionMutation = useMutation({
    mutationFn: () => api.createAction(caseId!, {
      title: createForm.title,
      description: createForm.description || undefined,
      proposed_step: createForm.proposed_step || undefined,
      expected_information: createForm.expected_information || undefined,
      gap_id: createForm.gap_id || undefined,
      lead_id: createForm.lead_id || undefined,
    }),
    onSuccess: () => { invalidate(); setShowCreate(false); setCreateForm(emptyForm); },
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ kind, id, data }: any) =>
      kind === 'lead' ? api.updateLead(caseId!, id, data) : api.updateAction(caseId!, id, data),
    onSuccess: () => { invalidate(); },
  });

  const updateGapMutation = useMutation({
    mutationFn: ({ id, data }: any) => api.updateGap(caseId!, id, data),
    onSuccess: () => { invalidate(); },
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leads', label: 'Leads' },
    { key: 'gaps', label: 'Information Gaps' },
    { key: 'actions', label: 'Investigation Actions' },
  ];

  const createButtonLabel = tab === 'leads' ? '+ Lead' : tab === 'gaps' ? '+ Gap' : '+ Action';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads, Gaps & Actions</h1>
          <p className="text-sm text-gray-500 mt-1">Prioritised leads, open questions, and next steps with full provenance.</p>
        </div>
        <button onClick={() => setShowCreate(v => !v)}
          className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700">
          {showCreate ? 'Cancel' : createButtonLabel}
        </button>
      </div>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? 'border-cyan-500 text-cyan-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-900">New {tab === 'gaps' ? 'Information Gap' : tab === 'leads' ? 'Lead' : 'Investigation Action'}</h2>
          <input value={createForm.title} onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
            placeholder="Title" className="w-full px-3 py-2 border rounded-md text-sm" />
          {tab === 'actions' && (
            <div className="grid grid-cols-2 gap-3">
              <select value={createForm.lead_id} onChange={e => setCreateForm({ ...createForm, lead_id: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm">
                <option value="">Link to lead (optional)</option>
                {(leadsQ.data || []).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
              <select value={createForm.gap_id} onChange={e => setCreateForm({ ...createForm, gap_id: e.target.value })}
                className="px-3 py-2 border rounded-md text-sm">
                <option value="">Link to gap (optional)</option>
                {(gapsQ.data || []).map((g: any) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
          )}
          {tab === 'gaps' && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Link to lead (optional)</div>
              <select value={createForm.lead_id} onChange={e => setCreateForm({ ...createForm, lead_id: e.target.value })}
                className="w-full px-3 py-2 border rounded-md text-sm">
                <option value="">No linked lead</option>
                {(leadsQ.data || []).map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            </div>
          )}
          {tab === 'leads' && (
            <div className="flex items-center gap-3">
              <div className="text-xs text-gray-500">Priority:</div>
              {['low', 'medium', 'high', 'critical'].map(p => (
                <button key={p} onClick={() => setCreateForm({ ...createForm, priority: p })}
                  className={`text-xs px-3 py-1 rounded font-medium ${createForm.priority === p ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                  {p}
                </button>
              ))}
            </div>
          )}
          {tab === 'actions' && (
            <>
              <input value={createForm.proposed_step} onChange={e => setCreateForm({ ...createForm, proposed_step: e.target.value })}
                placeholder="Proposed step" className="w-full px-3 py-2 border rounded-md text-sm" />
              <input value={createForm.expected_information} onChange={e => setCreateForm({ ...createForm, expected_information: e.target.value })}
                placeholder="Expected information" className="w-full px-3 py-2 border rounded-md text-sm" />
            </>
          )}
          <textarea value={createForm.description} onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
            placeholder="Description (optional)" className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
          <button
            onClick={() => {
              if (tab === 'leads') createLeadMutation.mutate();
              else if (tab === 'gaps') createGapMutation.mutate();
              else createActionMutation.mutate();
            }}
            disabled={!createForm.title || createLeadMutation.isPending || createGapMutation.isPending || createActionMutation.isPending}
            className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">
            Save
          </button>
        </div>
      )}

      {tab === 'leads' && (
        <>
          <div className="flex gap-3 mb-5">
            <select value={leadStatusFilter} onChange={e => setLeadStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm bg-white">
              <option value="">All statuses</option>
              {Object.keys(leadStatusColors).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {leadsQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : leadsQ.data && leadsQ.data.length > 0 ? (
            <div className="space-y-3">
              {leadsQ.data.map((l: any) => (
                <div key={l.id} className={`bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md ${selectedLead?.id === l.id ? 'border-cyan-400' : 'border-gray-200'}`}
                  onClick={() => setSelectedLead(l)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{l.title}</span>
                    <div className="flex gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded ${leadPriorityColors[l.priority]}`}>{l.priority}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${leadStatusColors[l.status]}`}>{l.status.replace('_', ' ')}</span>
                    </div>
                  </div>
                  {l.description && <p className="text-xs text-gray-500">{l.description}</p>}
                  {l.supporting_evidence_refs?.length > 0 && (
                    <div className="text-[11px] text-gray-400 mt-1">{l.supporting_evidence_refs.length} supporting evidence refs</div>
                  )}
                  <div className="text-[11px] text-gray-400 mt-1">Origin: {l.origin_type || 'manual'}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No leads yet</div>
          )}
        </>
      )}

      {tab === 'gaps' && (
        <>
          <div className="flex gap-3 mb-5">
            <select value={gapStatusFilter} onChange={e => setGapStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm bg-white">
              <option value="">All statuses</option>
              {Object.keys(gapStatusColors).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {gapsQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : gapsQ.data && gapsQ.data.length > 0 ? (
            <div className="space-y-3">
              {gapsQ.data.map((g: any) => (
                <div key={g.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{g.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${gapStatusColors[g.status]}`}>{g.status}</span>
                  </div>
                  {g.description && <p className="text-xs text-gray-500">{g.description}</p>}
                  <div className="flex gap-3 mt-2">
                    {['open', 'addressed', 'dismissed'].map(s => (
                      <button key={s}
                        onClick={() => updateGapMutation.mutate({ id: g.id, data: { status: s } })}
                        className="text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                        Mark {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No information gaps yet</div>
          )}
        </>
      )}

      {tab === 'actions' && (
        <>
          <div className="flex gap-3 mb-5">
            <select value={actionStatusFilter} onChange={e => setActionStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-md text-sm bg-white">
              <option value="">All statuses</option>
              {Object.keys(actionStatusColors).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
          </div>
          {actionsQ.isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : actionsQ.data && actionsQ.data.length > 0 ? (
            <div className="space-y-3">
              {actionsQ.data.map((a: any) => (
                <div key={a.id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{a.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${actionStatusColors[a.status]}`}>{a.status.replace('_', ' ')}</span>
                  </div>
                  {a.proposed_step && <p className="text-xs text-gray-600"><span className="font-medium">Step:</span> {a.proposed_step}</p>}
                  {a.expected_information && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Expected:</span> {a.expected_information}</p>}
                  {a.outcome_notes && <p className="text-xs text-gray-500 mt-1"><span className="font-medium">Outcome:</span> {a.outcome_notes}</p>}
                  <div className="flex gap-3 mt-2">
                    {['proposed', 'in_progress', 'completed', 'failed'].map(s => (
                      <button key={s}
                        onClick={() => updateTypeMutation.mutate({ kind: 'action', id: a.id, data: { status: s } })}
                        className="text-[11px] px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                        Mark {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">No investigation actions yet</div>
          )}
        </>
      )}

      {selectedLead && leadDetailQ.data && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => setSelectedLead(null)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{leadDetailQ.data.lead.title}</h2>
              <button onClick={() => setSelectedLead(null)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="flex gap-2 mb-4">
              <select value={leadDetailQ.data.lead.priority}
                onChange={e => updateLeadMutation.mutate({ priority: e.target.value })}
                className="text-xs px-2 py-1 border rounded">
                {['low', 'medium', 'high', 'critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={leadDetailQ.data.lead.status}
                onChange={e => reviewLeadMutation.mutate({ decision: e.target.value })}
                className="text-xs px-2 py-1 border rounded">
                {['open', 'in_progress', 'resolved', 'dismissed'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
              </select>
            </div>

            {leadDetailQ.data.lead.description && (
              <p className="text-sm text-gray-600 mb-3">{leadDetailQ.data.lead.description}</p>
            )}
            {leadDetailQ.data.lead.priority_rationale && (
              <p className="text-xs text-gray-500 mb-3"><span className="font-medium">Priority rationale:</span> {leadDetailQ.data.lead.priority_rationale}</p>
            )}

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <h3 className="font-medium text-gray-700 text-sm mb-2">Supporting Evidence ({leadDetailQ.data.lead.supporting_evidence_refs?.length || 0})</h3>
                {(leadDetailQ.data.lead.supporting_evidence_refs || []).map((r: any, i: number) => (
                  <div key={i} className="text-[11px] bg-gray-50 p-2 rounded mb-1 text-gray-600">
                    {r.locator && <div><span className="font-medium">Locator:</span> {r.locator}</div>}
                    {r.excerpt && <div className="italic">"{r.excerpt}"</div>}
                    {r.evidence_id && <div className="text-gray-400">evidence #{r.evidence_id.slice(0, 8)}</div>}
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-medium text-gray-700 text-sm mb-2">Conflicting Evidence ({leadDetailQ.data.lead.conflicting_evidence_refs?.length || 0})</h3>
                {(leadDetailQ.data.lead.conflicting_evidence_refs || []).map((r: any, i: number) => (
                  <div key={i} className="text-[11px] bg-red-50 p-2 rounded mb-1 text-gray-600">
                    {r.locator && <div><span className="font-medium">Locator:</span> {r.locator}</div>}
                    {r.excerpt && <div className="italic">"{r.excerpt}"</div>}
                  </div>
                ))}
              </div>
            </div>

            {leadDetailQ.data.gaps?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 text-sm mb-2">Linked Gaps</h3>
                {leadDetailQ.data.gaps.map((g: any) => (
                  <div key={g.id} className="text-xs bg-gray-50 p-2 rounded mb-1">{g.title} <span className="text-gray-400">({g.status})</span></div>
                ))}
              </div>
            )}
            {leadDetailQ.data.actions?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 text-sm mb-2">Linked Actions</h3>
                {leadDetailQ.data.actions.map((a: any) => (
                  <div key={a.id} className="text-xs bg-gray-50 p-2 rounded mb-1">{a.title} <span className="text-gray-400">({a.status})</span></div>
                ))}
              </div>
            )}

            {leadDetailQ.data.review_history?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 text-sm mb-2">Review History</h3>
                {leadDetailQ.data.review_history.map((h: any) => (
                  <div key={h.id} className="text-xs bg-gray-50 p-2 rounded mb-1">
                    <span className="font-medium capitalize">{h.decision.replace('_', ' ')}</span>
                    <span className="text-gray-400"> · {h.created_at ? new Date(h.created_at).toLocaleString() : ''}</span>
                    {h.note && <div className="text-gray-600">{h.note}</div>}
                  </div>
                ))}
              </div>
            )}

            <div className="border-t pt-4">
              <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                placeholder="Decision note (optional)" className="w-full px-3 py-2 border rounded text-sm mb-2" rows={2} />
              <div className="flex gap-2 flex-wrap">
                {['open', 'in_progress', 'resolved', 'dismissed'].map(dec => (
                  <button key={dec} onClick={() => reviewLeadMutation.mutate({ decision: dec })}
                    className={`text-xs px-3 py-1.5 rounded font-medium ${
                      dec === 'resolved' ? 'bg-green-500 text-white hover:bg-green-600' :
                      dec === 'dismissed' ? 'bg-gray-400 text-white hover:bg-gray-500' :
                      dec === 'in_progress' ? 'bg-blue-500 text-white hover:bg-blue-600' :
                      'bg-amber-500 text-white hover:bg-amber-600'
                    }`}>
                    {dec[0].toUpperCase() + dec.slice(1).replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}