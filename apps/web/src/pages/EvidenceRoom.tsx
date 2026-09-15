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
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [detailFile, setDetailFile] = useState<any>(null);
  const [showExtracted, setShowExtracted] = useState(false);

  const { data: files } = useQuery({ queryKey: ['files', caseId], queryFn: () => api.getFiles(caseId!), enabled: !!caseId });
  const { data: imports } = useQuery({ queryKey: ['imports', caseId], queryFn: () => api.getImports(caseId!), enabled: !!caseId });

  const { data: detail } = useQuery({
    queryKey: ['evidence-detail', caseId, detailFile?.id],
    queryFn: () => api.getEvidenceDetail(caseId!, detailFile!.id),
    enabled: !!caseId && !!detailFile?.id,
  });

  const retryMutation = useMutation({
    mutationFn: () => api.retryExtract(caseId!, detailFile!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['evidence-detail', caseId] });
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !caseId) return;
      return api.uploadEvidence(caseId, selectedFile, sourceType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      setSelectedFile(null);
      setUploading(false);
      setUploadError(null);
    },
    onError: (err: any) => {
      setUploading(false);
      setUploadError(err?.response?.data?.detail || err?.message || 'Upload failed');
    },
  });

  const importMutation = useMutation({
    mutationFn: async (fileId: string) => {
      setImportingId(fileId);
      setImportError(null);
      return api.importEvidence(caseId!, fileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['imports', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setImportingId(null);
      setImportError(null);
    },
    onError: (err: any) => {
      setImportingId(null);
      setImportError(err?.response?.data?.detail || err?.message || 'Import failed');
    },
  });

  const handleUpload = () => {
    setUploading(true);
    setUploadError(null);
    uploadMutation.mutate();
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Evidence Room</h1>

      {uploadError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-sm text-red-700 flex items-start gap-2">
          <span className="text-red-500 mt-0.5">⚠</span>
          <div><span className="font-medium">Upload failed:</span> {uploadError}</div>
        </div>
      )}

      {importError && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-sm text-amber-700 flex items-start gap-2">
          <span className="text-amber-500 mt-0.5">⚠</span>
          <div><span className="font-medium">Import failed:</span> {importError}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4">Upload Evidence</h2>
        <div className="flex items-center gap-4">
          <select value={sourceType} onChange={e => setSourceType(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-md text-sm bg-gray-50">
            <option value="csv">CSV (CDR, Messages, Transactions)</option>
            <option value="json">JSON</option>
            <option value="txt">Text Document</option>
            <option value="pdf">PDF Document</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".csv,.json,.txt,.pdf" onChange={e => { setSelectedFile(e.target.files?.[0] || null); setUploadError(null); }}
            className="hidden" />
          <button onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 border border-gray-200 rounded-md text-sm hover:bg-gray-50 bg-gray-50">
            {selectedFile ? selectedFile.name : 'Choose File'}
          </button>
          <button onClick={handleUpload} disabled={!selectedFile || uploading}
            className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">
            {uploading ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">Supported: CSV, JSON, TXT, PDF. Max 50MB. Duplicate detection by SHA-256.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Uploaded Files</h2>
        </div>
        {files && files.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Filename</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Size</th>
              <th className="px-6 py-3 font-medium">SHA-256</th>
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Action</th>
            </tr></thead>
            <tbody>
              {files.map((f: any) => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => setDetailFile(f)}>
                  <td className="px-6 py-3 font-medium text-gray-900">{f.original_filename}</td>
                  <td className="px-6 py-3 text-gray-600">{f.source_type}</td>
                  <td className="px-6 py-3 text-gray-600">{(f.byte_size / 1024).toFixed(1)} KB</td>
                  <td className="px-6 py-3 font-mono text-xs text-gray-400">{f.sha256?.substring(0, 16)}...</td>
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'imported' ? 'bg-green-100 text-green-700' : f.status === 'uploaded' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    {f.status === 'uploaded' && (
                      <button onClick={() => importMutation.mutate(f.id)} disabled={importingId === f.id}
                        className="bg-cyan-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed">
                        {importingId === f.id ? 'Importing...' : 'Import'}
                      </button>
                    )}
                    {f.status === 'imported' && <span className="text-xs text-green-600 font-medium">{f.accepted_count} records</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">No files uploaded yet</div>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-gray-900">Import History</h2>
        </div>
        {imports && imports.length > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-gray-500">
              <th className="px-6 py-3 font-medium">Status</th>
              <th className="px-6 py-3 font-medium">Accepted</th>
              <th className="px-6 py-3 font-medium">Rejected</th>
              <th className="px-6 py-3 font-medium">Created</th>
            </tr></thead>
            <tbody>
              {imports.map((imp: any) => (
                <tr key={imp.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${imp.status === 'completed' ? 'bg-green-100 text-green-700' : imp.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {imp.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-green-600 font-medium">{imp.accepted_count}</td>
                  <td className="px-6 py-3 text-red-500">{imp.rejected_count}</td>
                  <td className="px-6 py-3 text-gray-500">{new Date(imp.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500 text-sm">No imports yet</div>
        )}
      </div>

      {detailFile && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-6" onClick={() => setDetailFile(null)}>
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{detail.original_filename}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  <span className="font-mono">{detail.sha256?.substring(0, 24)}...</span> · {detail.source_type} · {(detail.byte_size / 1024).toFixed(1)} KB
                </p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded ${
                  detail.status === 'failed' ? 'bg-red-100 text-red-700' :
                  detail.status === 'imported' || detail.status === 'ready' ? 'bg-green-100 text-green-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{detail.status}</span>
              </div>
              <button onClick={() => setDetailFile(null)} className="text-sm text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Parsed Records', value: detail.record_count ?? 0 },
                { label: 'Accepted', value: detail.accepted_count ?? 0 },
                { label: 'Rejected', value: detail.rejected_count ?? 0 },
                { label: 'Derived Events', value: detail.derived_links?.event_count ?? 0 },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{s.value}</div>
                  <div className="text-[11px] text-gray-500">{s.label}</div>
                </div>
              ))}
            </div>

            {(detail.extraction_error || detail.status === 'failed') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-700">
                <div className="font-medium mb-1">Extraction issue</div>
                <div className="text-xs">{detail.extraction_error || 'Text extraction failed for this document.'}</div>
                {detail.retry_count > 0 && <div className="text-xs mt-1">Retried {detail.retry_count} time(s)</div>}
                <button onClick={() => retryMutation.mutate()} disabled={retryMutation.isPending}
                  className="mt-2 bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {retryMutation.isPending ? 'Retrying...' : 'Retry Extraction'}
                </button>
              </div>
            )}

            {detail.extracted_text && (
              <div className="mb-4">
                <button onClick={() => setShowExtracted(v => !v)}
                  className="text-xs text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1.5 rounded font-medium hover:bg-cyan-100">
                  {showExtracted ? 'Hide' : 'Show'} Extracted Text ({detail.extracted_text.length.toLocaleString()} chars)
                </button>
                {showExtracted && (
                  <pre className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg text-xs whitespace-pre-wrap max-h-80 overflow-y-auto text-gray-700">
                    {detail.extracted_text}
                  </pre>
                )}
              </div>
            )}

            {detail.import_history?.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 text-sm mb-2">Import History</h3>
                {detail.import_history.map((i: any) => (
                  <div key={i.id} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded mb-1">
                    <span className={`font-medium ${i.status === 'completed' ? 'text-green-600' : i.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>{i.status}</span>
                    <span className="text-gray-500">{i.accepted_count} accepted · {i.rejected_count} rejected</span>
                    <span className="text-gray-400">{i.created_at ? new Date(i.created_at).toLocaleString() : ''}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={() => setDetailFile(null)} className="text-xs text-gray-500 hover:underline">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}