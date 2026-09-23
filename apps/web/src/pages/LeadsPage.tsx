import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { Compass, CheckSquare, AlertCircle, Plus, X, Search, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

type Tab = 'leads' | 'gaps' | 'actions';

export default function LeadsPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();
  const [tab, setTab] = useState<Tab>('leads');
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const emptyForm: any = {
    title: '',
    description: '',
    priority: 'medium',
    gap_id: '',
    lead_id: '',
    proposed_step: '',
    expected_information: '',
    outcome_notes: '',
  };
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
    mutationFn: ({ decision }: any) =>
      api.reviewLead(caseId!, selectedLead!.id, { decision, note: reviewNote }),
    onSuccess: (_, vars) => {
      invalidate();
      setReviewNote('');
      showAlert(`Lead status updated to [${vars.decision.toUpperCase()}].`, 'SUCCESS');
    },
  });

  const updateLeadMutation = useMutation({
    mutationFn: (data: any) => api.updateLead(caseId!, selectedLead!.id, data),
    onSuccess: () => {
      invalidate();
      showAlert('Lead record updated.', 'SUCCESS');
    },
  });

  const createLeadMutation = useMutation({
    mutationFn: () =>
      api.createLead(caseId!, {
        title: createForm.title,
        description: createForm.description || undefined,
        priority: createForm.priority,
        origin_type: 'manual',
      }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setCreateForm(emptyForm);
      showAlert('New investigative lead logged.', 'SUCCESS');
    },
  });

  const createGapMutation = useMutation({
    mutationFn: () =>
      api.createGap(caseId!, {
        title: createForm.title,
        description: createForm.description || undefined,
        lead_id: createForm.lead_id || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setCreateForm(emptyForm);
      showAlert('New information gap logged.', 'SUCCESS');
    },
  });

  const createActionMutation = useMutation({
    mutationFn: () =>
      api.createAction(caseId!, {
        title: createForm.title,
        proposed_step: createForm.proposed_step || undefined,
        expected_information: createForm.expected_information || undefined,
        gap_id: createForm.gap_id || undefined,
        lead_id: createForm.lead_id || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowCreate(false);
      setCreateForm(emptyForm);
      showAlert('New tactical action logged.', 'SUCCESS');
    },
  });

  const updateTypeMutation = useMutation({
    mutationFn: ({ kind, id, data }: any) => {
      if (kind === 'gap') return api.updateGap(caseId!, id, data);
      return api.updateAction(caseId!, id, data);
    },
    onSuccess: () => {
      invalidate();
      showAlert('Status updated.', 'SUCCESS');
    },
  });

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'leads', label: 'INVESTIGATIVE LEADS', count: leadsQ.data?.length },
    { id: 'gaps', label: 'EPISTEMIC GAPS', count: gapsQ.data?.length },
    { id: 'actions', label: 'DISPATCHED ACTIONS', count: actionsQ.data?.length },
  ];

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // LEADS & ACTION QUEUE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            INVESTIGATIVE LEADS, GAPS & WARRANTS
          </div>
          <div className="text-[10px] text-amber-500/80">
            ACTIONABLE TASK SEQUENCING // SECTION 91 NOTICE TRACKING // SUBPOENA REQUISITIONS
          </div>
        </div>

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showCreate ? 'CLOSE' : `+ NEW ${tab === 'gaps' ? 'GAP' : tab === 'leads' ? 'LEAD' : 'ACTION'}`}</span>
        </button>
      </div>

      {/* NAVIGATION TABS */}
      <div className="flex border-b border-amber-500/30 gap-1 bg-[#0a0f0a] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setShowCreate(false);
            }}
            className={`px-3 py-1.5 text-xs font-bold transition-colors flex items-center gap-2 ${
              tab === t.id
                ? 'bg-amber-500 text-black shadow-[0_0_8px_#f59e0b]'
                : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <span>{t.label}</span>
            {t.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-xs font-bold ${tab === t.id ? 'bg-black text-amber-300' : 'bg-black/60 text-amber-400 border border-amber-500/30'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CREATE FORM DRAWER */}
      {showCreate && (
        <TerminalPanel
          title={`REGISTER NEW // ${tab === 'gaps' ? 'INFORMATION GAP' : tab === 'leads' ? 'LEAD' : 'ACTION'}`}
          subtitle="TASK RECORD"
        >
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                ITEM TITLE / OBJECTIVE:
              </label>
              <input
                value={createForm.title}
                onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                placeholder="Subject description or task target..."
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
              />
            </div>

            {tab === 'actions' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                    PROPOSED STEP / SUBPOENA SPEC:
                  </label>
                  <input
                    value={createForm.proposed_step}
                    onChange={(e) => setCreateForm({ ...createForm, proposed_step: e.target.value })}
                    placeholder="e.g. Issue Section 91 order to ISP for IP audit..."
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                    EXPECTED DISCLOSURE:
                  </label>
                  <input
                    value={createForm.expected_information}
                    onChange={(e) => setCreateForm({ ...createForm, expected_information: e.target.value })}
                    placeholder="e.g. DHCP leases confirming physical router MAC"
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                  />
                </div>
              </div>
            )}

            {tab === 'leads' && (
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">TACTICAL PRIORITY:</label>
                <div className="flex gap-2">
                  {['low', 'medium', 'high', 'critical'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setCreateForm({ ...createForm, priority: p })}
                      className={`text-xs px-3 py-1 uppercase font-bold transition-colors border ${
                        createForm.priority === p
                          ? 'border-amber-400 bg-amber-500 text-black'
                          : 'border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                DESCRIPTION / SCOPE NOTES:
              </label>
              <textarea
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Supporting intelligence, rationale, or officer notes..."
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowCreate(false)}
                className="px-3 py-1 bg-black border border-amber-500/30 text-amber-400 hover:bg-amber-950/30"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  if (tab === 'leads') createLeadMutation.mutate();
                  else if (tab === 'gaps') createGapMutation.mutate();
                  else createActionMutation.mutate();
                }}
                disabled={!createForm.title}
                className="px-3 py-1 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50"
              >
                [ COMMIT RECORD ]
              </button>
            </div>
          </div>
        </TerminalPanel>
      )}

      {/* LEADS LIST */}
      {tab === 'leads' && (
        <div className="space-y-2.5">
          {leadsQ.isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SCANNING INVESTIGATIVE LEADS MATRIX... ]
            </div>
          ) : leadsQ.data && leadsQ.data.length > 0 ? (
            leadsQ.data.map((l: any) => (
              <div
                key={l.id}
                onClick={() => setSelectedLead(l)}
                className={`p-3 bg-[#0b100b] border cursor-pointer transition-colors space-y-2 ${
                  selectedLead?.id === l.id
                    ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                    : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'
                }`}
              >
                <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-300">{l.title}</span>
                    <StatusBadge status={l.priority} size="sm" />
                    <StatusBadge status={l.status} size="sm" />
                  </div>
                  <span className="text-[10px] text-amber-500/60 uppercase">
                    ORIGIN: {l.origin_type || 'MANUAL'}
                  </span>
                </div>

                {l.description && (
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    {l.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-[10px] text-amber-500/70 pt-1 border-t border-amber-500/10">
                  <span>SUPPORTING REFS: {l.supporting_evidence_refs?.length || 0}</span>
                  <span className="text-amber-400 font-bold">CLICK TO INSPECT DOSSIER &rarr;</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO ACTIVE LEADS IN CURRENT REGISTRY.
            </div>
          )}
        </div>
      )}

      {/* GAPS LIST */}
      {tab === 'gaps' && (
        <div className="space-y-2.5">
          {gapsQ.isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SCANNING EPISTEMIC GAPS... ]
            </div>
          ) : gapsQ.data && gapsQ.data.length > 0 ? (
            gapsQ.data.map((g: any) => (
              <div key={g.id} className="p-3 bg-[#0b100b] border border-amber-500/35 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">{g.title}</span>
                  <StatusBadge status={g.status} size="sm" />
                </div>
                {g.description && (
                  <p className="text-xs text-amber-200/90">{g.description}</p>
                )}
                <div className="flex items-center gap-1.5 pt-1 border-t border-amber-500/20 text-[10px]">
                  <span className="text-amber-500/70 uppercase">STATUS:</span>
                  {['open', 'addressed', 'dismissed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateTypeMutation.mutate({ kind: 'gap', id: g.id, data: { status: s } })}
                      className="px-2 py-0.5 border border-amber-500/30 bg-black text-amber-300 hover:bg-amber-500/20 uppercase"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO ACTIVE INFORMATION GAPS RECORDED.
            </div>
          )}
        </div>
      )}

      {/* ACTIONS LIST */}
      {tab === 'actions' && (
        <div className="space-y-2.5">
          {actionsQ.isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SCANNING TACTICAL ACTION REGISTRY... ]
            </div>
          ) : actionsQ.data && actionsQ.data.length > 0 ? (
            actionsQ.data.map((a: any) => (
              <div key={a.id} className="p-3 bg-[#0b100b] border border-amber-500/35 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-amber-300">{a.title}</span>
                  <StatusBadge status={a.status} size="sm" />
                </div>
                {a.proposed_step && (
                  <p className="text-xs text-amber-200 font-bold">{a.proposed_step}</p>
                )}
                {a.expected_information && (
                  <p className="text-[11px] text-amber-500/80">
                    <span className="text-emerald-400 font-bold">EXPECTED:</span> {a.expected_information}
                  </p>
                )}
                <div className="flex items-center gap-1.5 pt-1 border-t border-amber-500/20 text-[10px]">
                  <span className="text-amber-500/70 uppercase">STATUS:</span>
                  {['proposed', 'in_progress', 'completed', 'failed'].map((s) => (
                    <button
                      key={s}
                      onClick={() => updateTypeMutation.mutate({ kind: 'action', id: a.id, data: { status: s } })}
                      className="px-2 py-0.5 border border-amber-500/30 bg-black text-amber-300 hover:bg-amber-500/20 uppercase"
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO TACTICAL ACTIONS DISPATCHED YET.
            </div>
          )}
        </div>
      )}

      {/* LEAD DETAIL MODAL */}
      {selectedLead && leadDetailQ.data && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLead(null)}
        >
          <div
            className="border-2 border-amber-500 bg-[#080c08] max-w-2xl w-full max-h-[85vh] overflow-y-auto p-4 space-y-3 font-mono text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-amber-500/40 pb-2">
              <div>
                <span className="text-amber-500/70 text-[10px] uppercase font-bold">LEAD DOSSIER //</span>
                <div className="text-sm font-bold text-amber-300">
                  {leadDetailQ.data.lead.title}
                </div>
              </div>
              <button onClick={() => setSelectedLead(null)} className="text-amber-500 hover:text-amber-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {leadDetailQ.data.lead.description && (
              <p className="text-xs text-amber-200 bg-black/60 p-2.5 border border-amber-500/30">
                {leadDetailQ.data.lead.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1">
                <div className="text-emerald-400 font-bold uppercase text-[10px]">SUPPORTING EVIDENCE:</div>
                <div className="text-amber-200">{leadDetailQ.data.lead.supporting_evidence_refs?.length || 0} Records Attached</div>
              </div>
              <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1">
                <div className="text-red-400 font-bold uppercase text-[10px]">CONFLICTING EVIDENCE:</div>
                <div className="text-amber-200">{leadDetailQ.data.lead.conflicting_evidence_refs?.length || 0} Discrepancies</div>
              </div>
            </div>

            {/* Officer Decision Box */}
            <div className="border-t border-amber-500/30 pt-3 space-y-2">
              <div className="text-[10px] uppercase text-amber-500/80 font-bold">
                RECORD PROGRESS / STATUS UPDATE:
              </div>
              <input
                type="text"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Analyst progress report or case clearance notes..."
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => reviewLeadMutation.mutate({ decision: 'resolved' })}
                  className="px-3 py-1 bg-emerald-500 text-black font-bold text-[10px] uppercase hover:bg-emerald-400"
                >
                  [ RESOLVED ]
                </button>
                <button
                  onClick={() => reviewLeadMutation.mutate({ decision: 'in_progress' })}
                  className="px-3 py-1 bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400"
                >
                  [ IN PROGRESS ]
                </button>
                <button
                  onClick={() => reviewLeadMutation.mutate({ decision: 'dismissed' })}
                  className="px-3 py-1 bg-red-500 text-black font-bold text-[10px] uppercase hover:bg-red-400"
                >
                  [ DISMISS ]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
