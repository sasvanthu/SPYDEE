import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export default function CaseOverview() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const { data: caseData, isLoading } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  const { data: files } = useQuery({
    queryKey: ['files', caseId],
    queryFn: () => api.getFiles(caseId!),
    enabled: !!caseId,
  });

  const { data: jobs } = useQuery({
    queryKey: ['jobs', caseId],
    queryFn: () => api.getJobs(caseId!),
    enabled: !!caseId,
  });

  const { data: runs } = useQuery({
    queryKey: ['analysis-runs', caseId],
    queryFn: () => api.getAnalysisRuns(caseId!),
    enabled: !!caseId,
  });

  if (isLoading) return <div className="text-center py-12 text-gray-400">Loading...</div>;
  if (!caseData) return <div className="text-center py-12 text-gray-400">Case not found</div>;

  const latestRun = runs?.[runs.length - 1];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{caseData.title}</h1>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${
          caseData.status === 'active' ? 'bg-green-100 text-green-700' :
          caseData.status === 'under_review' ? 'bg-amber-100 text-amber-700' :
          caseData.status === 'archived' ? 'bg-gray-100 text-gray-600' :
          'bg-gray-100 text-gray-500'
        }`}>{caseData.status?.replace('_', ' ')}</span>
        {caseData.is_synthetic && (
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-medium">SYNTHETIC</span>
        )}
      </div>
      <p className="text-gray-500 text-sm mb-6">{caseData.case_code} — {caseData.description || 'No description'}</p>

      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Entities', value: caseData.entity_count || 0, color: 'bg-cyan-50 border-cyan-200 text-cyan-800' },
          { label: 'Relations', value: caseData.relationship_count || 0, color: 'bg-blue-50 border-blue-200 text-blue-800' },
          { label: 'Events', value: caseData.event_count || 0, color: 'bg-amber-50 border-amber-200 text-amber-800' },
          { label: 'Signals', value: latestRun?.signal_count ?? caseData.signal_count ?? 0, color: 'bg-violet-50 border-violet-200 text-violet-800' },
          { label: 'Hypotheses', value: caseData.hypothesis_count || 0, color: 'bg-red-50 border-red-200 text-red-800' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} border rounded-lg p-4 text-center`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-xs opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {latestRun && (
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900">Latest Analysis Run</h3>
              <p className="text-xs text-gray-500 mt-1">
                Run {latestRun.id?.slice(0, 8)} · v{latestRun.version} · {latestRun.created_at ? new Date(latestRun.created_at).toLocaleString() : ''}
              </p>
            </div>
            <div className="flex gap-3 text-xs text-gray-600">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{latestRun.hypothesis_count || 0} hypotheses</span>
              <span className="bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{latestRun.signal_count || 0} signals</span>
              {latestRun.engine_error_count > 0 && (
                <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded">{latestRun.engine_error_count} engine errors</span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <button onClick={() => navigate(`/cases/${caseId}/evidence`)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-cyan-100 p-2 rounded text-cyan-700 font-bold text-sm">▣</span>
              <div><div className="font-medium text-gray-900">Import Evidence</div><div className="text-xs text-gray-500">Upload CSV, JSON, TXT or PDF files</div></div>
            </button>
            <button onClick={() => navigate(`/cases/${caseId}/graph`)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-blue-100 p-2 rounded text-blue-700 font-bold text-sm">◈</span>
              <div><div className="font-medium text-gray-900">Open Graph</div><div className="text-xs text-gray-500">Explore entity relationships</div></div>
            </button>
            <button onClick={() => navigate(`/cases/${caseId}/hypotheses`)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-amber-100 p-2 rounded text-amber-700 font-bold text-sm">◇</span>
              <div><div className="font-medium text-gray-900">Review Leads</div><div className="text-xs text-gray-500">Inspect hypotheses and evidence</div></div>
            </button>
            <button onClick={() => navigate(`/cases/${caseId}/workbench`)}
              className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-violet-100 p-2 rounded text-violet-700 font-bold text-sm">◆</span>
              <div><div className="font-medium text-gray-900">Intelligence Workbench</div><div className="text-xs text-gray-500">View signals and pipeline output</div></div>
            </button>
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">Evidence Inventory</h2>
          {files && files.length > 0 ? (
            <div className="space-y-2">
              {files.slice(0, 5).map((f: any) => (
                <div key={f.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-900">{f.original_filename}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'imported' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{f.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{f.source_type} — {f.accepted_count} accepted, {f.rejected_count} rejected</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-gray-500 text-sm">No evidence imported yet</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-gray-900 mb-3">Recent Jobs</h2>
        {jobs && jobs.length > 0 ? (
          <div className="space-y-2">
            {jobs.slice(0, 5).map((j: any) => (
              <div key={j.id} className="bg-white border border-gray-200 rounded-lg p-3 text-sm flex justify-between">
                <span className="text-gray-700">{j.job_type} — <span className={`font-medium ${j.status === 'completed' ? 'text-green-600' : j.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{j.status}</span></span>
                <span className="text-gray-400">{j.created_at ? new Date(j.created_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">No jobs yet</div>
        )}
      </div>
    </div>
  );
}