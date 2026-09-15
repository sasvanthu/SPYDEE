import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export default function HypothesisList() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses', caseId, stateFilter],
    queryFn: () => api.getHypotheses(caseId!, stateFilter || undefined),
    enabled: !!caseId,
  });

  const detailQuery = useQuery({
    queryKey: ['hypothesis', caseId, selected?.id],
    queryFn: () => api.getHypothesis(caseId!, selected.id),
    enabled: !!selected,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ decision }: any) => api.reviewHypothesis(caseId!, selected.id, { decision, note: reviewNote }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hypotheses', caseId] }); setSelected(null); setReviewNote(''); },
  });

  const stateColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', needs_verification: 'bg-amber-100 text-amber-700',
    supported_by_reviewer: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600',
  };

  const familyIcons: Record<string, string> = {
    financial: '$', communication: '@', spatial_temporal: '#', network_topology: '%', writing_style: 'T', device_sim: 'D',
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selected) {
        setSelected(null);
        setReviewNote('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const getContradictionCount = (h: any) => {
    return detailQuery.data?.signals?.filter((s: any) => s.contradiction).length || 0;
  };

  const getContradictionWeight = (h: any) => {
    return detailQuery.data?.signals?.filter((s: any) => s.contradiction).reduce((sum: number, s: any) => sum + (s.weight || 0), 0) || 0;
  };

  const getAvgFamily = (h: any) => {
    const families = h.contributing_signal_highlights?.map((_: string, i: number) => {
      const signal = detailQuery.data?.signals?.[i];
      return signal?.family;
    }).filter(Boolean) || [];
    return [...new Set(families)].slice(0, 2);
  };

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Hypotheses & Leads</h1>
        <div className="flex gap-3 mb-4">
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-white">
            <option value="">All states</option>
            <option value="new">New</option>
            <option value="needs_verification">Needs Verification</option>
            <option value="supported_by_reviewer">Supported</option>
            <option value="rejected">Rejected</option>
          </select>
          <span className="text-xs text-gray-500 py-2">
            {hypotheses?.length || 0} hypotheses
          </span>
        </div>
        <div className="space-y-2">
          {hypotheses && hypotheses.length > 0 ? hypotheses.map((h: any) => {
            const isContradicted = h.contributing_signal_highlights?.some((_: string, i: number) => {
              const signal = detailQuery.data?.signals?.[i];
              return signal?.contradiction;
            });
            return (
              <div key={h.id} onClick={() => setSelected(h)}
                className={`bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition ${
                  selected?.id === h.id ? 'border-cyan-500 ring-2 ring-cyan-100' : 'border-gray-200'
                } ${isContradicted ? 'border-l-4 border-l-red-400' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900">
                        {familyIcons[h.engine_version?.split(' ')[0] || ''] || '◆'}{' '}
                        {h.hypothesis_type?.replace(/_/g, ' ')}
                      </p>
                      {isContradicted && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium flex items-center gap-1">
                          ⚠ CONTRADICTION
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">{h.notes}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Signals: {h.contributing_signal_highlights?.length || 0}</span>
                      <span>Quality: {(h.quality_factor * 100).toFixed(0)}%</span>
                      <span>Engine: {h.engine_version?.split(' ')[1] || 'v2.0'}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className={`text-2xl font-bold ${h.numeric_value >= 70 ? 'text-red-500' : h.numeric_value >= 40 ? 'text-amber-500' : 'text-gray-400'}`}>
                      {Math.round(h.numeric_value)}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${stateColors[h.review_state] || 'bg-gray-100'}`}>{h.review_state}</span>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center text-gray-500">No hypotheses yet. Run analysis first.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="w-96 bg-white border border-gray-200 rounded-lg p-5 h-fit sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Hypothesis Detail</h3>
            <button onClick={() => { setSelected(null); setReviewNote(''); }}
              className="text-gray-400 hover:text-gray-600 text-sm px-1" aria-label="Close detail">✕</button>
          </div>
          <div className="mb-4">
            <div className={`text-4xl font-bold text-center mb-2 ${selected.numeric_value >= 70 ? 'text-red-500' : selected.numeric_value >= 40 ? 'text-amber-500' : 'text-gray-400'}`}>
              {Math.round(selected.numeric_value)}<span className="text-lg text-gray-400">/100</span>
            </div>
            <p className="text-xs text-cyan-600 mb-1 text-center">{selected.hypothesis_type?.replace(/_/g, ' ')}</p>
            <p className="text-sm text-gray-700">{selected.notes}</p>
            <div className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
              <span className="font-medium">Methodology:</span> score = weighted mean over applicable evidence families
              <span className="block mt-0.5 text-amber-700">Scores are uncalibrated evidence scores, <em>not</em> probabilities. A hypothesis<em> score ≥ 70 still requires investigator verification</em> before it implies a possible link.</span>
            </div>
            {selected.entity_pair && (
              <div className="text-xs text-gray-500 mt-2 bg-gray-50 rounded p-2">
                <span className="font-medium">Pair:</span> {selected.entity_pair.source?.slice(0, 8)} ↔ {selected.entity_pair.target?.slice(0, 8)}
              </div>
            )}
          </div>

          {detailQuery.data?.signals?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Contributing Signals</h4>
              <div className="space-y-2">
                {detailQuery.data.signals.map((s: any, i: number) => (
                  <div key={i} className={`rounded p-2 text-xs ${
                    s.contradiction ? 'bg-red-50 border border-red-200' : 'bg-gray-50'
                  }`}>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">
                        {s.family}
                        {s.contradiction && <span className="ml-1 text-red-600">⚠ CONTRADICTS</span>}
                      </span>
                      <span className="text-gray-500">{Math.round(s.weight * 100)}%</span>
                    </div>
                    <div className="text-gray-500 mt-1">{s.signal?.explanation || s.signal?.notes || ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {detailQuery.data?.signals?.some((s: any) => s.contradiction) && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <h4 className="font-medium text-sm text-amber-800 mb-1">⚠ Info-Gap Alert</h4>
              <p className="text-xs text-amber-700">
                {detailQuery.data.signals.filter((s: any) => s.contradiction).length} signal(s) contradict this hypothesis.
                The quality score is reduced by contradiction penalty. Consider rejecting or requesting verification.
              </p>
            </div>
          )}

          {selected.contributing_signal_highlights?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Signal Highlights</h4>
              <ul className="text-xs text-gray-600 space-y-1">
                {selected.contributing_signal_highlights.map((m: string, i: number) => <li key={i} className="bg-gray-50 rounded p-1">• {m}</li>)}
              </ul>
            </div>
          )}

          {detailQuery.data?.recommendations?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-gray-700 mb-2">Recommended Actions</h4>
              <div className="space-y-2">
                {detailQuery.data.recommendations.map((r: any, i: number) => (
                  <div key={i} className="p-3 bg-cyan-50 rounded text-xs text-cyan-800 border border-cyan-100">
                    <strong>{r.type?.replace(/_/g, ' ')}</strong>
                    <span className="ml-2 text-gray-500">({r.status})</span>
                    <div className="mt-1">{r.rationale}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-4">
            <h4 className="font-medium text-sm text-gray-700 mb-2">Record Decision</h4>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              placeholder="Reviewer note (required)..." className="w-full px-3 py-2 border border-gray-200 rounded text-sm mb-2 bg-gray-50" rows={2} />
            <div className="flex gap-2">
              {['needs_verification', 'supported_by_reviewer', 'rejected'].map(dec => (
                <button key={dec} onClick={() => reviewMutation.mutate({ decision: dec })}
                  className={`text-xs px-3 py-1.5 rounded font-medium ${
                    dec === 'supported_by_reviewer' ? 'bg-green-600 text-white hover:bg-green-700' :
                    dec === 'rejected' ? 'bg-red-600 text-white hover:bg-red-700' :
                    'bg-amber-500 text-white hover:bg-amber-600'
                  }`}>
                  {dec === 'needs_verification' ? 'Verify' : dec === 'supported_by_reviewer' ? 'Support' : 'Reject'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}