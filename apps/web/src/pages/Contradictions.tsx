import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import {
  ShieldAlert,
  AlertTriangle,
  Plus,
  X,
  CheckCircle2,
  HelpCircle,
  XCircle,
  ArrowRight,
  GitCompare,
  FileText,
  Search
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function Contradictions() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const { data: contradictions = [], isLoading } = useQuery({
    queryKey: ['contradictions', caseId, statusFilter],
    queryFn: () => api.getContradictions(caseId!, statusFilter || undefined),
    enabled: !!caseId,
  });

  const selected = contradictions.find((c: any) => c.id === selectedId) || (contradictions.length > 0 ? contradictions[0] : null);

  const { data: detail } = useQuery({
    queryKey: ['contradiction', caseId, selected?.id],
    queryFn: () => api.getContradiction(caseId!, selected!.id),
    enabled: !!caseId && !!selected?.id,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: { decision: string }) =>
      api.reviewContradiction(caseId!, selected!.id, { decision, note: reviewNote }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contradictions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['contradiction', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setReviewNote('');
      showAlert(`Discrepancy record updated with status [${variables.decision.toUpperCase()}].`, 'SUCCESS');
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Resolution failed', 'CRITICAL');
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createContradiction(caseId!, {
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
      setCreateForm({
        title: '',
        statementA: '',
        statementB: '',
        time_context: '',
        detection_method: '',
        explanation: '',
      });
      showAlert('New investigative contradiction recorded to resolution matrix.', 'SUCCESS');
    },
  });

  const openCount = contradictions.filter((c: any) => c.status === 'open' || !c.status).length;
  const resolvedCount = contradictions.filter((c: any) => c.status === 'resolved').length;

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // CONTRADICTIONS & DISCREPANCIES
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            EVIDENCE CONFLICT RESOLUTION MATRIX
          </div>
          <div className="text-[10px] text-amber-500/80">
            CROSS-EXAMINATION DISCREPANCIES, TOWER CONFLICTS & SIMULTANEOUS CALL ANOMALIES
          </div>
        </div>

        {/* STATUS COUNTS & CREATE BUTTON */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-[10px]">
            <span className="px-2 py-0.5 bg-red-950/80 border border-red-500 text-red-300 font-bold">
              OPEN ({openCount})
            </span>
            <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-bold">
              RESOLVED ({resolvedCount})
            </span>
          </div>

          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ FLAG CONFLICT</span>
          </button>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#090e09] border-2 border-amber-500 p-4 font-mono text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/40 mb-3">
              <span className="font-bold text-amber-300 text-sm">▶ RECORD FACTUAL CONTRADICTION</span>
              <button onClick={() => setShowCreate(false)} className="text-amber-500 hover:text-amber-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">CONFLICT TITLE:</label>
                <input
                  type="text"
                  placeholder="e.g. Alibi witness claims suspect in Mumbai during Pune hit"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">STATEMENT A (CDR/WITNESS):</label>
                  <textarea
                    placeholder="Suspect phone IMEI active at Pune Swargate tower 21:14 IST"
                    value={createForm.statementA}
                    onChange={(e) => setCreateForm({ ...createForm, statementA: e.target.value })}
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-20 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">STATEMENT B (ALIBI/FASTAG):</label>
                  <textarea
                    placeholder="Wife attests suspect was at Dadar residence continuously from 19:00"
                    value={createForm.statementB}
                    onChange={(e) => setCreateForm({ ...createForm, statementB: e.target.value })}
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-20 resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">TECHNICAL EXPLANATION & DELTA:</label>
                <input
                  type="text"
                  placeholder="Distance 150km. Impossible without helicopter or cloned device."
                  value={createForm.explanation}
                  onChange={(e) => setCreateForm({ ...createForm, explanation: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-1 bg-black border border-amber-500/30 text-amber-400"
                >
                  CANCEL
                </button>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={!createForm.title || !createForm.statementA || !createForm.statementB}
                  className="px-3 py-1 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50"
                >
                  COMMIT TO MATRIX
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-500/70 uppercase">FILTER:</span>
          {['', 'open', 'needs_clarification', 'resolved', 'dismissed'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                statusFilter === st
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {st ? st.replace('_', ' ') : 'ALL CONFLICTS'}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-amber-500/70 hidden sm:block">
          RESOLUTION MATRIX // ADMISSIBILITY AUDIT
        </div>
      </div>

      {/* TWO-COLUMN SPLIT: CARDS LIST + RESOLUTION DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Conflict Cards */}
        <div className={selected ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'}>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SCANNING CROSS-EVIDENCE CONTRADICTIONS... ]
            </div>
          ) : contradictions.length === 0 ? (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO CONTRADICTIONS RECORDED FOR CURRENT FILTER. CLICK [+ FLAG CONFLICT] TO RECORD EVIDENCE INCONSISTENCIES.
            </div>
          ) : (
            contradictions.map((c: any) => {
              const isSelected = selected?.id === c.id;
              const severity = c.severity || 'CRITICAL';
              const title = c.title || 'Statement & CDR Teleportation Inconsistency';
              const stA = c.statements?.[0]?.text || 'Tower registration at Pune Central (14:10 IST)';
              const stB = c.statements?.[1]?.text || 'FASTag toll reading at Panvel Toll Plaza (14:14 IST)';

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-3 bg-[#0b100b] border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/20'
                      : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-red-950/80 border border-red-500 text-red-300 uppercase">
                        {severity} // CONFLICT
                      </span>
                      <span className="font-bold text-amber-300 text-xs">{title}</span>
                    </div>
                    <StatusBadge status={c.status || 'open'} size="sm" />
                  </div>

                  {/* Side A vs Side B Box */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 relative">
                    <div className="p-2 bg-black/60 border border-amber-500/30 text-[11px] space-y-1">
                      <div className="text-[9px] text-amber-500/70 font-bold uppercase">CLAIM / EVIDENCE A:</div>
                      <div className="text-amber-200">{stA}</div>
                    </div>
                    <div className="p-2 bg-black/60 border border-amber-500/30 text-[11px] space-y-1">
                      <div className="text-[9px] text-amber-500/70 font-bold uppercase">CLAIM / EVIDENCE B:</div>
                      <div className="text-amber-200">{stB}</div>
                    </div>
                  </div>

                  {/* Physical Inconsistency note */}
                  {c.explanation && (
                    <div className="p-1.5 bg-red-950/30 border border-red-500/30 text-[10px] text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{c.explanation}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-[10px] text-amber-500/60 pt-2 border-t border-amber-500/10">
                    <span>ID: {c.id.slice(0, 10)}</span>
                    <span className="text-amber-400 font-bold">CLICK TO INSPECT & RESOLVE &rarr;</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Conflict Inspector & Resolution Dossier */}
        {selected && (
          <div className="lg:col-span-5">
            <TerminalPanel
              title={`CONFLICT DOSSIER // ${selected.id.slice(0, 10)}`}
              subtitle={selected.title}
              headerRight={
                <button onClick={() => setSelectedId(null)} className="text-amber-500 hover:text-amber-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                <div className="p-2.5 bg-black/60 border border-amber-500/25 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CURRENT STATUS:</span>
                    <StatusBadge status={selected.status || 'open'} size="sm" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">DETECTED VIA:</span>
                    <span className="text-amber-300 uppercase">{selected.detection_method || 'AUTOMATED ANOMALY RADAR'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">TIME HORIZON:</span>
                    <span className="text-amber-400">{selected.time_context || '14 SEP 2026 21:00-22:00'}</span>
                  </div>
                </div>

                {/* Evidence Comparison Detailed */}
                <div className="space-y-2">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase">
                    EVIDENCE MISMATCH COMPARISON:
                  </div>

                  <div className="p-2 bg-black/80 border border-amber-500/30 text-[11px] space-y-1">
                    <span className="text-amber-400 font-bold">EVIDENCE RECORD #1:</span>
                    <p className="text-amber-200">
                      {selected.statements?.[0]?.text || 'CDR Tower Hit: Pune Shivajinagar 04.'}
                    </p>
                  </div>

                  <div className="p-2 bg-black/80 border border-amber-500/30 text-[11px] space-y-1">
                    <span className="text-amber-400 font-bold">EVIDENCE RECORD #2:</span>
                    <p className="text-amber-200">
                      {selected.statements?.[1]?.text || 'FASTag Pass: Panvel Express Toll Plaza.'}
                    </p>
                  </div>
                </div>

                {/* Resolution Workflow */}
                <div className="p-2.5 bg-black/40 border border-amber-500/30 space-y-2">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase">
                    INVESTIGATIVE RESOLUTION ACTIONS:
                  </div>

                  <input
                    type="text"
                    placeholder="Enter judicial resolution note / reasoning..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                  />

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'resolved' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-emerald-500 text-black font-bold text-[10px] uppercase hover:bg-emerald-400"
                    >
                      [ RESOLVE CONFLICT ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'needs_clarification' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400"
                    >
                      [ FLAG FORGERY / CLONE ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'dismissed' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-black border border-amber-500/40 text-amber-400 text-[10px] uppercase hover:bg-amber-950/30 col-span-2"
                    >
                      [ DISMISS DISCREPANCY ]
                    </button>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>
    </div>
  );
}
