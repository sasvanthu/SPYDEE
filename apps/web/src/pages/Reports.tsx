import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function Reports() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [generating, setGenerating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const { data: reports } = useQuery({
    queryKey: ['reports', caseId],
    queryFn: () => api.getReports(caseId!),
    enabled: !!caseId,
  });

  const { data: hypotheses } = useQuery({
    queryKey: ['hypotheses', caseId],
    queryFn: () => api.getHypotheses(caseId!),
    enabled: !!caseId,
  });

  const generateMutation = useMutation({
    mutationFn: () => api.createReport(caseId!, { title: title || `Report - ${new Date().toLocaleDateString()}`, include_unresolved: true }),
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['reports', caseId] }); setSelectedReport(data); setGenerating(false); },
  });

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-navy-700 mb-6">Reports & Audit</h1>

        <div className="bg-white border rounded-lg p-6 mb-6">
          <h2 className="font-semibold text-navy-700 mb-4">Generate Report</h2>
          <div className="flex items-center gap-4">
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Report title..." className="flex-1 px-3 py-2 border rounded-md text-sm" />
            <button onClick={() => { setGenerating(true); generateMutation.mutate(); }} disabled={generating}
              className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-lg overflow-hidden mb-6">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-navy-700">Generated Reports</h2>
          </div>
          {reports && reports.length > 0 ? (
            <div className="divide-y">
              {reports.map((r: any) => (
                <div key={r.id} onClick={() => setSelectedReport(r)}
                  className={`px-6 py-4 cursor-pointer hover:bg-gray-50 ${selectedReport?.id === r.id ? 'bg-azure-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-navy-700 text-sm">{r.title}</div>
                      <div className="text-xs text-navy-400 mt-1">{new Date(r.created_at).toLocaleString()}</div>
                    </div>
                    <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{r.format}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-navy-400 text-sm">No reports generated yet</div>
          )}
        </div>

        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-6 py-3 border-b bg-gray-50">
            <h2 className="font-semibold text-navy-700">Audit Log</h2>
          </div>
          <div className="p-6 text-sm text-navy-400">
            <AuditLog caseId={caseId!} />
          </div>
        </div>
      </div>

      {selectedReport && (
        <div className="w-96 bg-white border rounded-lg p-5 h-fit sticky top-16 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <h3 className="font-semibold text-navy-700 mb-3">Report Preview</h3>
          <div className="text-xs space-y-3">
            <div><span className="text-navy-400">Title:</span> {selectedReport.title}</div>
            <div><span className="text-navy-400">Generated:</span> {new Date(selectedReport.created_at).toLocaleString()}</div>
            {selectedReport.content?.summary && (
              <div className="bg-gray-50 p-3 rounded">
                <div>Entities: {selectedReport.content.summary.total_entities}</div>
                <div>Relationships: {selectedReport.content.summary.total_relationships}</div>
                <div>Hypotheses: {selectedReport.content.summary.total_hypotheses}</div>
              </div>
            )}
            {selectedReport.content?.hypotheses?.length > 0 && (
              <div>
                <strong>Hypotheses:</strong>
                {selectedReport.content.hypotheses.map((h: any, i: number) => (
                  <div key={i} className="bg-gray-50 p-2 rounded mt-1">
                    <div className="flex justify-between">
                      <span>Strength: {h.strength_index}/100</span>
                      <span>{h.review_state}</span>
                    </div>
                    <div className="text-navy-400 mt-1">{h.statement?.substring(0, 100)}...</div>
                  </div>
                ))}
              </div>
            )}
            {selectedReport.content?.limitations && (
              <div>
                <strong>Limitations:</strong>
                <ul className="text-navy-400 mt-1 space-y-1">
                  {selectedReport.content.limitations.map((l: string, i: number) => <li key={i}>• {l}</li>)}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AuditLog({ caseId }: { caseId: string }) {
  const { data: events } = useQuery({
    queryKey: ['audit', caseId],
    queryFn: () => api.getAuditLog(caseId),
    enabled: !!caseId,
  });

  if (!events || events.length === 0) return <div>No audit events yet</div>;

  return (
    <div className="space-y-2">
      {events.slice(0, 20).map((e: any) => (
        <div key={e.id} className="flex items-center justify-between py-2 border-b last:border-0">
          <div>
            <span className="font-medium">{e.action}</span>
            {e.resource_type && <span className="text-navy-400 ml-2">({e.resource_type})</span>}
          </div>
          <span className="text-navy-400">{new Date(e.created_at).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}
