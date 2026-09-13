import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function EntityRegistry() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [reviewNote, setReviewNote] = useState('');

  const { data: entities } = useQuery({
    queryKey: ['entities', caseId, typeFilter, search],
    queryFn: () => api.getEntities(caseId!, typeFilter || undefined, search || undefined),
    enabled: !!caseId,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ entityId, decision }: any) => api.reviewEntity(caseId!, entityId, { decision, note: reviewNote }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['entities', caseId] }); setSelectedEntity(null); setReviewNote(''); },
  });

  const typeLabels: Record<string, string> = {
    person: 'Person', alias: 'Alias', phone_sim: 'Phone/SIM', device: 'Device',
    account: 'Account', location: 'Location', organization: 'Organization',
    domain_ip: 'Domain/IP', event: 'Event', document: 'Document',
  };

  const stateColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700', needs_verification: 'bg-amber-100 text-amber-700',
    supported_by_reviewer: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-600',
    archived: 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="max-w-6xl mx-auto flex gap-6">
      <div className="flex-1">
        <h1 className="text-2xl font-bold text-navy-700 mb-6">Entity Registry</h1>
        <div className="flex gap-3 mb-4">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm">
            <option value="">All types</option>
            {Object.entries(typeLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entities..."
            className="px-3 py-2 border rounded-md text-sm flex-1" />
        </div>
        <div className="bg-white border rounded-lg overflow-hidden">
          {entities && entities.length > 0 ? (
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-navy-400">
                <th className="px-4 py-3 font-medium">Label</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Identifiers</th>
                <th className="px-4 py-3 font-medium">State</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr></thead>
              <tbody>
                {entities.map((e: any) => (
                  <tr key={e.id} className={`border-b hover:bg-gray-50 cursor-pointer ${selectedEntity?.id === e.id ? 'bg-azure-50' : ''}`}
                    onClick={() => setSelectedEntity(e)}>
                    <td className="px-4 py-3 font-medium text-navy-700">{e.label}</td>
                    <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded bg-navy-100 text-navy-600">{typeLabels[e.entity_type] || e.entity_type}</span></td>
                    <td className="px-4 py-3 text-navy-400">{e.identifiers?.length || 0}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded ${stateColors[e.review_state] || 'bg-gray-100'}`}>{e.review_state}</span></td>
                    <td className="px-4 py-3"><button className="text-azure-500 text-xs hover:underline">View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-navy-400 text-sm">No entities found</div>
          )}
        </div>
      </div>

      {selectedEntity && (
        <div className="w-96 bg-white border rounded-lg p-5 h-fit sticky top-16">
          <h3 className="font-semibold text-navy-700 mb-3">{selectedEntity.label}</h3>
          <div className="space-y-2 text-sm mb-4">
            <div><span className="text-navy-400">Type:</span> {typeLabels[selectedEntity.entity_type]}</div>
            <div><span className="text-navy-400">State:</span> <span className={`text-xs px-2 py-0.5 rounded ${stateColors[selectedEntity.review_state]}`}>{selectedEntity.review_state}</span></div>
          </div>
          {selectedEntity.identifiers?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium text-navy-600 text-sm mb-2">Identifiers</h4>
              <div className="space-y-1">
                {selectedEntity.identifiers.map((id: any) => (
                  <div key={id.id} className="text-xs bg-gray-50 p-2 rounded">
                    <span className="font-medium">{id.id_type}:</span> {id.id_value}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="border-t pt-3 mt-3">
            <h4 className="font-medium text-navy-600 text-sm mb-2">Record Review</h4>
            <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)}
              placeholder="Reviewer note..." className="w-full px-3 py-2 border rounded text-sm mb-2" rows={2} />
            <div className="flex gap-2">
              {['needs_verification', 'supported_by_reviewer', 'rejected'].map(dec => (
                <button key={dec} onClick={() => reviewMutation.mutate({ entityId: selectedEntity.id, decision: dec })}
                  className={`text-xs px-3 py-1.5 rounded font-medium ${dec === 'supported_by_reviewer' ? 'bg-green-500 text-white hover:bg-green-600' : dec === 'rejected' ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
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
