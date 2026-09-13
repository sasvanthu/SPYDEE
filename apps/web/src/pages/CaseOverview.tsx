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

  if (isLoading) return <div className="text-center py-12 text-navy-400">Loading...</div>;
  if (!caseData) return <div className="text-center py-12 text-navy-400">Case not found</div>;

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-700',
    under_review: 'bg-amber-100 text-amber-700',
    archived: 'bg-red-100 text-red-600',
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold text-navy-700">{caseData.title}</h1>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[caseData.status]}`}>{caseData.status}</span>
        {caseData.is_synthetic && (
          <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded font-medium">SYNTHETIC DEMO</span>
        )}
      </div>
      <p className="text-navy-400 text-sm mb-6">{caseData.case_code} — {caseData.description || 'No description'}</p>

      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Entities', value: caseData.entity_count || 0, color: 'bg-azure-50 border-azure-200' },
          { label: 'Evidence Files', value: caseData.evidence_count || 0, color: 'bg-green-50 border-green-200' },
          { label: 'Events', value: caseData.event_count || 0, color: 'bg-amber-50 border-amber-200' },
          { label: 'Hypotheses', value: caseData.hypothesis_count || 0, color: 'bg-red-50 border-red-200' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.color} border rounded-lg p-4 text-center`}>
            <div className="text-2xl font-bold text-navy-700">{stat.value}</div>
            <div className="text-sm text-navy-400">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <h2 className="font-semibold text-navy-700 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            <button onClick={() => navigate(`/cases/${caseId}/evidence`)}
              className="w-full text-left bg-white border rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-blue-100 p-2 rounded">📁</span>
              <div><div className="font-medium text-navy-700">Import Evidence</div><div className="text-xs text-navy-400">Upload CSV, JSON, TXT or PDF files</div></div>
            </button>
            <button onClick={() => navigate(`/cases/${caseId}/graph`)}
              className="w-full text-left bg-white border rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-cyan-100 p-2 rounded">🔗</span>
              <div><div className="font-medium text-navy-700">Open Graph</div><div className="text-xs text-navy-400">Explore entity relationships</div></div>
            </button>
            <button onClick={() => navigate(`/cases/${caseId}/hypotheses`)}
              className="w-full text-left bg-white border rounded-lg p-4 hover:shadow-md transition flex items-center gap-3">
              <span className="bg-amber-100 p-2 rounded">🔍</span>
              <div><div className="font-medium text-navy-700">Review Leads</div><div className="text-xs text-navy-400">Inspect hypotheses and evidence</div></div>
            </button>
          </div>
        </div>
        <div>
          <h2 className="font-semibold text-navy-700 mb-3">Evidence Inventory</h2>
          {files && files.length > 0 ? (
            <div className="space-y-2">
              {files.slice(0, 5).map((f: any) => (
                <div key={f.id} className="bg-white border rounded-lg p-3 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-navy-700">{f.original_filename}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'imported' ? 'bg-green-100 text-green-700' : 'bg-gray-100'}`}>{f.status}</span>
                  </div>
                  <div className="text-xs text-navy-400 mt-1">{f.source_type} — {f.accepted_count} accepted, {f.rejected_count} rejected</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border rounded-lg p-6 text-center text-navy-400 text-sm">No evidence imported yet</div>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-navy-700 mb-3">Recent Jobs</h2>
        {jobs && jobs.length > 0 ? (
          <div className="space-y-2">
            {jobs.slice(0, 5).map((j: any) => (
              <div key={j.id} className="bg-white border rounded-lg p-3 text-sm flex justify-between">
                <span>{j.job_type} — {j.status}</span>
                <span className="text-navy-400">{j.created_at ? new Date(j.created_at).toLocaleString() : ''}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white border rounded-lg p-4 text-center text-navy-400 text-sm">No jobs yet</div>
        )}
      </div>
    </div>
  );
}
