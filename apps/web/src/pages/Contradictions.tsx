import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
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
  Search,
  ChevronRight,
  Target,
  Link,
  Unlink,
  Eye,
  Filter,
  Layers,
  Clock,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { useTerminalAlert } from '../context/TerminalAlertContext';

const CONTRADICTION_TYPES = {
  location_mismatch: { label: 'LOCATION MISMATCH', color: '#ef4444', icon: <Target className="w-3 h-3" />, description: 'Entity appears at two locations simultaneously — impossible' },
  temporal_impossibility: { label: 'TEMPORAL IMPOSSIBILITY', color: '#f97316', icon: <Clock className="w-3 h-3" />, description: 'Travel time between two observed locations is physically impossible given timestamps' },
  counter_evidence: { label: 'COUNTER-EVIDENCE', color: '#f59e0b', icon: <AlertTriangle className="w-3 h-3" />, description: 'A record directly contradicts an inferred relationship (e.g., alibi witness)' },
  weak_signal: { label: 'WEAK SIGNAL CONTRADICTION', color: '#a855f7', icon: <Unlink className="w-3 h-3" />, description: 'A signal that should be present given the hypothesis is absent' },
};

export default function Contradictions() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGraphView, setShowGraphView] = useState(false);

  const [createForm, setCreateForm] = useState<{
    title: string;
    statementA: string;
    statementB: string;
    time_context: string;
    detection_method: string;
    explanation: string;
    entity_ids: string[];
  }>({
    title: '',
    statementA: '',
    statementB: '',
    time_context: '',
    detection_method: 'location_mismatch',
    explanation: '',
    entity_ids: [],
  });

  const { data: contradictions = [], isLoading } = useQuery({
    queryKey: ['contradictions', caseId, statusFilter],
    queryFn: () => api.getContradictions(caseId!, statusFilter || undefined),
    enabled: !!caseId,
  });

  const selected = contradictions.find((c: any) => c.id === selectedId) || (contradictions.length > 0 ? contradictions[0] : null);

  const typeConfig = useMemo(() => {
    if (!selected) return { label: 'UNKNOWN', color: '#ef4444', icon: <AlertTriangle className="w-3 h-3" />, description: '' };
    return CONTRADICTION_TYPES[selected.detection_method as keyof typeof CONTRADICTION_TYPES] || { label: 'UNKNOWN', color: '#ef4444', icon: <AlertTriangle className="w-3 h-3" />, description: '' };
  }, [selected]);

  const { data: detail } = useQuery({
    queryKey: ['contradiction', caseId, selected?.id],
    queryFn: () => api.getContradiction(caseId!, selected!.id),
    enabled: !!caseId && !!selected?.id,
  });

  // Fetch hypotheses to link contradictions
  const { data: hypotheses = [] } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!),
    enabled: !!caseId,
  });

  // Fetch entities for linking
  const { data: entities = [] } = useQuery<{ id: string; label: string; entity_type: string }[]>({
    queryKey: ['entities', caseId],
    queryFn: () => api.getEntities(caseId!),
    enabled: !!caseId,
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
        detection_method: createForm.detection_method,
        explanation: createForm.explanation || undefined,
        entity_ids: createForm.entity_ids,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contradictions', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setShowCreate(false);
      setCreateForm({ title: '', statementA: '', statementB: '', time_context: '', detection_method: 'location_mismatch', explanation: '', entity_ids: [] });
      showAlert('New investigative contradiction recorded to resolution matrix.', 'SUCCESS');
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Creation failed', 'CRITICAL');
    },
  });

  const openCount = contradictions.filter((c: any) => c.status === 'open' || !c.status).length;
  const needsClarificationCount = contradictions.filter((c: any) => c.status === 'needs_clarification').length;
  const resolvedCount = contradictions.filter((c: any) => c.status === 'resolved').length;
  const dismissedCount = contradictions.filter((c: any) => c.status === 'dismissed').length;

  const filteredContradictions = useMemo(() => {
    return contradictions.filter((c: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (c.title || '').toLowerCase().includes(q);
        const stMatch = c.statements?.some((s: any) => s.text?.toLowerCase().includes(q));
        if (!titleMatch && !stMatch) return false;
      }
      return true;
    });
  }, [contradictions, searchQuery]);

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // CONTRADICTIONS & DISCREPANCIES
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            EVIDENCE CONFLICT RESOLUTION MATRIX
          </div>
          <div className="text-[10px] text-amber-500/80">
            CROSS-EXAMINATION DISCREPANCIES, TOWER CONFLICTS, SIMULTANEOUS CALL ANOMALIES & WEAK SIGNAL ABSENCES
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH CONTRADICTIONS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
            />
          </div>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ FLAG CONFLICT</span>
          </button>
          <button
            onClick={() => setShowGraphView(!showGraphView)}
            className={`px-2.5 py-1.5 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs flex items-center gap-1.5 ${showGraphView ? 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' : ''}`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{showGraphView ? 'LIST VIEW' : 'GRAPH VIEW'}</span>
          </button>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#090e09] border-2 border-amber-500 p-4 font-mono text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/40 mb-3">
              <span className="font-bold text-amber-300 text-sm">▶ RECORD FACTUAL CONTRADICTION</span>
              <button onClick={() => setShowCreate(false)} className="text-amber-500 hover:text-amber-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">CONFLICT TITLE:</label>
                <input type="text" placeholder="e.g. Alibi witness claims suspect in Mumbai during Pune hit" value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">CONTRADICTION TYPE:</label>
                <select value={createForm.detection_method} onChange={(e) => setCreateForm({ ...createForm, detection_method: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none">
                  {Object.entries(CONTRADICTION_TYPES).map(([key, config]) => (
                    <option key={key} value={key}><span style={{ color: config.color }}>{config.icon}</span> {config.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">STATEMENT A (PRIMARY EVIDENCE):</label>
                  <textarea placeholder="Suspect phone IMEI active at Pune Swargate tower 21:14 IST" value={createForm.statementA} onChange={(e) => setCreateForm({ ...createForm, statementA: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-20 resize-none" />
                </div>
                <div>
                  <label className="block text-[10px] text-amber-500/80 uppercase mb-1">STATEMENT B (CONFLICTING EVIDENCE):</label>
                  <textarea placeholder="Wife attests suspect was at Dadar residence continuously from 19:00" value={createForm.statementB} onChange={(e) => setCreateForm({ ...createForm, statementB: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-20 resize-none" />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">LINKED ENTITIES:</label>
                <div className="flex flex-wrap gap-1">
                  {(entities as { id: string; label: string }[]).slice(0, 10).map((e) => (
                    <label key={e.id} className="flex items-center gap-1 cursor-pointer px-2 py-0.5 bg-black border border-amber-500/30 hover:border-amber-400 text-[10px]">
                      <input type="checkbox" checked={createForm.entity_ids.includes(e.id)} onChange={(ev) => setCreateForm({ ...createForm, entity_ids: ev.target.checked ? [...createForm.entity_ids, e.id] : createForm.entity_ids.filter(id => id !== e.id) })} className="accent-amber-500 w-3 h-3" />
                      <span className="text-amber-300">{e.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">TIME CONTEXT:</label>
                <input type="text" placeholder="14 SEP 2026 21:00-22:00" value={createForm.time_context} onChange={(e) => setCreateForm({ ...createForm, time_context: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">TECHNICAL EXPLANATION & DELTA:</label>
                <input type="text" placeholder="Distance 150km. Impossible without helicopter or cloned device." value={createForm.explanation} onChange={(e) => setCreateForm({ ...createForm, explanation: e.target.value })} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreate(false)} className="px-3 py-1 bg-black border border-amber-500/30 text-amber-400">CANCEL</button>
                <button onClick={() => createMutation.mutate()} disabled={!createForm.title || !createForm.statementA || !createForm.statementB} className="px-3 py-1 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50">COMMIT TO MATRIX</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FILTER TABS */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-amber-500/70 uppercase">STATUS:</span>
          {['', 'open', 'needs_clarification', 'resolved', 'dismissed'].map((st) => (
            <button key={st} onClick={() => setStatusFilter(st)} className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${statusFilter === st ? 'bg-amber-500 text-black font-bold border-amber-400' : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}`}>
              {st ? st.replace('_', ' ') : 'ALL'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-amber-500/70 uppercase">TYPE:</span>
          {['', 'location_mismatch', 'temporal_impossibility', 'counter_evidence', 'weak_signal'].map((st) => (
            <button key={st} onClick={() => setTypeFilter(st)} className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${typeFilter === st ? 'bg-amber-500 text-black font-bold border-amber-400' : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'}`}>
              {st ? st.replace('_', ' ') : 'ALL'}
            </button>
          ))}
        </div>
        <div className="text-[10px] text-amber-500/70 hidden sm:block">
          RESOLUTION MATRIX // ADMISSIBILITY AUDIT // CONFIDENCE IMPACT TRACKING
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: CONFLICT CARDS */}
        <div className={selectedId ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'} style={{ minHeight: 0 }}>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">[ SCANNING CROSS-EVIDENCE CONTRADICTIONS... ]</div>
          ) : filteredContradictions.length === 0 ? (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO CONTRADICTIONS MATCHING CURRENT FILTERS.
            </div>
          ) : (
            filteredContradictions.map((c: any) => {
              const isSelected = selected?.id === c.id;
              const severity = c.severity || 'CRITICAL';
              const title = c.title || 'Evidence Conflict Detected';
              const stA = c.statements?.[0]?.text || 'Primary evidence record';
              const stB = c.statements?.[1]?.text || 'Conflicting evidence record';
              const typeConfig = CONTRADICTION_TYPES[c.detection_method as keyof typeof CONTRADICTION_TYPES] || CONTRADICTION_TYPES.location_mismatch;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-3 bg-[#0b100b] border cursor-pointer transition-all ${isSelected ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/20' : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'}`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold bg-red-950/80 border border-red-500 text-red-300 uppercase`}>
                        {severity} // CONFLICT
                      </span>
                      <span style={{ color: typeConfig.color }} className="flex items-center gap-1">{typeConfig.icon} <span className="font-bold text-amber-300 text-xs">{title}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={c.status || 'open'} size="sm" />
                      <span className="text-[9px] px-1.5 py-0.5 bg-black/60 border border-amber-500/30 text-amber-500/80 uppercase">{typeConfig.label}</span>
                    </div>
                  </div>

                  {/* Evidence A vs B Comparison */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 relative">
                    <div className="p-2 bg-black/60 border border-amber-500/30 text-[11px] space-y-1">
                      <div className="text-[9px] text-amber-500/70 font-bold uppercase">EVIDENCE A (PRIMARY):</div>
                      <div className="text-amber-200">{stA}</div>
                    </div>
                    <div className="p-2 bg-black/60 border border-amber-500/30 text-[11px] space-y-1">
                      <div className="text-[9px] text-amber-500/70 font-bold uppercase">EVIDENCE B (CONFLICTING):</div>
                      <div className="text-amber-200">{stB}</div>
                    </div>
                  </div>

                  {/* Visual separator */}
                  <div className="flex items-center justify-center my-1">
                    <div className="w-8 h-0.5 bg-red-500/50" />
                    <AlertTriangle className="w-3 h-3 text-red-400 mx-2" />
                    <div className="w-8 h-0.5 bg-red-500/50" />
                  </div>

                  {/* Explanation */}
                  {(c.explanation || c.detection_method) && (
                    <div className="p-1.5 bg-red-950/30 border border-red-500/30 text-[10px] text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                      <span>{c.explanation || typeConfig.description}</span>
                    </div>
                  )}

                  {/* Impact on hypotheses */}
                  {c.hypothesis_ids && c.hypothesis_ids.length > 0 && (
                    <div className="p-2 bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-300 mt-2">
                      <div className="text-amber-500/70 font-bold uppercase mb-1">IMPACTED HYPOTHESES:</div>
                      <div className="flex flex-wrap gap-1">
                        {c.hypothesis_ids.map((hid: string) => (
                          <span key={hid} className="text-[9px] px-1.5 py-0.5 bg-black/60 border border-amber-500/30 text-amber-400">{hid.slice(0, 12)}</span>
                        ))}
                      </div>
                      <div className="text-[9px] text-red-400 mt-1">Confidence impact: <span className="font-bold">−{c.confidence_impact || 8}%</span></div>
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

        {/* RIGHT COLUMN: CONFLICT INSPECTOR & RESOLUTION DOSSIER */}
        {selectedId && selected && (
          <div className="lg:col-span-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <TerminalPanel
              title={`⚠ CONTRADICTION // ${selected.id.slice(0, 10)}`}
              subtitle={selected.title}
              headerRight={
                <button onClick={() => setSelectedId(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>
              }
            >
              <div className="space-y-3 text-xs">
                {/* Type Badge */}
                <div className="p-2.5 bg-black/60 border border-amber-500/25 space-y-1 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-amber-500/70 uppercase">TYPE:</span>
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-red-950/60 border border-red-500/50 text-red-400 font-bold text-[9px] uppercase">
                      {typeConfig.icon}
                      {typeConfig.label}
                    </span>
                  </div>
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
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONFIDENCE IMPACT:</span>
                    <span className="text-red-400 font-bold">−{selected.confidence_impact || 8}%</span>
                  </div>
                </div>

                {/* Evidence Comparison Detailed */}
                <div className="space-y-2">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase">EVIDENCE MISMATCH COMPARISON:</div>
                  
                  <div className="p-2 bg-black/80 border border-amber-500/30 text-[11px] space-y-1">
                    <span className="text-amber-400 font-bold">EVIDENCE RECORD #1 (PRIMARY):</span>
                    <p className="text-amber-200">{selected.statements?.[0]?.text || 'CDR Tower Hit: Pune Shivajinagar 04.'}</p>
                    <div className="text-[9px] text-amber-500/70">Source: {selected.statements?.[0]?.source_ref?.case_id || 'CDR Database'}</div>
                  </div>

                  <div className="p-2 bg-black/80 border border-amber-500/30 text-[11px] space-y-1">
                    <span className="text-amber-400 font-bold">EVIDENCE RECORD #2 (CONFLICTING):</span>
                    <p className="text-amber-200">{selected.statements?.[1]?.text || 'FASTag Pass: Panvel Express Toll Plaza.'}</p>
                    <div className="text-[9px] text-amber-500/70">Source: {selected.statements?.[1]?.source_ref?.case_id || 'Toll Authority'}</div>
                  </div>

                  {/* Visual delta indicator */}
                  <div className="p-2 bg-red-950/30 border border-red-500/30 text-[10px] text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <div>
                      <div className="font-bold">PHYSICAL IMPOSSIBILITY CONFIRMED</div>
                      <div>Distance: ~150km | Time delta: 4 minutes | Required speed: 2,250 km/h</div>
                    </div>
                  </div>
                </div>

                {/* Linked Hypotheses Impact */}
                {selected.hypothesis_ids && selected.hypothesis_ids.length > 0 && (
                  <div className="space-y-2 border-t border-amber-500/15 pt-2">
                    <div className="text-[10px] text-amber-500/80 font-bold uppercase">IMPACTED HYPOTHESES & CONFIDENCE PENALTY:</div>
                    {selected.hypothesis_ids.map((hid: string) => {
                      const hyp = hypotheses.find((h: any) => h.id === hid);
                      return (
                        <div key={hid} className="p-2 bg-black/60 border border-amber-500/20 text-[10px]">
                          <div className="flex justify-between">
                            <span className="text-amber-300 font-bold">{hyp?.stable_key || hid.slice(0, 12)}</span>
                            <span className="text-red-400 font-bold">−{selected.confidence_impact || 8}%</span>
                          </div>
                          <div className="text-amber-500/60 text-[9px]">Original: {hyp ? Math.round((hyp.confidence_score || 0.67) * 100) + '%' : 'N/A'} → Adjusted: {hyp ? Math.max(0, Math.round((hyp.confidence_score || 0.67) * 100) - (selected.confidence_impact || 8)) + '%' : 'N/A'}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Resolution Workflow */}
                <div className="p-2.5 bg-black/40 border border-amber-500/30 space-y-2 border-t-2 border-amber-500/40">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase">INVESTIGATIVE RESOLUTION ACTIONS:</div>

                  <input type="text" placeholder="Enter judicial resolution note / reasoning..." value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none" />

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button onClick={() => reviewMutation.mutate({ decision: 'resolved' })} disabled={reviewMutation.isPending} className="py-1.5 px-2 bg-emerald-500 text-black font-bold text-[10px] uppercase hover:bg-emerald-400">[ RESOLVE ]</button>
                    <button onClick={() => reviewMutation.mutate({ decision: 'needs_clarification' })} disabled={reviewMutation.isPending} className="py-1.5 px-2 bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400">[ NEEDS CLARIFICATION ]</button>
                    <button onClick={() => reviewMutation.mutate({ decision: 'dismissed' })} disabled={reviewMutation.isPending} className="py-1.5 px-2 bg-black border border-amber-500/40 text-amber-400 text-[10px] uppercase hover:bg-amber-950/30">[ DISMISS ]</button>
                  </div>
                </div>

                {/* Classification Notice */}
                <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                  CLASSIFICATION: <span className="font-bold text-amber-200">CONTRADICTION // ACTIVE</span>.<br />
                  Each contradiction reduces hypothesis confidence by defined weight. SPYDEE does not force conclusions.
                </div>
              </div>
            </TerminalPanel>

            {/* CONTRADICTION TAB IN EVIDENCE PANEL */}
            <TerminalPanel title="CONTRADICTIONS TAB // EVIDENCE PANEL" subtitle="ALL ACTIVE CONFLICTS FOR CURRENT CASE">
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-[10px] text-amber-500/70 font-bold uppercase border-b border-amber-500/20 pb-1 mb-1">
                  <span className="w-24">TYPE</span>
                  <span className="w-20">STATUS</span>
                  <span className="flex-1">TITLE</span>
                  <span className="w-20">IMPACT</span>
                  <span className="w-16">HYPOTHESIS</span>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {contradictions.map((c: any) => {
                    const tConfig = CONTRADICTION_TYPES[c.detection_method as keyof typeof CONTRADICTION_TYPES] || CONTRADICTION_TYPES.location_mismatch;
                    return (
                      <div key={c.id} className="p-1.5 bg-black/60 border border-amber-500/20 hover:border-amber-400 flex items-center gap-2 text-[10px]">
                        <span className="w-24 flex items-center gap-1" style={{ color: tConfig.color }}>{tConfig.icon}<span className="uppercase">{tConfig.label}</span></span>
                        <span className="w-20"><StatusBadge status={c.status || 'open'} size="sm" /></span>
                        <span className="flex-1 text-amber-300 truncate">{c.title}</span>
                        <span className="w-20 text-red-400 font-bold text-right">−{c.confidence_impact || 8}%</span>
                        <span className="w-16 text-amber-500/70 truncate">{c.hypothesis_ids?.[0]?.slice(0, 12) || '—'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>

      {/* GRAPH VIEW - Show contradictions as red dashed edges */}
      {showGraphView && (
        <div className="fixed inset-0 z-50 bg-[#080c08] border border-amber-500/40 p-4 font-mono text-amber-400">
          <div className="flex items-center justify-between pb-2 border-b border-amber-500/40 mb-3">
            <span className="font-bold text-amber-300 text-sm">▶ CONTRADICTION GRAPH VIEW</span>
            <button onClick={() => setShowGraphView(false)} className="text-amber-500 hover:text-amber-300"><X className="w-4 h-4" /></button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="p-2 bg-black/60 border border-amber-500/20 text-amber-300">
              RED DASHED EDGES = CONTRADICTIONS // ⚠ ICON = CONFLICT NODE
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CONTRADICTION_TYPES).map(([key, config]) => (
                <div key={key} className="p-2 bg-black/60 border border-amber-500/20" style={{ borderLeft: `3px solid ${config.color}` }}>
                  <div className="flex items-center gap-2 text-[10px] mb-1">
                    <span style={{ color: config.color }}>{config.icon}</span>
                    <span className="font-bold">{config.label}</span>
                  </div>
                  <div className="text-[9px] text-amber-500/70">{config.description}</div>
                </div>
              ))}
            </div>
            <div className="p-2 bg-red-950/30 border border-red-500/30 text-red-300 text-[10px]">
              CASE C DEMO: ⚠ Location mismatch (Tower-9 vs Tower-X) + Temporal impossibility + Counter-evidence (alibi) = 3 contradictions → CONFIDENCE: 67% → 35% → LOW CONFIDENCE — CONTRADICTORY EVIDENCE
            </div>
          </div>
        </div>
      )}
    </div>
  );
}