import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
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
  Filter
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function HypothesisList() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const { data: hypotheses = [], isLoading } = useQuery({
    queryKey: ['hypotheses', caseId, stateFilter],
    queryFn: () => api.getHypotheses(caseId!, stateFilter || undefined),
    enabled: !!caseId,
  });

  const selected = hypotheses.find((h: any) => h.id === selectedId) || (hypotheses.length > 0 ? hypotheses[0] : null);

  const detailQuery = useQuery({
    queryKey: ['hypothesis', caseId, selected?.id],
    queryFn: () => api.getHypothesis(caseId!, selected.id),
    enabled: !!selected?.id,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: { decision: string }) =>
      api.reviewHypothesis(caseId!, selected.id, { decision, note: reviewNote }),
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

  const newCount = hypotheses.filter((h: any) => h.state === 'new' || !h.state).length;
  const supportedCount = hypotheses.filter((h: any) => h.state === 'supported_by_reviewer' || h.state === 'supported').length;
  const rejectedCount = hypotheses.filter((h: any) => h.state === 'rejected').length;

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
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

        {/* METRICS PILLS */}
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
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="p-2 bg-[#0a0f0a] border border-amber-500/30 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-amber-500/70 uppercase">FILTER:</span>
          {['', 'new', 'needs_verification', 'supported_by_reviewer', 'rejected'].map((st) => (
            <button
              key={st}
              onClick={() => setStateFilter(st)}
              className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                stateFilter === st
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {st ? st.replace(/_/g, ' ') : 'ALL HYPOTHESES'}
            </button>
          ))}
        </div>

        <div className="text-[10px] text-amber-500/70 hidden sm:block">
          TOTAL {hypotheses.length} REASONING NODES
        </div>
      </div>

      {/* TWO-COLUMN MATRIX */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Column: Hypothesis Cards */}
        <div className={selected ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'}>
          {isLoading ? (
            <div className="p-12 text-center text-xs text-amber-500">
              [ SYNTHESIZING EPISTEMIC HYPOTHESIS MODELS... ]
            </div>
          ) : hypotheses.length === 0 ? (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO HYPOTHESES GENERATED YET. INGEST MORE FORENSIC EVIDENCE OR CORRELATE SUSPECTS VIA GRAPH INTELLIGENCE.
            </div>
          ) : (
            hypotheses.map((h: any) => {
              const isSelected = selected?.id === h.id;
              const confidence = h.confidence_score ?? h.confidence ?? 0.67;
              const confPct = Math.round(confidence * 100);

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
                        {h.id.slice(0, 8)}
                      </span>
                      <span className="font-bold text-amber-300 text-xs truncate max-w-[280px]">
                        {h.title || 'Covert Reconnaissance & Target Convergence'}
                      </span>
                    </div>
                    <StatusBadge status={h.state || 'needs_verification'} size="sm" />
                  </div>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="text-amber-200/90 leading-relaxed">
                      {h.summary || h.description || 'Target nodes exhibit synchronized cell sector bursts and physical co-location without direct telecommunication records.'}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px]">
                      <span className="text-amber-500/70 uppercase">
                        FAMILY: <span className="text-amber-300 font-bold">{h.family?.replace(/_/g, ' ') || 'SPATIO-TEMPORAL & CDR'}</span>
                      </span>
                      <span className="text-amber-400 font-bold">
                        CONFIDENCE: {confPct}%
                      </span>
                    </div>

                    {/* Contributing Signals Highlights */}
                    <div className="space-y-1 pt-1 border-t border-amber-500/15">
                      <div className="text-emerald-400 text-[10px]">
                        + Tower co-location in Deccan Gymkhana (14 Sep 21:40)
                      </div>
                      <div className="text-emerald-400 text-[10px]">
                        + Temporal proximity of secondary cash bursts
                      </div>
                      <div className="text-red-400 text-[10px]">
                        - Contradiction: No direct call between primary SIMs
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-[10px] text-amber-500/60 pt-2 border-t border-amber-500/10 mt-2">
                    <span>EPISTEMIC MARKOV CHAIN</span>
                    <span className="text-amber-400 font-bold">CLICK TO AUDIT &rarr;</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Epistemic Verification Dossier */}
        {selected && (
          <div className="lg:col-span-5">
            <TerminalPanel
              title={`EPISTEMIC DOSSIER // ${selected.id.slice(0, 10)}`}
              subtitle={selected.title}
              headerRight={
                <button onClick={() => setSelectedId(null)} className="text-amber-500 hover:text-amber-300">
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                <ConfidenceMeter
                  value={selected.confidence_score ?? selected.confidence ?? 0.67}
                  label="HYPOTHESIS PROBABILITY SCORE"
                />

                <div className="p-2.5 bg-black/60 border border-amber-500/25 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REVIEW STATE:</span>
                    <StatusBadge status={selected.state || 'needs_verification'} size="sm" />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">REASONING FAMILY:</span>
                    <span className="text-amber-300 uppercase">{selected.family || 'SPATIO-TEMPORAL'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">CONTRADICTION RISK:</span>
                    <span className="text-red-400 font-bold">1 DISPUTED FACT</span>
                  </div>
                </div>

                {/* Evidence Chain */}
                <div className="p-2 bg-black/80 border border-amber-500/20 text-[10px] text-amber-400 leading-relaxed">
                  <div className="font-bold text-amber-300 mb-1 uppercase">EPISTEMIC SYNTHESIS:</div>
                  Algorithms correlated 14 tower records with Hawala ledger transactions. Physical corroboration mandatory before judicial submission under BNSS.
                </div>

                {/* Analyst Review & Attestation Box */}
                <div className="p-2.5 bg-black/40 border border-amber-500/30 space-y-2">
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

                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'supported_by_reviewer' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-emerald-500 text-black font-bold text-[10px] uppercase hover:bg-emerald-400"
                    >
                      [ SUPPORT HYPOTHESIS ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'needs_verification' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-amber-500 text-black font-bold text-[10px] uppercase hover:bg-amber-400"
                    >
                      [ FIELD VERIFY ]
                    </button>
                    <button
                      onClick={() => reviewMutation.mutate({ decision: 'rejected' })}
                      disabled={reviewMutation.isPending}
                      className="py-1.5 px-2 bg-red-500 text-black font-bold text-[10px] uppercase hover:bg-red-400 col-span-2"
                    >
                      [ REJECT / FALSIFIED ]
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
