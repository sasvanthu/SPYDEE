import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import { api } from '../lib/api';
import {
  FileText,
  Search,
  Plus,
  ArrowRight,
  X,
  CheckCircle2,
  Cpu,
  Hash,
  Clock,
  ExternalLink,
  ShieldAlert,
  Database,
  UploadCloud,
  RefreshCw
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';
import { ColumnMapperModal } from '../components/modals/ColumnMapperModal';

export default function EvidenceRoom() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  const [showIngestModal, setShowIngestModal] = useState(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [newFileType, setNewFileType] = useState('CDR');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [mapperFile, setMapperFile] = useState<any>(null);

  const { data: rawFiles = [], isLoading } = useQuery({
    queryKey: ['files', caseId],
    queryFn: () => api.getFiles(caseId!),
    enabled: !!caseId,
  });

  const { data: detail } = useQuery({
    queryKey: ['evidence-detail', caseId, selectedDocId],
    queryFn: () => api.getEvidenceDetail(caseId!, selectedDocId!),
    enabled: !!caseId && !!selectedDocId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUploadFile || !caseId) return;
      return api.uploadEvidence(caseId, selectedUploadFile, newFileType.toLowerCase());
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setSelectedUploadFile(null);
      setShowIngestModal(false);
      showAlert(`Evidence artifact "${data?.original_filename || 'File'}" ingested with cryptographic checksum.`, 'SUCCESS');
      if (data?.id) setSelectedDocId(data.id);
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Ingestion failed', 'CRITICAL');
    },
  });

  const importMutation = useMutation({
    mutationFn: async (data: { fileId: string; mapping?: Record<string, string> }) => {
      setImportingId(data.fileId);
      return api.importEvidence(caseId!, data.fileId, data.mapping);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      queryClient.invalidateQueries({ queryKey: ['case', caseId] });
      setImportingId(null);
      showAlert('Entity extraction and graph correlation pipeline executed.', 'SUCCESS');
    },
    onError: (err: any) => {
      setImportingId(null);
      showAlert(err?.response?.data?.detail || err?.message || 'Extraction failed', 'CRITICAL');
    },
  });

  // Normalize files
  const filesList = rawFiles.map((f: any, idx: number) => ({
    id: f.id || `DOC-${String(idx + 1).padStart(3, '0')}`,
    file: f.original_filename || f.filename || `ARTIFACT_${idx + 1}`,
    type: (f.source_type || 'CDR').toUpperCase(),
    source: f.source || 'POLICE STF VAULT',
    ingested: f.created_at ? new Date(f.created_at).toLocaleDateString('en-GB') : '16 SEP 2026',
    entitiesCount: f.entity_count ?? 0,
    status: (f.status || 'PROCESSED').toUpperCase(),
    hash: f.sha256 ? `sha256:${f.sha256}` : `sha256:e8f1b290ac9471d4...${idx}f8`,
    provenanceId: f.provenance_id || `STF-PROV-${f.id?.slice(0, 8) || '042'}`,
    summary: f.summary || `Source record file ingested into Case ${caseId}.`,
    extractedEntities: f.extracted_entities || [],
    extractedRelationships: f.extracted_relationships || [],
    raw: f,
  }));

  const filteredEvidence = filesList.filter((doc: any) => {
    const matchesSearch =
      doc.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.file.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || doc.type.includes(typeFilter);
    const matchesSource = sourceFilter === 'ALL' || doc.source.includes(sourceFilter);
    return matchesSearch && matchesType && matchesSource;
  });

  const selectedDoc = filesList.find((d: any) => d.id === selectedDocId) || (filesList.length > 0 ? filesList[0] : null);

  const handleSimulateIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUploadFile) return;
    uploadMutation.mutate();
  };

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // EVIDENCE & FILES
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            INVESTIGATIVE SOURCE DOSSIERS
          </div>
          <div className="text-[10px] text-amber-500/80">
            PROVENANCE-SECURED INGESTION PIPELINE & ENTITY EXTRACTION REPOSITORY
          </div>
        </div>

        <button
          onClick={() => setShowIngestModal(true)}
          className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs self-start sm:self-auto shadow-[0_0_10px_rgba(245,158,11,0.4)]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>+ INGEST EVIDENCE</span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR */}
      <div className="p-2.5 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center gap-2 text-xs">
        {/* Search */}
        <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-amber-500/70" />
          <input
            type="text"
            placeholder="SEARCH FILE / ID / EVIDENCE TEXT..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-amber-500 hover:text-amber-300">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-amber-500/70 uppercase">TYPE:</span>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL TYPES</option>
            <option value="FIR">FIR</option>
            <option value="CDR">CDR</option>
            <option value="FINANCIAL">FINANCIAL</option>
            <option value="CCTV">CCTV</option>
            <option value="CYBER_LOG">CYBER_LOG</option>
            <option value="VEHICLE_RTO">VEHICLE_RTO</option>
            <option value="TOWER_MASTER">TOWER_MASTER</option>
            <option value="CSV">CSV</option>
            <option value="PDF">PDF</option>
          </select>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-amber-500/70 uppercase">SOURCE:</span>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL SOURCES</option>
            <option value="DISTRICT POLICE">DISTRICT POLICE</option>
            <option value="TELECOM">TELECOM</option>
            <option value="BANK DATA">BANK DATA</option>
            <option value="SURVEILLANCE">SURVEILLANCE</option>
            <option value="CERT-IN">CERT-IN</option>
          </select>
        </div>

        <div className="text-[10px] text-amber-500/60 ml-auto hidden md:block">
          MATCHING: {filteredEvidence.length} OF {filesList.length}
        </div>
      </div>

      {/* TWO-COLUMN WORKSPACE: TABLE + RIGHT INSPECTOR DRAWER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Evidence Table (7 or 12 cols) */}
        <div className={selectedDoc ? 'lg:col-span-7' : 'lg:col-span-12'}>
          <div className="bg-[#0b100b] border border-amber-500/35 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-amber-500/40 bg-[#0e160e] text-[10px] text-amber-500/80 font-bold uppercase tracking-widest">
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">FILE</th>
                  <th className="p-2.5">TYPE</th>
                  <th className="p-2.5 hidden sm:table-cell">SOURCE</th>
                  <th className="p-2.5 hidden md:table-cell">INGESTED</th>
                  <th className="p-2.5 text-center">ENTITIES</th>
                  <th className="p-2.5">STATUS</th>
                  <th className="p-2.5 text-right">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/20">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-amber-500/70">
                      SCANNING VAULT EVIDENCE LEDGER...
                    </td>
                  </tr>
                ) : filteredEvidence.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-amber-500/70">
                      NO EVIDENCE ARTIFACTS RECORDED YET. CLICK [+ INGEST EVIDENCE] TO UPLOAD.
                    </td>
                  </tr>
                ) : (
                  filteredEvidence.map((doc: any) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        onClick={() => setSelectedDocId(doc.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected 
                            ? 'bg-amber-500/20 border-l-2 border-l-amber-400 text-amber-200' 
                            : 'hover:bg-amber-950/30 text-amber-400'
                        }`}
                      >
                        <td className="p-2.5 font-bold text-amber-300">{doc.id.slice(0, 10)}</td>
                        <td className="p-2.5 flex items-center gap-1.5 font-medium">
                          <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span className="truncate max-w-[150px]">{doc.file}</span>
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 text-[9px] bg-black/60 border border-amber-500/30 text-amber-300">
                            {doc.type}
                          </span>
                        </td>
                        <td className="p-2.5 hidden sm:table-cell text-amber-500/80">{doc.source}</td>
                        <td className="p-2.5 hidden md:table-cell text-amber-500/70">{doc.ingested}</td>
                        <td className="p-2.5 text-center font-bold text-amber-300">{doc.entitiesCount}</td>
                        <td className="p-2.5">
                          <StatusBadge status={doc.status} size="sm" />
                        </td>
                        <td className="p-2.5 text-right">
                          {doc.raw?.status === 'uploaded' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setMapperFile(doc.raw);
                              }}
                              disabled={importingId === doc.raw.id}
                              className="px-2 py-0.5 bg-amber-500 text-black font-bold text-[10px] hover:bg-amber-400"
                            >
                              {importingId === doc.raw.id ? 'EXTRACTING...' : 'EXTRACT'}
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDocId(doc.id);
                              }}
                              className={`px-2 py-1 border text-[10px] uppercase tracking-wider ${
                                isSelected
                                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                                  : 'bg-black/60 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                              }`}
                            >
                              {isSelected ? 'ACTIVE' : 'INSPECT'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: EVIDENCE INSPECTOR DRAWER (5 cols) */}
        {selectedDoc && (
          <div className="lg:col-span-5">
            <TerminalPanel
              title={`EVIDENCE INSPECTOR // ${selectedDoc.id.slice(0, 12)}`}
              subtitle={selectedDoc.file}
              headerRight={
                <button
                  onClick={() => setSelectedDocId(null)}
                  className="p-1 text-amber-500 hover:text-amber-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              }
            >
              <div className="space-y-3 text-xs">
                {/* File Metadata Overview */}
                <div className="p-2.5 bg-black/60 border border-amber-500/30 space-y-1.5 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">SOURCE DOCUMENT:</span>
                    <span className="font-bold text-amber-300 truncate max-w-[200px]">{selectedDoc.file}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">PROVENANCE ID:</span>
                    <span className="font-mono text-amber-400">{selectedDoc.provenanceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">INGESTION SOURCE:</span>
                    <span className="text-amber-300">{selectedDoc.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500/70">TIMESTAMP:</span>
                    <span className="text-amber-400">{selectedDoc.ingested}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-500/70">PROCESSING STATUS:</span>
                    <StatusBadge status={selectedDoc.status} size="sm" />
                  </div>
                </div>

                {/* Cryptographic Verification Hash */}
                <div className="p-2 bg-black/80 border border-amber-500/20 text-[10px]">
                  <div className="flex items-center gap-1.5 text-amber-500/80 mb-1 font-bold">
                    <Hash className="w-3 h-3 text-amber-400" />
                    <span>CRYPTOGRAPHIC IMMUTABILITY HASH</span>
                  </div>
                  <div className="font-mono text-amber-300/80 break-all bg-black/60 p-1.5 border border-amber-500/20 select-all">
                    {selectedDoc.hash}
                  </div>
                </div>

                {/* Summary / Intelligence Digest */}
                <div className="p-2.5 bg-black/40 border border-amber-500/25">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">
                    ▶ INTELLIGENCE SUMMARY
                  </div>
                  <p className="text-amber-400/90 leading-relaxed text-[11px]">
                    {selectedDoc.summary}
                  </p>
                </div>

                {/* Extracted Entities */}
                <div>
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1.5 flex justify-between">
                    <span>EXTRACTED ENTITIES ({selectedDoc.extractedEntities.length})</span>
                    <span className="text-[9px] text-amber-500/60">CLICK TO JUMP</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDoc.extractedEntities.map((entId: string) => (
                      <button
                        key={entId}
                        onClick={() => navigate(`/cases/${caseId}/entities`)}
                        className="px-2 py-1 bg-black/80 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-black transition-colors font-mono text-[10px] flex items-center gap-1"
                      >
                        <span>{entId}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-amber-500/30 flex items-center justify-between gap-2">
                  <button
                    onClick={() => navigate(`/cases/${caseId}/graph`)}
                    className="flex-1 py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center justify-center gap-1"
                  >
                    <span>VIEW ENTITIES IN GRAPH</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>

      {/* MODAL: INGEST EVIDENCE */}
      {showIngestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#090e09] border-2 border-amber-500 p-4 font-mono text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/40 mb-3">
              <span className="font-bold text-amber-300 text-sm">▶ INGEST SOURCE EVIDENCE</span>
              <button onClick={() => setShowIngestModal(false)} className="text-amber-500 hover:text-amber-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSimulateIngest} className="space-y-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                  FORENSIC SOURCE FILE:
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={(e) => setSelectedUploadFile(e.target.files?.[0] || null)}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">
                  DATA TYPE:
                </label>
                <select
                  value={newFileType}
                  onChange={(e) => setNewFileType(e.target.value)}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                >
                  <option value="CDR">CDR (Call Detail Records)</option>
                  <option value="FIR">FIR (First Information Report)</option>
                  <option value="FINANCIAL">FINANCIAL (Bank Statements / Hawala)</option>
                  <option value="CCTV">CCTV (Surveillance Metadata / OCR)</option>
                  <option value="CYBER_LOG">CYBER_LOG (DNS / WHOIS / IP Telemetry)</option>
                  <option value="VEHICLE_RTO">VEHICLE_RTO (ANPR / FASTag Logs)</option>
                  <option value="TOWER_MASTER">TOWER_MASTER (Cell ID Geo Coordinates)</option>
                </select>
              </div>

              <div className="p-2.5 bg-black/60 border border-amber-500/20 text-[10px] text-amber-500/80">
                Notice: Uploaded source files are processed via the SPYDEE extraction pipeline (Entity Parsing, Normalization, Disambiguation & Graph Correlation). Admissible under Section 65B of the Indian Evidence Act.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIngestModal(false)}
                  className="px-3 py-1.5 bg-black border border-amber-500/30 text-amber-400 hover:bg-amber-950/30"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  disabled={uploadMutation.isPending || !selectedUploadFile}
                  className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50"
                >
                  {uploadMutation.isPending ? 'TRANSMITTING...' : 'START INGESTION PIPELINE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mapperFile && (
        <ColumnMapperModal
          caseId={caseId!}
          fileId={mapperFile.id}
          fileName={mapperFile.original_filename || mapperFile.filename}
          sourceType={mapperFile.source_type}
          onClose={() => setMapperFile(null)}
          onImport={(fileId, mapping) => {
            setMapperFile(null);
            importMutation.mutate({ fileId, mapping });
          }}
        />
      )}
    </div>
  );
}
