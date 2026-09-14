import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

const FAMILY_META: Record<string, { label: string; weight: string; color: string }> = {
  communication: { label: 'Communication', weight: '0.20', color: 'border-azure-200 bg-azure-50' },
  device_sim: { label: 'Device/SIM', weight: '0.20', color: 'border-cyan-200 bg-cyan-50' },
  spatial_temporal: { label: 'Spatial/Temporal', weight: '0.15', color: 'border-amber-200 bg-amber-50' },
  writing_style: { label: 'Writing Style', weight: '0.15', color: 'border-purple-200 bg-purple-50' },
  financial: { label: 'Financial', weight: '0.10', color: 'border-green-200 bg-green-50' },
  infrastructure: { label: 'Infrastructure', weight: '0.10', color: 'border-gray-200 bg-gray-50' },
  network_topology: { label: 'Network Topology', weight: '0.10', color: 'border-indigo-200 bg-indigo-50 border-dashed' },
};

const FAMILY_ORDER = ['communication', 'device_sim', 'spatial_temporal', 'writing_style', 'financial', 'infrastructure', 'network_topology'];

function scoreColor(v: number) {
  if (v >= 0.7) return 'bg-red-100 text-red-700';
  if (v >= 0.4) return 'bg-amber-100 text-amber-700';
  return 'bg-gray-100 text-gray-500';
}

export default function IntelligenceWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
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
      setRunning(false);
    },
  });

  const latestRun = runs && runs.length > 0 ? runs[0] : null;
  const counts = signals?.counts_by_family || {};
  const families = FAMILY_ORDER.filter(f => counts[f] !== undefined);
  const hasEngineErrors = Object.keys(counts).length === 0 && latestRun && latestRun.status === 'completed';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-700">Intelligence Workbench</h1>
        <button onClick={() => { setRunning(true); runMutation.mutate(); }} disabled={running}
          className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
          {running ? 'Running Analysis...' : 'Run Analysis'}
        </button>
      </div>

      {latestRun && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h3 className="font-medium text-navy-700 text-sm mb-2">Latest Analysis Run</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${latestRun.status === 'completed' ? 'bg-green-500' : latestRun.status === 'running' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
              <span>v{latestRun.version} — {latestRun.status}</span>
            </span>
            {latestRun.completed_at && <span className="text-navy-400">{new Date(latestRun.completed_at).toLocaleString()}</span>}
            <span className="text-navy-400">
              {Object.entries(counts).map(([f, c]) => `${(FAMILY_META[f]?.label || f)}: ${c}`).join(' · ')}
            </span>
          </div>
        </div>
      )}

      {!latestRun && (
        <div className="bg-white border border-dashed rounded-lg p-8 text-center text-navy-400 text-sm mb-6">
          No analysis has been run for this case yet. Run the analysis pipeline to generate intelligence signals.
        </div>
      )}

      {latestRun && hasEngineErrors && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700">
          The analysis completed but produced no signals. This usually means one of the analysis engines failed
          or the case data does not match any engine signature. Check the server log for details.
        </div>
      )}

      <div className="grid grid-cols-7 gap-3 mb-6">
        <button
          onClick={() => setActiveFamily('all')}
          className={`border rounded-lg p-3 text-center transition-colors ${activeFamily === 'all' ? 'border-azure-500 bg-azure-50 shadow-sm' : 'border-gray-200 bg-white hover:border-azure-300'}`}>
          <div className="text-sm font-medium text-navy-700">All Families</div>
          <div className="text-xs text-navy-400">{families.reduce((a, f) => a + (counts[f] || 0), 0)} signals</div>
        </button>
        {families.map(f => (
          <button
            key={f}
            onClick={() => setActiveFamily(f)}
            className={`border rounded-lg p-3 text-center transition-colors ${activeFamily === f ? 'border-azure-500 bg-azure-50 shadow-sm' : 'border-gray-200 bg-white hover:border-azure-300'}`}>
            <div className="text-sm font-medium text-navy-700">{FAMILY_META[f]?.label || f}</div>
            <div className="text-xs text-navy-400">{counts[f]} signals</div>
            {FAMILY_META[f] && <div className="text-[10px] text-navy-300 mt-0.5">weight {FAMILY_META[f].weight}</div>}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-6">
        {activeFamily !== 'all' && FAMILY_META[activeFamily] && (
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-navy-700">{FAMILY_META[activeFamily].label} Pattern Analysis</h3>
            <span className="text-xs text-navy-400">
              Fusion weight {FAMILY_META[activeFamily].weight} · prototype score
            </span>
          </div>
        )}

        {signals && signals.signals.length > 0 ? (
          <div className="space-y-3">
            {signals.signals.slice(0, 20).map((s: any) => (
              <div key={s.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-navy-700">
                      {[s.entity_pair?.source, s.entity_pair?.target].filter(Boolean).join(' ↔ ') || '(no entity pair)'}
                    </span>
                    <span className="text-[10px] text-navy-300 uppercase tracking-wide">sources: {s.contributing_record_count}</span>
                    {s.engine_version && <span className="text-[10px] text-navy-300">engine {s.engine_name} {s.engine_version}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${scoreColor(s.numeric_value)}`}>
                    {Math.round(s.numeric_value * 100)}/100
                  </span>
                </div>
                <p className="text-sm text-navy-500">{s.explanation || 'No description'}</p>
                {s.contradiction && (
                  <p className="text-xs text-amber-600 mt-1">Contradiction: {s.contradiction_reason || 'conflicting evidence'}</p>
                )}
                {s.feature_details && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(s.feature_details).filter(([k]) => !['cycle'].includes(k)).slice(0, 6).map(([k, v]) => (
                      <span key={k} className="text-[10px] bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-navy-500">
                        {k}={typeof v === 'string' ? (v.length > 24 ? v.slice(0, 24) + '…' : v) : JSON.stringify(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-navy-400 text-sm">
            {activeFamily === 'all'
              ? 'Run analysis to generate intelligence signals'
              : `No signals in the ${FAMILY_META[activeFamily]?.label || activeFamily} family for this case`}
          </p>
        )}
      </div>

      {activeFamily === 'all' && (
        <div className="bg-white border rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-navy-700 mb-3">Evidence → Signal → Hypothesis Pipeline</h3>
          <div className="flex items-center gap-2 text-sm text-navy-500">
            <span className="px-3 py-1.5 bg-azure-50 border border-azure-200 rounded-md">Source Records</span>
            <span>→</span>
            <span className="px-3 py-1.5 bg-cyan-50 border border-cyan-200 rounded-md">Signals ({signals?.signals.length || 0})</span>
            <span>→</span>
            <span className="px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-md">Fused Hypotheses ({hypotheses?.length || 0})</span>
            <span>→</span>
            <span className="px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-md">Gap/Countermeasure Actions</span>
          </div>
        </div>
      )}

      {activeFamily === 'all' && (
        <div className="bg-white border rounded-lg p-6 mt-6">
          <h3 className="font-semibold text-navy-700 mb-3">Analysis Disclaimer</h3>
          <p className="text-xs text-navy-400 leading-relaxed">
            Scores are prototype evidence scores derived from deterministic signal fusion, not calibrated
            probabilities. Every number shown is traceable to specific source records listed under
            each signal. Review signal provenance in the Evidence Room before acting.
          </p>
        </div>
      )}
    </div>
  );
}