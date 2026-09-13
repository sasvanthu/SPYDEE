import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function IntelligenceWorkbench() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('communication');
  const [running, setRunning] = useState(false);

  const { data: runs } = useQuery({
    queryKey: ['analysis', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!),
    enabled: !!caseId,
  });

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!),
    enabled: !!caseId,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runAnalysis(caseId!),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['analysis', caseId] }); queryClient.invalidateQueries({ queryKey: ['hypotheses', caseId] }); setRunning(false); },
  });

  const tabs = [
    { id: 'communication', label: 'Communication Patterns' },
    { id: 'graph', label: 'Graph Structure' },
    { id: 'scoring', label: 'Weak-Signal Fusion' },
    { id: 'gaps', label: 'Information Gaps' },
  ];

  const commSignals = hypotheses?.filter((h: any) => h.score_breakdown?.family_scores?.communication) || [];
  const graphSignals = hypotheses?.filter((h: any) => h.score_breakdown?.family_scores?.spatial_temporal) || [];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-navy-700">Intelligence Workbench</h1>
        <button onClick={() => { setRunning(true); runMutation.mutate(); }} disabled={running}
          className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
          {running ? 'Running Analysis...' : 'Run Analysis'}
        </button>
      </div>

      {runs && runs.length > 0 && (
        <div className="bg-white border rounded-lg p-4 mb-6">
          <h3 className="font-medium text-navy-700 text-sm mb-2">Analysis Runs</h3>
          <div className="flex gap-4 text-sm">
            {runs.slice(0, 3).map((r: any) => (
              <div key={r.id} className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${r.status === 'completed' ? 'bg-green-500' : r.status === 'running' ? 'bg-amber-500' : 'bg-gray-400'}`}></span>
                <span>v{r.version} — {r.status}</span>
                <span className="text-navy-400">{r.completed_at ? new Date(r.completed_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px ${activeTab === tab.id ? 'border-azure-500 text-azure-600' : 'border-transparent text-navy-400 hover:text-navy-600'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border rounded-lg p-6">
        {activeTab === 'communication' && (
          <div>
            <h3 className="font-semibold text-navy-700 mb-4">Communication Pattern Analysis</h3>
            {commSignals.length > 0 ? (
              <div className="space-y-3">
                {commSignals.slice(0, 10).map((h: any) => (
                  <div key={h.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-navy-700">{h.statement?.substring(0, 100)}...</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${h.strength_index >= 70 ? 'bg-red-100 text-red-700' : h.strength_index >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {h.strength_index}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-navy-400 text-sm">Run analysis to generate communication signals</p>
            )}
          </div>
        )}
        {activeTab === 'graph' && (
          <div>
            <h3 className="font-semibold text-navy-700 mb-4">Graph Structural Analysis</h3>
            <p className="text-navy-400 text-sm">Graph structural signals are computed during analysis runs. Run analysis to see results.</p>
          </div>
        )}
        {activeTab === 'scoring' && (
          <div>
            <h3 className="font-semibold text-navy-700 mb-4">Weak-Signal Fusion</h3>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { family: 'Communication', weight: '0.20', color: 'bg-azure-50 border-azure-200' },
                { family: 'Device/SIM', weight: '0.25', color: 'bg-cyan-50 border-cyan-200' },
                { family: 'Spatial/Temporal', weight: '0.15', color: 'bg-amber-50 border-amber-200' },
                { family: 'Writing Style', weight: '0.15', color: 'bg-purple-50 border-purple-200' },
                { family: 'Financial', weight: '0.15', color: 'bg-green-50 border-green-200' },
                { family: 'Infrastructure', weight: '0.10', color: 'bg-gray-50 border-gray-200' },
              ].map(f => (
                <div key={f.family} className={`${f.family === 'Writing Style' ? 'border-dashed' : ''} border rounded-lg p-3 text-center`}>
                  <div className="text-sm font-medium text-navy-700">{f.family}</div>
                  <div className="text-xs text-navy-400">Weight: {f.weight}</div>
                </div>
              ))}
            </div>
            <p className="text-navy-400 text-sm">All engines are deterministic and inspectable. Each hypothesis shows its full score breakdown.</p>
          </div>
        )}
        {activeTab === 'gaps' && (
          <div>
            <h3 className="font-semibold text-navy-700 mb-4">Information Gaps</h3>
            {(hypotheses?.filter((h: any) => h.missing_information?.length > 0)?.length ?? 0) > 0 ? (
              <div className="space-y-3">
                {hypotheses?.filter((h: any) => h.missing_information?.length > 0).slice(0, 5).map((h: any) => (
                  <div key={h.id} className="border border-dashed rounded-lg p-4">
                    <div className="text-sm font-medium text-navy-700 mb-2">{h.statement?.substring(0, 80)}...</div>
                    <div className="text-xs text-navy-400">
                      <strong>Missing:</strong> {h.missing_information?.join(', ')}
                    </div>
                    {h.proposed_action && (
                      <div className="text-xs text-azure-600 mt-2">Suggested: {h.proposed_action}</div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-navy-400 text-sm">No information gaps identified yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
