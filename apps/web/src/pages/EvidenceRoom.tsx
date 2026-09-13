import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { api } from '../lib/api';

export default function EvidenceRoom() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sourceType, setSourceType] = useState('csv');
  const [importingId, setImportingId] = useState<string | null>(null);

  const { data: files } = useQuery({ queryKey: ['files', caseId], queryFn: () => api.getFiles(caseId!), enabled: !!caseId });
  const { data: imports } = useQuery({ queryKey: ['imports', caseId], queryFn: () => api.getImports(caseId!), enabled: !!caseId });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !caseId) return;
      return api.uploadEvidence(caseId, selectedFile, sourceType);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['files', caseId] }); setSelectedFile(null); setUploading(false); },
  });

  const importMutation = useMutation({
    mutationFn: async (fileId: string) => { setImportingId(fileId); return api.importEvidence(caseId!, fileId); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['imports', caseId] }); queryClient.invalidateQueries({ queryKey: ['case', caseId] }); setImportingId(null); },
  });

  const handleUpload = () => { setUploading(true); uploadMutation.mutate(); };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-navy-700 mb-6">Evidence Room</h1>

      <div className="bg-white border rounded-lg p-6 mb-6">
        <h2 className="font-semibold text-navy-700 mb-4">Upload Evidence</h2>
        <div className="flex items-center gap-4">
          <select value={sourceType} onChange={e => setSourceType(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm">
            <option value="csv">CSV (CDR, Messages, Transactions)</option>
            <option value="json">JSON</option>
            <option value="txt">Text Document</option>
            <option value="pdf">PDF Document</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".csv,.json,.txt,.pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)}
            className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border rounded-md text-sm hover:bg-gray-50">
            {selectedFile ? selectedFile.name : 'Choose File'}
          </button>
          <button onClick={handleUpload} disabled={!selectedFile || uploading}
            className="bg-azure-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <p className="text-xs text-navy-400 mt-2">Supported: CSV, JSON, TXT, PDF. Max 50MB. Duplicate detection by SHA-256.</p>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-navy-700">Uploaded Files</h2>
        </div>
        {files && files.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-navy-400">
              <th className="px-6 py-3 font-medium">Filename</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Size</th>
              <th className="px-6 py-3 font-medium">SHA-256</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {files.map((f: any) => (
                <tr key={f.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3 font-medium text-navy-700">{f.original_filename}</td>
                  <td className="px-6 py-3">{f.source_type}</td>
                  <td className="px-6 py-3">{(f.byte_size / 1024).toFixed(1)} KB</td>
                  <td className="px-6 py-3 font-mono text-xs">{f.sha256?.substring(0, 16)}...</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'imported' ? 'bg-green-100 text-green-700' : f.status === 'uploaded' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {f.status === 'uploaded' && (
                      <button onClick={() => importMutation.mutate(f.id)} disabled={importingId === f.id}
                        className="bg-azure-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-azure-600 disabled:opacity-50">
                        {importingId === f.id ? 'Importing...' : 'Import'}
                      </button>
                    )}
                    {f.status === 'imported' && <span className="text-xs text-green-600">{f.accepted_count} records</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-navy-400 text-sm">No files uploaded yet</div>
        )}
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-navy-700">Import History</h2>
        </div>
        {imports && imports.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-navy-400">
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Accepted</th>
              <th className="px-6 py-3 font-medium">Rejected</th>
              <th className="px-6 py-3 font-medium">Created</th>
            </tr></thead>
            <tbody>
              {imports.map((imp: any) => (
                <tr key={imp.id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${imp.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {imp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-green-600 font-medium">{imp.accepted_count}</td>
                  <td className="px-6 py-3 text-red-500">{imp.rejected_count}</td>
                  <td className="px-6 py-3 text-navy-400">{new Date(imp.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-navy-400 text-sm">No imports yet</div>
        )}
      </div>
    </div>
  );
}
