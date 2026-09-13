import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-navy-700 mb-6">Hypotheses & Leads</h1>
        <div className="flex gap-3 mb-4">
          <select value={stateFilter} onChange={e => setStateFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm">
            <option value="">All states</option>
            <option value="new">New</option>
            <option value="needs_verification">Needs Verification</option>
            <option value="supported_by_reviewer">Supported</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="space-y-3">
          {hypotheses && hypotheses.length > 0 ? hypotheses.map((h: any) => (
            <div key={h.id} onClick={() => setSelected(h)}
              className={`bg-white border rounded-lg p-4 cursor-pointer hover:shadow-md transition ${selected?.id === h.id ? 'border-azure-500 ring-2 ring-azure-200' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-navy-700 mb-2">{h.statement}</p>
                  <div className="flex items-center gap-4 text-xs text-navy-400">
                    <span>Supporting: {h.supporting_records?.length || 0}</span>
                    <span>Contradicting: {h.contradicting_records?.length || 0}</span>
                    <span>Families: {h.data_coverage?.families_present?.length || 0}</span>
                  </div>
                </div>
                <div className="text-right ml-4">
                  <div className={`text-2xl font-bold ${h.strength_index >= 70 ? 'text-red-500' : h.strength_index >= 40 ? 'text-amber-500' : 'text-gray-400'}`}>
                    {h.strength_index}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${stateColors[h.review_state] || 'bg-gray-100'}`}>{h.review_state}</span>
                </div>
              </div>
            </div>
          )) : (
            <div className="bg-white border rounded-lg p-8 text-center text-navy-400">No hypotheses yet. Run analysis first.</div>
          )}
        </div>
      </div>

      {selected && (
        <div className="w-96 bg-white border rounded-lg p-5 h-fit sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <h3 className="font-semibold text-navy-700 mb-3">Hypothesis Detail</h3>
          <div className="mb-4">
            <div className={`text-4xl font-bold text-center mb-2 ${selected.strength_index >= 70 ? 'text-red-500' : selected.strength_index >= 40 ? 'text-amber-500' : 'text-gray-400'}`}>
              {selected.strength_index}<span className="text-lg">/100</span>
            </div>
            <p className="text-sm text-navy-700">{selected.statement}</p>
          </div>

          {detailQuery.data?.signals?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-navy-600 mb-2">Contributing Signals</h4>
              <div className="space-y-2">
                {detailQuery.data.signals.map((s: any, i: number) => (
                  <div key={i} className="bg-gray-50 rounded p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium">{s.signal.family}</span>
                      <span>{(s.signal.numeric_value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="text-navy-400 mt-1">{s.signal.explanation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selected.missing_information?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-sm text-navy-600 mb-2">Missing Information</h4>
              <ul className="text-xs text-navy-400 space-y-1">
                {selected.missing_information.map((m: string, i: number) => <li key={i}>• {m}</li>)}
              </ul>
            </div>
          )}

          {selected.proposed_action && (
            <div className="mb-4 p-3 bg-azure-50 rounded text-xs text-azure-700">
              <strong>Suggested Action:</strong> {selected.proposed_action}
            </div>
          )}

          <div className="border-t pt-4">
            <h4 className="font-medium text-sm text-navy-600 mb-2">Record Decision</h4>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              placeholder="Reviewer note (required)..." className="w-full px-3 py-2 border rounded text-sm mb-2" rows={2} />
            <div className="flex gap-2">
              {['needs_verification', 'supported_by_reviewer', 'rejected'].map(dec => (
                <button key={dec} onClick={() => reviewMutation.mutate({ decision: dec })}
                  className={`text-xs px-3 py-1.5 rounded font-medium ${dec === 'supported_by_reviewer' ? 'bg-green-500 text-white' : dec === 'rejected' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'}`}>
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
