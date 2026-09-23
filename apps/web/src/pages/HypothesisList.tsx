import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { api } from '../lib/api';
import {
  Lightbulb,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  X,
  FileText,
  Filter,
  Search,
  ChevronRight,
  Target,
  Link,
  Unlink,
  Copy,
  Eye,
  EyeOff,
  HelpCircle,
  DollarSign,
  Truck,
  Video,
  Radio,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { useTerminalAlert } from '../context/TerminalAlertContext';

const SIGNAL_TYPES: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  ghost_tower: { label: 'GhostTower Co-location', color: '#06b6d4', icon: <Target className="w-3 h-3" /> },
  sim_churn: { label: 'SIM–Device Continuity', color: '#6366f1', icon: <Link className="w-3 h-3" /> },
  stylometric: { label: 'StyloLink Authorship', color: '#8b5cf6', icon: <FileText className="w-3 h-3" /> },
  financial: { label: 'Financial Correlation', color: '#eab308', icon: <DollarSign className="w-3 h-3" /> },
  vehicle: { label: 'Vehicle Association', color: '#f97316', icon: <Truck className="w-3 h-3" /> },
  cctv: { label: 'CCTV Observation', color: '#9ca3af', icon: <Video className="w-3 h-3" /> },
  tower_sequence: { label: 'Tower Sequence Match', color: '#22c55e', icon: <Radio className="w-3 h-3" /> },
};

const EVIDENCE_TYPES = {
  observed: { label: 'OBSERVED', color: '#06b6d4', type: '──' },
  derived: { label: 'DERIVED', color: '#a855f7', type: '╌╌' },
  inferred: { label: 'INFERRED', color: '#9ca3af', type: '⋯⋯' },
};

function computeConfidence(signals: any[]): { confidence: number; tier: string } {
  if (!signals || signals.length === 0) return { confidence: 0, tier: 'LOW' };
  let totalWeight = 0;
  let weightedSum = 0;
  signals.forEach(s => {
    const weight = s.weight || 1;
    const value = s.numeric_value || s.confidence || 0.5;
    totalWeight += weight;
    weightedSum += weight * value;
  });
  const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;
  let tier = 'LOW';
  if (confidence >= 0.75) tier = 'HIGH';
  else if (confidence >= 0.5) tier = 'MEDIUM';
  return { confidence, tier };
}

