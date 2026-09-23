import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { Zap, Radio, AlertTriangle, Layers, Play, CheckCircle2 } from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

const FAMILY_META: Record<string, { label: string; weight: string; color: string }> = {
  communication: { label: 'COMMUNICATION', weight: '0.20', color: '#f59e0b' },
  device_sim: { label: 'DEVICE/SIM', weight: '0.20', color: '#fbbf24' },
  spatial_temporal: { label: 'SPATIAL/TEMPORAL', weight: '0.15', color: '#fde68a' },
  writing_style: { label: 'WRITING STYLE', weight: '0.15', color: '#d97706' },
  financial: { label: 'FINANCIAL', weight: '0.10', color: '#34d399' },
  infrastructure: { label: 'INFRASTRUCTURE', weight: '0.10', color: '#fbbf24' },
  network_topology: { label: 'TOPOLOGY', weight: '0.10', color: '#f59e0b' },
};

const FAMILY_ORDER = ['communication', 'device_sim', 'spatial_temporal', 'writing_style', 'financial', 'infrastructure', 'network_topology'];

export default function IntelligenceWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();
  const [activeFamily, setActiveFamily] = useState<string>('all');
  const [running, setRunning] = useState(false);

  const { data: runs } = useQuery({
    queryKey: ['analysis', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!),
    enabled: !!caseId,
  });

  const { data: signals } = useQuery({
    queryKey: ['signals', caseId],
    queryFn: () => api.getSignals(caseId!, activeFamily === 'all' ? undefined : activeFamily),
    enabled: !!caseId,
  });

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!),
    enabled: !!caseId,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runAnalysis(caseId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analysis', caseId] });
      queryClient.invalidateQueries({ queryKey: ['hypotheses', caseId] });
      queryClient.invalidateQueries({ queryKey: ['signals', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setRunning(false);
      showAlert('Deterministic signal analysis completed. Model graph updated.', 'SUCCESS');
    },
    onError: (err: any) => {
      setRunning(false);
      showAlert(err?.message || 'Signal analysis pipeline error', 'CRITICAL');
    },
  });

  const latestRun = runs && runs.length > 0 ? runs[0] : null;
  const counts: Record<string, number> = (signals?.counts_by_family as Record<string, number>) || {};
  const families = FAMILY_ORDER.filter(f => counts[f] !== undefined);
  const hasEngineErrors = Object.keys(counts).length === 0 && latestRun && latestRun.status === 'completed';

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // ANALYSIS PIPELINE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            DETERMINISTIC INTELLIGENCE SIGNAL MATRIX
          </div>
          <div className="text-[10px] text-amber-500/80">
            MULTI-VECTOR HEURISTIC ENGINES // TELECOMMUNICATIONS, SPATIAL PROXIMITY & BEHAVIORAL CO-OCCURRENCES
          </div>
        </div>

        <button
          onClick={() => {
            setRunning(true);
            runMutation.mutate();
          }}
          disabled={running}
          className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs shadow-[0_0_10px_rgba(245,158,11,0.4)] disabled:opacity-50 uppercase"
        >
          <Zap className="w-3.5 h-3.5 fill-black" />
          <span>{running ? '[ EXECUTING ENGINE SUITE... ]' : '⚡ RUN SIGNAL ANALYSIS'}</span>
        </button>
      </div>

      {/* LATEST RUN TELEMETRY */}
      {latestRun && (
        <TerminalPanel
          title="ACTIVE RUN TELEMETRY"
          subtitle={`VERSION v${latestRun.version || '1.0'}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <StatusBadge status={latestRun.status} size="sm" />
              <span className="text-amber-500/80 font-bold">
                HASH: #{latestRun.id.slice(0, 10)}
              </span>
              {latestRun.completed_at && (
                <span className="text-amber-500/60 text-[11px]">
                  COMPLETED: {new Date(latestRun.completed_at).toLocaleString()}
                </span>
              )}
            </div>

            <div className="text-[11px] text-amber-300 flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([f, c]) => (
                <span
                  key={f}
                  className="px-2 py-0.5 bg-black border border-amber-500/30 font-bold"
                >
                  <span className="text-amber-500/70">{FAMILY_META[f]?.label || f}:</span>{' '}
                  <span className="text-amber-300">{c}</span>
                </span>
              ))}
            </div>
          </div>
        </TerminalPanel>
      )}

      {!latestRun && (
        <div className="border border-dashed border-amber-500/30 bg-[#0a0f0a] p-8 text-center text-amber-500/70 text-xs">
          NO ANALYSIS PIPELINE HAS RUN FOR THIS INVESTIGATION. TRIGGER SIGNAL ANALYSIS TO POPULATE THE MATRIX.
        </div>
      )}

      {latestRun && hasEngineErrors && (
        <div className="border border-red-500/50 bg-red-950/20 p-3 text-xs text-red-400">
          ANALYSIS EXECUTED WITH ZERO DERIVED SIGNALS. VERIFY RAW EVIDENCE INGESTION AND INGESTION SCHEMA COMPATIBILITY.
        </div>
      )}

      {/* FAMILY FILTER BUTTONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
        <button
          onClick={() => setActiveFamily('all')}
          className={`p-2.5 text-left border transition-colors ${
            activeFamily === 'all'
              ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-[0_0_8px_#f59e0b]'
              : 'bg-[#0b100b] border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
          }`}
        >
          <div className={`text-[9px] uppercase ${activeFamily === 'all' ? 'text-black/80' : 'text-amber-500/70'}`}>
            ALL DOMAINS
          </div>
          <div className="font-bold text-sm mt-0.5">
            {families.reduce((a, f) => a + (counts[f] || 0), 0)}
          </div>
          <div className={`text-[9px] ${activeFamily === 'all' ? 'text-black/80' : 'text-amber-500/60'}`}>
            SIGNALS
          </div>
        </button>

        {families.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFamily(f)}
            className={`p-2.5 text-left border transition-colors ${
              activeFamily === f
                ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-[0_0_8px_#f59e0b]'
                : 'bg-[#0b100b] border-amber-500/30 text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <div className={`text-[9px] uppercase truncate ${activeFamily === f ? 'text-black/80' : 'text-amber-500/70'}`}>
              {FAMILY_META[f]?.label || f}
            </div>
            <div className="font-bold text-sm mt-0.5">{counts[f]}</div>
            <div className={`text-[9px] ${activeFamily === f ? 'text-black/80' : 'text-amber-500/60'}`}>
              WT: {FAMILY_META[f]?.weight || '0.10'}
            </div>
          </button>
        ))}
      </div>

      {/* RAW SIGNAL FEED */}
      <TerminalPanel
        title={
          activeFamily === 'all'
            ? `RAW DETECTED SIGNALS (${signals?.signals?.length || 0})`
            : `${FAMILY_META[activeFamily]?.label || activeFamily} SIGNAL FEED (${signals?.signals?.length || 0})`
        }
        subtitle="HEURISTIC EVIDENCE CORROBORATIONS"
      >
        {signals && signals.signals.length > 0 ? (
          <div className="space-y-2">
            {signals.signals.slice(0, 30).map((s: any) => (
              <div
                key={s.id}
                className="bg-black/60 border border-amber-500/30 p-2.5 space-y-1.5 hover:border-amber-400 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-amber-500/20">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-amber-300">
                      {[s.entity_pair?.source, s.entity_pair?.target].filter(Boolean).join(' ↔ ') || '(UNPAIRED VECTOR)'}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 bg-black border border-amber-500/40 text-amber-400">
                      {s.contributing_record_count} SOURCES
                    </span>
                    {s.engine_name && (
                      <span className="text-[10px] text-amber-500/60">
                        ENG: {s.engine_name} {s.engine_version || ''}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-500/20 border border-amber-400 text-amber-300">
                      INDEX: {Math.round(s.numeric_value * 100)}/100
                    </span>
                  </div>
                </div>

                <p className="text-xs text-amber-200/90 leading-relaxed">
                  {s.explanation || 'No heuristic annotation.'}
                </p>

                {s.contradiction && (
                  <div className="text-[11px] text-red-400 bg-red-950/30 border border-red-500/40 p-1.5">
                    [ CONTRADICTION DETECTED ] {s.contradiction_reason || 'Incompatible physical or timeline parameters'}
                  </div>
                )}

                {s.feature_details && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {Object.entries(s.feature_details)
                      .filter(([k]) => !['cycle'].includes(k))
                      .slice(0, 8)
                      .map(([k, v]) => (
                        <span
                          key={k}
                          className="text-[10px] bg-black border border-amber-500/20 px-1.5 py-0.5 text-amber-500/70"
                        >
                          <span className="text-amber-400">{k}:</span>{' '}
                          {typeof v === 'string'
                            ? v.length > 28
                              ? v.slice(0, 28) + '…'
                              : v
                            : JSON.stringify(v)}
                        </span>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-amber-500/70 text-xs">
            {activeFamily === 'all'
              ? 'RUN SIGNAL ANALYSIS TO GENERATE INTELLIGENCE FEEDS.'
              : `NO SIGNALS LOGGED FOR ${FAMILY_META[activeFamily]?.label || activeFamily}.`}
          </div>
        )}
      </TerminalPanel>

      {/* FORENSIC PIPELINE VISUALIZER */}
      <TerminalPanel title="INTELLIGENCE FUSION SEQUENCE" subtitle="4-TIER PIPELINE FLOW">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 bg-black/60 border border-amber-500/30">
            <div className="text-[10px] text-amber-500/70 uppercase">STAGE 01</div>
            <div className="font-bold text-amber-300 mt-1">SOURCE RECORDS</div>
            <div className="text-[10px] text-amber-500/60 mt-0.5">CDRs, chats, logs, filings</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-amber-500/30">
            <div className="text-[10px] text-amber-500/70 uppercase">STAGE 02</div>
            <div className="font-bold text-amber-400 mt-1">
              SIGNALS ({signals?.signals?.length || 0})
            </div>
            <div className="text-[10px] text-amber-500/60 mt-0.5">Mathematical vectors</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-amber-500/30">
            <div className="text-[10px] text-amber-500/70 uppercase">STAGE 03</div>
            <div className="font-bold text-amber-200 mt-1">
              HYPOTHESES ({hypotheses?.length || 0})
            </div>
            <div className="text-[10px] text-amber-500/60 mt-0.5">Weighted network assertions</div>
          </div>
          <div className="p-2.5 bg-black/60 border border-amber-500/30">
            <div className="text-[10px] text-amber-500/70 uppercase">STAGE 04</div>
            <div className="font-bold text-emerald-400 mt-1">GAP / ACTIONS</div>
            <div className="text-[10px] text-amber-500/60 mt-0.5">Subpoenas, warrants, field leads</div>
          </div>
        </div>
      </TerminalPanel>
    </div>
  );
}
