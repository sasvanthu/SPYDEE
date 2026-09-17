import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2, Link2 } from 'lucide-react';
import { api } from '../../lib/api';

interface ColumnMapperModalProps {
  caseId: string;
  fileId: string;
  fileName: string;
  sourceType: string;
  onClose: () => void;
  onImport: (fileId: string, fieldMapping: Record<string, string>) => void;
}

export function ColumnMapperModal({ caseId, fileId, fileName, sourceType, onClose, onImport }: ColumnMapperModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchPreview = async () => {
      try {
        const res = await api.previewEvidence(caseId, fileId);
        const records = res.records || [];
        setPreviewData(records);
        if (records.length > 0) {
          setHeaders(Object.keys(records[0]));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    };
    fetchPreview();
  }, [caseId, fileId]);

  const targetFields = sourceType === 'TOWER_MASTER' 
    ? ['cell_id', 'lat', 'lon', 'azimuth', 'carrier']
    : ['caller_id', 'callee_id', 'start_time', 'duration', 'tower_id', 'imei', 'imsi'];

  const handleMap = (targetField: string, rawHeader: string) => {
    setMapping(prev => ({ ...prev, [rawHeader]: targetField }));
  };

  const handleSubmit = () => {
    onImport(fileId, mapping);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#0f1115] border border-white/10 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Map Columns</h2>
            <p className="text-sm text-white/50 mt-1">Select which raw columns correspond to SPYDEE entity attributes.</p>
          </div>
          <button onClick={onClose} className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/50">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-emerald-500" />
              <p>Extracting file headers...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-white/40 bg-white/5 uppercase">
                    <tr>
                      <th className="px-4 py-3 border-b border-white/10 w-1/3">Target SPYDEE Field</th>
                      <th className="px-4 py-3 border-b border-white/10 w-1/3">Raw Column</th>
                      <th className="px-4 py-3 border-b border-white/10 w-1/3">Sample Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {targetFields.map(tf => {
                      const selectedHeader = Object.keys(mapping).find(k => mapping[k] === tf) || '';
                      return (
                        <tr key={tf} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3 font-medium text-emerald-400">{tf}</td>
                          <td className="px-4 py-3">
                            <select
                              value={selectedHeader}
                              onChange={(e) => handleMap(tf, e.target.value)}
                              className="bg-[#1a1d24] border border-white/10 text-white text-sm rounded-md w-full p-2 focus:ring-emerald-500 focus:border-emerald-500"
                            >
                              <option value="">-- Ignore --</option>
                              {headers.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3 text-white/50 truncate max-w-[200px]">
                            {selectedHeader && previewData[0] ? previewData[0][selectedHeader] : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              <div className="bg-[#1a1d24] border border-white/10 rounded-lg p-4">
                <h4 className="text-sm font-medium text-white mb-2">Data Preview</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="text-white/40 border-b border-white/10">
                        {headers.slice(0, 10).map(h => <th key={h} className="pb-2 pr-4">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {previewData.slice(0, 3).map((row, i) => (
                        <tr key={i} className="text-white/60">
                          {headers.slice(0, 10).map(h => <td key={h} className="py-2 pr-4 truncate max-w-[150px]">{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            Start Import
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