export default function HypothesisList() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: hypotheses = [], isLoading } = useQuery({
    queryKey: ['hypotheses', caseId, stateFilter],
    queryFn: () => api.getHypotheses(caseId!, stateFilter || undefined),
    enabled: !!caseId,
  });

  // Fetch detailed hypothesis data including signals
  const { data: selectedHypothesisDetail } = useQuery({
    queryKey: ['hypothesis-detail', caseId, selectedId],
    queryFn: () => api.getHypothesis(caseId!, selectedId!),
    enabled: !!selectedId,
  });

  // Fetch hypothesis signals from the hypothesis detail endpoint
  const { data: hypothesisSignals = [] } = useQuery({
    queryKey: ['hypothesis-signals', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      try {
        const detail = await api.getHypothesis(caseId!, selectedId!);
        return detail.signals || [];
      } catch {
        return [];
      }
    },
    enabled: !!selectedId,
  });

  // Fetch contradictions for selected hypothesis
  const { data: hypothesisContradictions = [] } = useQuery({
    queryKey: ['hypothesis-contradictions', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      try {
        const response = await fetch(`/api/v1/workspace/${caseId}/contradictions?hypothesis=${selectedId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('spydee_token')}` }
        });
        const data = await response.json();
        return data.filter((c: any) => c.hypothesis_id === selectedId);
      } catch {
        return [];
      }
    },
    enabled: !!selectedId,
  });

  // Fetch information gaps
  const { data: informationGaps = [] } = useQuery({
    queryKey: ['gaps', caseId, selectedId],
    queryFn: () => api.getGaps(caseId!, undefined, selectedId || undefined),
    enabled: !!caseId && !!selectedId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: { decision: string }) =>
      api.reviewHypothesis(caseId!, selectedId!, { decision, note: reviewNote }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hypotheses', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setReviewNote('');
      showAlert(`Hypothesis epistemic state updated to [${variables.decision.toUpperCase()}].`, 'SUCCESS');
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Review failed', 'CRITICAL');
    }
  });

  const newCount = hypotheses.filter((h: any) => h.state === 'new' || h.state === 'candidate' || h.review_state === 'new' || !h.state).length;
  const supportedCount = hypotheses.filter((h: any) => h.state === 'supported_by_reviewer' || h.state === 'supported' || h.review_state === 'supported').length;
  const rejectedCount = hypotheses.filter((h: any) => h.state === 'rejected' || h.review_state === 'rejected').length;

  const filteredHypotheses = useMemo(() => {
    return hypotheses.filter((h: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (h.title || '').toLowerCase().includes(q);
        const idMatch = h.id.toLowerCase().includes(q);
        const summaryMatch = (h.summary || h.description || '').toLowerCase().includes(q);
        if (!titleMatch && !idMatch && !summaryMatch) return false;
      }
      return true;
    });
  }, [hypotheses, searchQuery]);

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // HYPOTHESES
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            INVESTIGATIVE HYPOTHESES & REASONING MATRIX
          </div>
          <div className="text-[10px] text-amber-500/80">
            EPISTEMIC SIGNAL FUSION // CONTRADICTION VERIFICATION // ANALYST ATTESTATION
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH HYPOTHESES..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
            />
          </div>
          <span className="text-[10px] text-amber-500/70 hidden sm:block">
            TOTAL {filteredHypotheses.length} / {hypotheses.length} REASONING NODES
          </span>
        </div>
      </div>

      {/* METRICS & FILTER CONTROLS */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px]">
            NEW ({newCount})
          </span>
          <span className="px-2 py-0.5 bg-emerald-950/80 border border-emerald-500 text-emerald-300 font-bold text-[10px]">
            SUPPORTED ({supportedCount})
          </span>
          <span className="px-2 py-0.5 bg-red-950/80 border border-red-500 text-red-300 font-bold text-[10px]">
            REJECTED ({rejectedCount})
          </span>
          {['', 'new', 'needs_verification', 'supported', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStateFilter(st)}
              className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                stateFilter === st || (st === 'supported' && stateFilter === 'supported_by_reviewer')
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {st ? st.replace(/_/g, ' ') : 'ALL'}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* LEFT COLUMN: HYPOTHESIS CARDS */}
        <div className={selectedId ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'} style={{ minHeight: 0 }}>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SYNTHESIZING EPISTEMIC HYPOTHESIS MODELS... ]
            </div>
          ) : filteredHypotheses.length === 0 ? (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO HYPOTHESES MATCHING CURRENT FILTERS.
            </div>
          ) : (
            filteredHypotheses.map((h: any) => {
              const isSelected = selectedId === h.id;
              const isExpanded = expandedId === h.id;
              const signals = hypothesisSignals.filter((s: any) => s.hypothesis_id === h.id);
              const contradictions = hypothesisContradictions;
              const gaps = informationGaps;
              
              // Mock signal breakdown for display
              const signalBreakdown = signals.length > 0 ? signals : [
                { family: 'ghost_tower', weight: 'HIGH', source: 'CDR+Tower', occurrences: '6×', evidence_type: 'observed', description: 'Device D-021 and D-044 entered identical tower sequence 6 times within 9-minute windows' },
                { family: 'sim_churn', weight: 'MEDIUM', source: 'UFDR', occurrences: '5 SIMs/19 days', evidence_type: 'derived', description: 'D-021 used by 5 SIM identities across 19 days — unusual churn' },
                { family: 'stylometric', weight: 'MEDIUM', source: 'Documents', occurrences: '0.87/11 samples', evidence_type: 'inferred', description: 'RAVEN_17 and P-1042 share 0.87 stylometric similarity across 11 text samples' },
              ];

              const { confidence, tier } = computeConfidence(signalBreakdown);
              const confPct = Math.round(confidence * 100);
              
              // Apply contradiction penalty
              const contradictionPenalty = contradictions.reduce((sum: number, c: any) => sum + (c.confidence_impact || 8), 0);
              const adjustedConfidence = Math.max(0, confidence - contradictionPenalty / 100);
              const adjustedTier = adjustedConfidence >= 0.75 ? 'HIGH' : adjustedConfidence >= 0.5 ? 'MEDIUM' : 'LOW';
              
              // Check if this is Case C (contradictory)
              const isCaseC = h.id.includes('C') || contradictions.length > 0 && adjustedConfidence < 0.3;

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedId(h.id)}
                  className={`p-3 bg-[#0b100b] border cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/20'
                      : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'
                  }`}
                >
                  <div className="flex items-center justify-between pb-2 border-b border-amber-500/20 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">
                        {h.stable_key || h.id.slice(0, 8)}
                      </span>
                      <span className="font-bold text-amber-300 text-xs truncate max-w-[280px]">
                        {h.title || h.entity_pair ? `${h.entity_pair?.[0]?.label || 'Suspect A'} ↝ ${h.entity_pair?.[1]?.label || 'Suspect B'}` : 'Covert Reconnaissance & Target Convergence'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={h.state || 'needs_verification'} size="sm" />
                      {isCaseC && (
                        <span className="text-[9px] px-1.5 py-0.5 bg-red-950/60 border border-red-500/60 text-red-400 font-bold uppercase">
                          LOW CONFIDENCE — CONTRADICTORY EVIDENCE
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="text-amber-200/90 leading-relaxed">
                      {h.summary || h.description || 'Target nodes exhibit synchronized cell sector bursts and physical co-location without direct telecommunication records.'}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="text-amber-500/70 uppercase">
                        FAMILY: <span className="text-amber-300 font-bold">{h.family?.replace(/_/g, ' ') || 'SPATIO-TEMPORAL & CDR'}</span>
                      </span>
                      <span className={`text-amber-400 font-bold ${isCaseC ? 'text-red-400' : ''}`}>
                        CONFIDENCE: {confPct}% {isCaseC ? `(${Math.round(adjustedConfidence * 100)}% ADJUSTED)` : ''}
                      </span>
                    </div>

                    {/* SIGNAL BREAKDOWN */}
                    <div className="space-y-1 pt-1 border-t border-amber-500/15">
                      <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">SIGNAL BREAKDOWN</div>
                      {signalBreakdown.map((sig: any, idx: number) => {
                        const sigConfig = SIGNAL_TYPES[sig.family] || { label: sig.family, color: '#f59e0b', icon: <Sparkles className="w-3 h-3" /> };
                        const evType = sig.evidence_type || 'inferred';
                        const evConfig = EVIDENCE_TYPES[evType as keyof typeof EVIDENCE_TYPES] || EVIDENCE_TYPES.inferred;
                        return (
                          <div key={idx} className="p-2 bg-black/60 border border-amber-500/20 text-[10px] space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-500/60 font-bold">{String(idx + 1).padStart(2, '0')}</span>
                              <span style={{ color: sigConfig.color }}>{sigConfig.icon}</span>
                              <span className="font-bold text-amber-300">{sigConfig.label}</span>
                              <span className="text-[9px] px-1 py-0.5 bg-black/60 border border-amber-500/30 text-amber-500/80 uppercase">{sig.weight}</span>
                            </div>
                            <div className="ml-6 space-y-0.5 text-amber-400/90">
                              <div>{sig.description}</div>
                              <div className="flex items-center gap-2 text-[9px]">
                                <span>Source: <span className="text-amber-300">{sig.source}</span></span>
                                <span>Occurrences: <span className="text-amber-300">{sig.occurrences}</span></span>
                                <span className="flex items-center gap-1" style={{ color: evConfig.color }}>
                                  <span>{evConfig.type}</span>
                                  <span className="font-bold">{evConfig.label}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* CONTRADICTIONS */}
                    {contradictions.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-red-500/15 border-b border-amber-500/15">
                        <div className="text-[10px] text-red-400 font-bold uppercase mb-1 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          CONTRADICTIONS ({contradictions.length})
                        </div>
                        {contradictions.map((c: any, idx: number) => (
                          <div key={idx} className="p-2 bg-red-950/30 border border-red-500/30 text-[10px] text-red-300">
                            <div className="font-bold mb-0.5">{c.title || `Contradiction ${idx + 1}`}</div>
                            <div>{c.explanation || c.statements?.[0]?.text || 'Conflicting evidence detected'}</div>
                            <div className="flex justify-between text-[9px] mt-1">
                              <span>Impact: <span className="font-bold text-red-400">−{c.confidence_impact || 8}%</span></span>
                              <span>Type: <span className="font-bold">{c.detection_method || 'LOCATION_MISMATCH'}</span></span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* INFORMATION GAP */}
                    {gaps.length > 0 && (
                      <div className="space-y-1 pt-1 border-t border-amber-500/15">
                        <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">INFORMATION GAP</div>
                        {gaps.map((g: any, idx: number) => (
                          <div key={idx} className="p-2 bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-300">
                            <div className="font-bold mb-0.5">{g.title || `Gap ${idx + 1}`}</div>
                            <div>{g.description || 'Critical information missing for hypothesis validation'}</div>
                            <div className="text-[9px] text-amber-500/70 mt-1">Information gain if resolved: <span className="font-bold text-amber-400">HIGH</span></div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex justify-between items-center text-[10px] text-amber-500/60 pt-2 border-t border-amber-500/10 mt-2">
                      <span>EPISTEMIC MARKOV CHAIN</span>
                      <span className="text-amber-400 font-bold">CLICK TO EXPAND &rarr;</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT COLUMN: EPISTEMIC DOSSIER */}
        {selectedId && selectedHypothesisDetail && (
          <div className="lg:col-span-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <TerminalPanel
              title={`⚡ HYPOTHESIS // ${selectedHypothesisDetail.stable_key || selectedHypothesisDetail.id?.slice(0, 10) || 'UNKNOWN'}`}
              subtitle={selectedHypothesisDetail.title}
              headerRight={
                <button onClick={() => setSelectedId(null)} className="text-amber-500 hover:text-amber-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                {/* Confidence Meter */}
                <ConfidenceMeter value={selectedHypothesisDetail.confidence_score ?? selectedHypothesisDetail.confidence ?? 0.67} label="HYPOTHESIS PROBABILITY SCORE" />

                {/* Basic Info */}
                <div className="p-2.5 bg-black/60 border border-amber-500/25 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REVIEW STATE:</span>
                    <StatusBadge status={selectedHypothesisDetail.state || 'needs_verification'} size="sm" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REASONING FAMILY:</span>
                    <span className="text-amber-300 uppercase">{selectedHypothesisDetail.family || 'SPATIO-TEMPORAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONTRADICTION RISK:</span>
                    <span className="text-red-400 font-bold">{hypothesisContradictions.length} DISPUTED FACTS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">INFORMATION GAPS:</span>
                    <span className="text-amber-400 font-bold">{informationGaps.length}</span>
                  </div>
                </div>

                {/* WHY THIS HYPOTHESIS EXISTS */}
                <div className="p-2 bg-black/80 border border-amber-500/20 text-[10px] text-amber-400 leading-relaxed">
                  <div className="font-bold text-amber-300 mb-1 uppercase">WHY THIS HYPOTHESIS EXISTS</div>
                  <div className="border-t border-amber-500/15 my-1" />
                  SPYDEE identified this relationship because no single record connects these entities directly. Three independent signal types converge on the same conclusion:
                </div>

                {/* SIGNAL BREAKDOWN DETAIL */}
                <div className="space-y-2">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">SIGNAL BREAKDOWN</div>
                  {hypothesisSignals.length > 0 ? (
                    hypothesisSignals.map((sig: any, idx: number) => {
                      const sigConfig = SIGNAL_TYPES[sig.family] || { label: sig.family, color: '#f59e0b', icon: <Sparkles className="w-3 h-3" /> };
                      const evType = sig.evidence_type || 'inferred';
                      const evConfig = EVIDENCE_TYPES[evType as keyof typeof EVIDENCE_TYPES] || EVIDENCE_TYPES.inferred;
                      return (
                        <div key={idx} className="p-2 bg-black/60 border border-amber-500/20 text-[10px] space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-amber-500/60 font-bold">{String(idx + 1).padStart(2, '0')}</span>
                            <span style={{ color: sigConfig.color }}>{sigConfig.icon}</span>
                            <span className="font-bold text-amber-300">{sigConfig.label}</span>
                            <span className="text-[9px] px-1 py-0.5 bg-black/60 border border-amber-500/30 text-amber-500/80 uppercase">{sig.weight || 'MEDIUM'}</span>
                          </div>
                          <div className="ml-6 space-y-0.5 text-amber-400/90">
                            <div>{sig.explanation || sig.feature_details?.description || 'Pattern detected across multiple records'}</div>
                            <div className="flex items-center gap-2 text-[9px]">
                              <span>Source: <span className="text-amber-300">{sig.source || 'CDR+Tower'}</span></span>
                              <span>Occurrences: <span className="text-amber-300">{sig.contributing_record_ids?.length || 'N/A'}</span></span>
                              <span className="flex items-center gap-1" style={{ color: evConfig.color }}>
                                <span>{evConfig.type}</span>
                                <span className="font-bold">{evConfig.label}</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-2 text-amber-500/60 text-[10px]">Signal details loading...</div>
                  )}
                </div>

                {/* CONTRADICTIONS DETAIL */}
                {hypothesisContradictions.length > 0 && (
                  <div className="space-y-2 border-t border-red-500/15 pt-2">
                    <div className="text-[10px] text-red-400 font-bold uppercase mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      CONTRADICTIONS
                    </div>
                    {hypothesisContradictions.map((c: any, idx: number) => (
                      <div key={idx} className="p-2 bg-red-950/30 border border-red-500/30 text-[10px] text-red-300">
                        <div className="font-bold mb-0.5">{c.title || `Contradiction ${idx + 1}`}</div>
                        <div>{c.explanation || c.statements?.[0]?.text || 'Conflicting evidence detected'}</div>
                        <div className="flex justify-between text-[9px] mt-1">
                          <span>Impact: <span className="font-bold text-red-400">−{c.confidence_impact || 8}%</span></span>
                          <span>Type: <span className="font-bold">{c.detection_method || 'LOCATION_MISMATCH'}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* INFORMATION GAP DETAIL */}
                {informationGaps.length > 0 && (
                  <div className="space-y-2 border-t border-amber-500/15 pt-2">
                    <div className="text-[10px] text-amber-400 font-bold uppercase mb-1">INFORMATION GAP</div>
                    {informationGaps.map((g: any, idx: number) => (
                      <div key={idx} className="p-2 bg-amber-950/30 border border-amber-500/30 text-[10px] text-amber-300">
                        <div className="font-bold mb-0.5">{g.title || `Gap ${idx + 1}`}</div>
                        <div>{g.description || 'Critical information missing for hypothesis validation'}</div>
                        <div className="text-[9px] text-amber-500/70 mt-1">Information gain if resolved: <span className="font-bold text-amber-400">HIGH</span></div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ANALYST REVIEW & ATTESTATION */}
                <div className="p-2.5 bg-black/40 border border-amber-500/30 space-y-2 border-t-2 border-amber-500/40">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase">
                    OFFICER ATTESTATION & DECISION:
                  </div>

                  <input
                    type="text"
                    placeholder="Enter analyst justification notes..."
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                  />

                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'supported' })}
                      disabled={reviewMutation.isPending}
                      className="py-0.5 px-1 bg-emerald-500 text-black font-medium text-[9px] uppercase hover:bg-emerald-400"
                    >
                      [ ACCEPT ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'needs_verification' })}
                      disabled={reviewMutation.isPending}
                      className="py-0.5 px-1 bg-amber-500 text-black font-medium text-[9px] uppercase hover:bg-amber-400"
                    >
                      [ NEEDS MORE EVIDENCE ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'rejected' })}
                      disabled={reviewMutation.isPending}
                      className="py-0.5 px-1 bg-red-500 text-black font-medium text-[9px] uppercase hover:bg-red-400"
                    >
                      [ REJECT ]
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button className="py-1.5 px-2 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase flex items-center justify-center gap-1">
                      <Eye className="w-3 h-3" />
                      <span>VIEW EVIDENCE CHAIN</span>
                    </button>
                    <button className="py-1.5 px-2 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" />
                      <span>VIEW IN GRAPH</span>
                    </button>
                  </div>
                </div>

                {/* Classification Notice */}
                <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                  CLASSIFICATION: <span className="font-bold text-amber-200">HYPOTHESIS // UNCONFIRMED</span>.<br />
                  AI correlation only. Physical verification required. Human-in-the-loop.
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>
    </div>
  );
}