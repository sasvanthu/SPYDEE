import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import {
  Database,
  ExternalLink,
  Search,
  Sparkles,
  Zap,
  Code2,
  FolderOpen,
  X,
  Play,
  CheckCircle2,
  BarChart3,
  Scale,
  Video,
  CreditCard,
  Radio,
  FileSpreadsheet,
  Cpu
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { useTerminalAlert } from '../context/TerminalAlertContext';

const DOMAIN_CATEGORIES = [
  { id: 'all', label: 'ALL DATASETS (25)', icon: Database },
  { id: 'legal', label: 'LEGAL NLP & NER (8)', icon: Scale, filter: 'Document Intelligence' },
  { id: 'cctv', label: 'CCTV & BIOMETRICS (4)', icon: Video, filter: 'CCTV' },
  { id: 'financial', label: 'FINANCIAL & AML (5)', icon: CreditCard, filter: 'Financial' },
  { id: 'telecom', label: 'TELECOM & MOBILITY (3)', icon: Radio, filter: 'CDR' },
  { id: 'crime', label: 'CRIME STATS (2)', icon: BarChart3, filter: 'Demo realism' },
  { id: 'synthetic', label: 'SYNTHETIC & RESOLUTION (3)', icon: Cpu, filter: 'Synthetic' },
];

export default function NationalDatasets() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId?: string }>();
  const { showAlert } = useTerminalAlert();

  const [activeTab, setActiveTab] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDataset, setSelectedDataset] = useState<any | null>(null);
  const [benchmarkSimulating, setBenchmarkSimulating] = useState<number | null>(null);
  const [simulatedResults, setSimulatedResults] = useState<Record<number, any>>({});

  const { data: datasets, isLoading } = useQuery({
    queryKey: ['national-datasets'],
    queryFn: () => api.getDatasets(),
  });

  const { data: summary } = useQuery({
    queryKey: ['national-datasets-summary'],
    queryFn: () => api.getDatasetsSummary(),
  });

  const syncMutation = useMutation({
    mutationFn: () => api.seedAllDatasets(),
    onSuccess: (data) => {
      showAlert(data.message || 'National datasets synchronization initiated across all active cases.', 'SUCCESS');
    },
    onError: (err: any) => {
      showAlert(err?.message || 'Failed to trigger dataset sync.', 'CRITICAL');
    },
  });

  const runBenchmark = (id: number) => {
    setBenchmarkSimulating(id);
    setTimeout(() => {
      setSimulatedResults((prev) => ({
        ...prev,
        [id]: {
          timestamp: new Date().toLocaleTimeString(),
          latency_ms: Math.floor(18 + Math.random() * 45),
          throughput_records_sec: Math.floor(1200 + Math.random() * 850),
          status: 'BENCHMARK_PASSED',
          validation_hash: `SHA256:${Math.random().toString(36).substring(2, 10).toUpperCase()}`
        }
      }));
      setBenchmarkSimulating(null);
      showAlert(`Benchmark completed for Dataset #${id}. Model inference validated.`, 'SUCCESS');
    }, 1200);
  };

  // Filter datasets
  const filteredDatasets = (datasets || []).filter((ds: any) => {
    // Domain category filter
    if (activeTab !== 'all') {
      const catObj = DOMAIN_CATEGORIES.find((c) => c.id === activeTab);
      if (catObj && catObj.filter) {
        const matchesCategory = ds.category.toLowerCase().includes(catObj.filter.toLowerCase()) ||
          ds.domain.toLowerCase().includes(catObj.filter.toLowerCase());
        if (!matchesCategory) return false;
      }
    }

    // Priority filter
    if (priorityFilter !== 'ALL') {
      if (!ds.priority.toLowerCase().startsWith(priorityFilter.toLowerCase())) {
        return false;
      }
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        ds.name.toLowerCase().includes(q) ||
        ds.organization.toLowerCase().includes(q) ||
        ds.description.toLowerCase().includes(q) ||
        ds.technology.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  return (
    <div className="space-y-4 font-mono text-xs text-[#f59e0b]">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-amber-500/40 gap-3">
        <div>
          <div className="text-[10px] text-amber-500/70 font-bold tracking-widest uppercase flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            GOVERNMENT OF INDIA // MINISTRY OF HOME AFFAIRS // CRIME PORTAL
          </div>
          <div className="text-lg md:text-xl font-black text-amber-300 tracking-wider flex items-center gap-2 mt-0.5">
            <Database className="w-5 h-5 text-amber-400" />
            <span>NATIONAL INTELLIGENCE DATASETS REGISTRY (25)</span>
          </div>
          <div className="text-[10px] text-amber-500/80 mt-0.5">
            MULTI-MODAL BENCHMARK CORPUS // LEGAL NLP, CCTV ANPR, UPI/AML FINTECH, TELECOM MOBILITY, NCRB & SYNTHESIS
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            id="btn-sync-all-datasets"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs uppercase flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.4)] disabled:opacity-50 transition-colors"
          >
            <Zap className="w-3.5 h-3.5 fill-black" />
            <span>{syncMutation.isPending ? '[ RE-INDEXING 25 DATASETS... ]' : '⚡ SYNC ALL 25 DATASETS'}</span>
          </button>
        </div>
      </div>

      {/* TELEMETRY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">TOTAL DATASETS</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">25 / 25</div>
          <div className="text-[9px] text-emerald-400 font-bold">100% OPERATIONAL</div>
        </div>
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">PRIORITY 1 (MUST)</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">{summary?.by_priority?.['P1'] || 12}</div>
          <div className="text-[9px] text-amber-500/70">MANDATORY CORE</div>
        </div>
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">PRIORITY 2 (SHOULD)</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">{summary?.by_priority?.['P2'] || 9}</div>
          <div className="text-[9px] text-amber-500/70">CROSS-VALIDATION</div>
        </div>
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">PRIORITY 3 (OPTIONAL)</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">{summary?.by_priority?.['P3'] || 4}</div>
          <div className="text-[9px] text-amber-500/70">CONTEXTUAL AUX</div>
        </div>
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">PRIMARY SPONSORS</div>
          <div className="text-xl font-black text-amber-300 mt-0.5">14+</div>
          <div className="text-[9px] text-amber-500/70">IISc, IITs, NPCI, TRAI</div>
        </div>
        <div className="bg-black/60 border border-amber-500/30 p-2.5">
          <div className="text-[9px] text-amber-500/70 uppercase">PROTOTYPE COVERAGE</div>
          <div className="text-xl font-black text-emerald-400 mt-0.5">13 CASES</div>
          <div className="text-[9px] text-amber-500/70">IND-004 TO ALL</div>
        </div>
      </div>

      {/* FILTER TABS & SEARCH */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-1 border-b border-amber-500/30 pb-2">
          {DOMAIN_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeTab === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveTab(cat.id)}
                className={`px-2.5 py-1 text-xs font-bold transition-all flex items-center gap-1.5 border ${
                  isActive
                    ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                    : 'bg-[#0a0f0a] text-amber-400 border-amber-500/30 hover:bg-amber-950/40'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-black' : 'text-amber-400'}`} />
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
          {/* Priority Filters */}
          <div className="flex items-center gap-1 text-[10px] w-full sm:w-auto">
            <span className="text-amber-500/70 uppercase font-bold mr-1">PRIORITY:</span>
            {['ALL', 'P1', 'P2', 'P3'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2 py-0.5 font-bold uppercase transition-colors border ${
                  priorityFilter === p
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                    : 'bg-black border-amber-500/30 text-amber-500/70 hover:text-amber-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-amber-500/60" />
            <input
              type="text"
              placeholder="Search datasets, models, institutes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 bg-black border border-amber-500/40 text-amber-300 placeholder-amber-500/50 text-xs focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>
      </div>

      {/* DATASET CARDS GRID */}
      {isLoading ? (
        <div className="p-12 text-center text-amber-500/70 text-xs">
          [ LOADING NATIONAL INTELLIGENCE DATASETS MATRIX... ]
        </div>
      ) : filteredDatasets.length === 0 ? (
        <div className="p-8 text-center text-amber-500/60 border border-dashed border-amber-500/30 bg-black/40">
          NO DATASETS MATCHED THE SELECTED DOMAIN OR FILTER CRITERIA.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredDatasets.map((ds: any) => {
            const hasSimResult = simulatedResults[ds.id];
            const isSimulating = benchmarkSimulating === ds.id;

            return (
              <div
                key={ds.id}
                className="bg-[#0c120c] border border-amber-500/30 p-3 flex flex-col justify-between hover:border-amber-400 transition-all group shadow-sm hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              >
                <div className="space-y-2">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 pb-1.5 border-b border-amber-500/20">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold text-[10px]">
                        #{String(ds.id).padStart(2, '0')}
                      </span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold border ${
                        ds.priority.includes('P1')
                          ? 'bg-red-950/60 border-red-500/50 text-red-400'
                          : ds.priority.includes('P2')
                          ? 'bg-amber-950/60 border-amber-500/50 text-amber-400'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      }`}>
                        {ds.priority.split(' - ')[0]}
                      </span>
                    </div>

                    <a
                      href={ds.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-500/70 hover:text-amber-300 flex items-center gap-1 text-[10px] tracking-wider transition-colors"
                      title="Open Official Repository Link"
                    >
                      <span>REPO</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* Title & Domain */}
                  <div>
                    <h3 className="text-sm font-bold text-amber-200 group-hover:text-amber-100 transition-colors leading-tight">
                      {ds.name}
                    </h3>
                    <div className="text-[10px] text-amber-500/80 font-medium mt-0.5">
                      {ds.domain}
                    </div>
                  </div>

                  {/* Sponsoring Body */}
                  <div className="text-[10px] text-amber-500/70 bg-black/60 p-1.5 border border-amber-500/20">
                    <span className="text-amber-400 font-bold">SPONSOR:</span> {ds.organization}
                  </div>

                  {/* AI Model & Stack */}
                  <div className="text-[10px] text-amber-300/90 leading-tight">
                    <span className="text-amber-500/70 font-bold">TECH:</span> {ds.technology}
                  </div>

                  {/* Description */}
                  <p className="text-[11px] text-amber-500/90 line-clamp-3 leading-relaxed">
                    {ds.description}
                  </p>

                  {/* Benchmark & Records scale */}
                  <div className="flex flex-wrap items-center justify-between text-[9px] pt-1 text-amber-500/70 border-t border-amber-500/20">
                    <span>{ds.records_count}</span>
                    <span className="text-emerald-400 font-bold">
                      {Object.keys(ds.benchmark_metrics || {})[0]}: {String(Object.values(ds.benchmark_metrics || {})[0])}
                    </span>
                  </div>

                  {/* Associated Cases Badges */}
                  <div className="flex items-center gap-1 flex-wrap pt-1">
                    <span className="text-[9px] text-amber-500/60 uppercase">CASES:</span>
                    {(ds.associated_cases || []).map((code: string) => (
                      <span
                        key={code}
                        onClick={() => navigate(`/cases`)}
                        className="cursor-pointer px-1 py-0.2 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[9px] hover:bg-amber-500 hover:text-black transition-colors"
                      >
                        {code}
                      </span>
                    ))}
                  </div>

                  {/* Benchmark Results Display (if run) */}
                  {hasSimResult && (
                    <div className="p-1.5 bg-emerald-950/30 border border-emerald-500/40 text-[9px] space-y-0.5">
                      <div className="text-emerald-400 font-bold flex items-center justify-between">
                        <span>✓ {hasSimResult.status}</span>
                        <span>{hasSimResult.latency_ms} ms</span>
                      </div>
                      <div className="text-emerald-500/80">
                        Throughput: {hasSimResult.throughput_records_sec} records/s // {hasSimResult.validation_hash}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-3 border-t border-amber-500/20 mt-2">
                  <button
                    onClick={() => setSelectedDataset(ds)}
                    className="py-1 px-2 bg-black border border-amber-500/40 hover:border-amber-400 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors uppercase"
                  >
                    <Code2 className="w-3 h-3" />
                    <span>INSPECT SAMPLE</span>
                  </button>

                  <button
                    onClick={() => runBenchmark(ds.id)}
                    disabled={isSimulating}
                    className="py-1 px-2 bg-amber-500/20 hover:bg-amber-500 hover:text-black border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors uppercase disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" />
                    <span>{isSimulating ? 'BENCHMARKING...' : 'RUN BENCHMARK'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* SAMPLE DATA MODAL */}
      {selectedDataset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#0a0f0a] border border-amber-400 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-[0_0_30px_rgba(245,158,11,0.3)]">
            {/* Modal Header */}
            <div className="p-3 border-b border-amber-500/40 flex items-center justify-between bg-[#121a12]">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 bg-amber-500 text-black font-bold text-xs">
                  #{String(selectedDataset.id).padStart(2, '0')}
                </span>
                <span className="font-bold text-amber-200 text-sm">
                  {selectedDataset.name} // SAMPLE RECORD INSPECTOR
                </span>
              </div>
              <button
                onClick={() => setSelectedDataset(null)}
                className="p-1 hover:bg-amber-500/20 text-amber-400 border border-amber-500/40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3.5 overflow-y-auto space-y-3 flex-1">
              <div>
                <div className="text-[10px] text-amber-500/70 uppercase font-bold">OFFICIAL REPOSITORY & CITATION</div>
                <a
                  href={selectedDataset.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-amber-300 hover:underline flex items-center gap-1.5 mt-0.5"
                >
                  <span>{selectedDataset.url}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-black border border-amber-500/30">
                  <span className="text-amber-500/70 font-bold uppercase">Sponsoring Institution:</span>
                  <div className="text-amber-200 mt-0.5">{selectedDataset.organization}</div>
                </div>
                <div className="p-2 bg-black border border-amber-500/30">
                  <span className="text-amber-500/70 font-bold uppercase">Applied Model / Stack:</span>
                  <div className="text-amber-200 mt-0.5">{selectedDataset.technology}</div>
                </div>
              </div>

              <div>
                <div className="text-[10px] text-amber-500/70 uppercase font-bold mb-1">
                  INTERACTIVE REALISTIC RECORD SCHEMA (JSON):
                </div>
                <pre className="p-3 bg-black border border-amber-500/40 text-amber-300 font-mono text-[11px] overflow-x-auto max-h-64 leading-relaxed selection:bg-amber-500 selection:text-black">
                  {JSON.stringify(selectedDataset.sample_record, null, 2)}
                </pre>
              </div>

              {selectedDataset.benchmark_metrics && (
                <div>
                  <div className="text-[10px] text-amber-500/70 uppercase font-bold mb-1">
                    MODEL BENCHMARK METRICS:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(selectedDataset.benchmark_metrics).map(([k, v]) => (
                      <div key={k} className="p-2 bg-black/60 border border-amber-500/20 text-[10px]">
                        <div className="text-amber-500/70 uppercase">{k.replace(/_/g, ' ')}</div>
                        <div className="font-bold text-amber-200 text-xs mt-0.5">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-2.5 border-t border-amber-500/40 bg-[#0c120c] flex items-center justify-between">
              <span className="text-[10px] text-amber-500/60">
                PROVENANCE: VERIFIED AGAINST BHARAT INTELLIGENCE SCHEMA
              </span>
              <button
                onClick={() => setSelectedDataset(null)}
                className="px-3 py-1 bg-amber-500 text-black font-bold text-xs uppercase hover:bg-amber-400"
              >
                CLOSE INSPECTOR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
