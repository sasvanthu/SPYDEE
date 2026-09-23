import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import {
  Video,
  Search,
  X,
  Target,
  Eye,
  MapPin,
  Clock,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Layers,
  Radio,
  Signal,
  Hash,
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { ConfidenceMeter } from '../components/common/ConfidenceMeter';

const CONFIDENCE_TIER_COLORS = {
  HIGH: '#22c55e',
  MEDIUM: '#f59e0b',
  LOW: '#ef4444',
};

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }) + ' IST';
  } catch {
    return ts;
  }
}

export default function CCTVModule() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL');
  const [selectedObservation, setSelectedObservation] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  const { data: caseData } = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.getCase(caseId!),
    enabled: !!caseId,
  });

  const { data: cctvObservations = [], isLoading: cctvLoading } = useQuery({
    queryKey: ['cctv-observations', caseId],
    queryFn: () => api.getCCTVObservations(caseId!),
    enabled: !!caseId,
  });

  const filteredObservations = cctvObservations.filter((obs: any) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const idMatch = obs.id.toLowerCase().includes(q);
      const locMatch = (obs.location || '').toLowerCase().includes(q);
      const camMatch = (obs.camera_id || '').toLowerCase().includes(q);
      if (!idMatch && !locMatch && !camMatch) return false;
    }
    if (confidenceFilter !== 'ALL' && obs.confidence !== confidenceFilter) return false;
    return true;
  });

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b] h-full flex flex-col">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // CCTV & PHYSICAL EVIDENCE
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            PHYSICAL OBSERVATION — SYNTHETIC EVIDENCE PACKAGE
          </div>
          <div className="text-[10px] text-amber-500/80">
            PRECOMPUTED RE-IDENTIFICATION SCORES • NO LIVE FACIAL RECOGNITION • INFERRED — NOT CONFIRMED
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH OBSERVATIONS..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-amber-300 placeholder-amber-500/40 outline-none w-full text-xs font-mono"
            />
          </div>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="ALL">ALL CONFIDENCE</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>
          <button
            onClick={() => setViewMode(viewMode === 'cards' ? 'list' : 'cards')}
            className="px-2.5 py-1.5 bg-black border border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-xs flex items-center gap-1.5"
          >
            {viewMode === 'cards' ? <Layers className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
            <span>{viewMode === 'cards' ? 'LIST' : 'CARDS'}</span>
          </button>
        </div>
      </div>

      {/* CLASSIFICATION NOTICE */}
      <div className="p-2 bg-amber-950/40 border border-amber-500/40 text-[10px] text-amber-300 flex items-center gap-2 shrink-0">
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="font-bold">CLASSIFICATION:</span>
        <span>PHYSICAL OBSERVATION — SYNTHETIC EVIDENCE PACKAGE</span>
        <span className="text-amber-500/60">|</span>
        <span>NO LIVE SURVEILLANCE</span>
        <span className="text-amber-500/60">|</span>
        <span>NO LIVE FEED</span>
        <span className="text-amber-500/60">|</span>
        <span>NO CONFIRMED IDENTITY</span>
        <span className="text-amber-500/60">|</span>
        <span>INFERRED — NOT CONFIRMED</span>
        <span className="text-amber-500/60">|</span>
        <span>REQUIRES INVESTIGATOR VERIFICATION</span>
        <span className="text-amber-500/60">|</span>
        <span>HUMAN-IN-THE-LOOP</span>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-3 min-h-0">
        {/* LEFT: OBSERVATION CARDS */}
        <div className={selectedObservation ? 'lg:col-span-7 space-y-2.5' : 'lg:col-span-12 space-y-2.5'} style={{ minHeight: 0 }}>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredObservations.map((obs: any) => (
                <CCTVCard
                  key={obs.id}
                  observation={obs}
                  isSelected={selectedObservation?.id === obs.id}
                  onClick={() => setSelectedObservation(obs)}
                  caseId={caseId}
                  navigate={navigate}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredObservations.map((obs: any) => (
                <CCTVListItem
                  key={obs.id}
                  observation={obs}
                  isSelected={selectedObservation?.id === obs.id}
                  onClick={() => setSelectedObservation(obs)}
                />
              ))}
            </div>
          )}
          {cctvLoading ? (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              LOADING CCTV OBSERVATIONS...
            </div>
          ) : filteredObservations.length === 0 && (
            <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
              NO CCTV OBSERVATIONS MATCHING CURRENT FILTERS.
            </div>
          )}
        </div>

        {/* RIGHT: SELECTED OBSERVATION DETAIL */}
        {selectedObservation && (
          <div className="lg:col-span-5 space-y-3 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <TerminalPanel
              title={`CCTV OBSERVATION // ${selectedObservation.id}`}
              subtitle="Physical Observation — Synthetic Evidence Package"
              headerRight={
                <button onClick={() => setSelectedObservation(null)} className="text-amber-500 hover:text-amber-300"><X className="w-3.5 h-3.5" /></button>
              }
            >
              <div className="space-y-3 text-xs">
                {/* Header Info */}
                <div className="p-2 bg-black/60 border border-amber-500/20 space-y-1 text-[11px]">
                  <div className="flex justify-between"><span className="text-amber-500/70">CAMERA:</span><span className="text-amber-300 font-mono">{selectedObservation.camera_id}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500/70">LOCATION:</span><span className="text-amber-300">{selectedObservation.location}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500/70">COORDINATES:</span><span className="text-amber-300 font-mono">{selectedObservation.lat.toFixed(4)}, {selectedObservation.lon.toFixed(4)}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500/70">TIMESTAMP:</span><span className="text-amber-300 font-mono">{formatTimestamp(selectedObservation.timestamp)}</span></div>
                  <div className="flex justify-between"><span className="text-amber-500/70">FRAME REF:</span><span className="text-amber-300 font-mono">{selectedObservation.frame_reference}</span></div>
                </div>

                {/* Preview Placeholder */}
                <div className="p-2 bg-black/40 border border-amber-500/20 text-[10px] text-amber-500/70">
                  [▶ OBSERVATION PREVIEW] Grayscale placeholder frame with bounding box overlay on candidate region — do NOT claim live video
                </div>

                {/* Signals */}
                <div className="space-y-1">
                  <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">SIGNALS:</div>
                  <div className="space-y-1 text-[10px]">
                    <SignalRow label="Appearance similarity" value={selectedObservation.signals.appearance} color="#06b6d4" />
                    <SignalRow label="Telecom device presence" value={selectedObservation.signals.telecom} color="#6366f1" />
                    <SignalRow label="Temporal overlap" value={selectedObservation.signals.temporal} color="#22c55e" />
                  </div>
                </div>

                {/* Summary */}
                <div className="flex justify-between text-[10px] pt-1 border-t border-amber-500/15">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500/70">Identity confidence:</span>
                    <span className="font-bold" style={{ color: CONFIDENCE_TIER_COLORS[selectedObservation.confidence as keyof typeof CONFIDENCE_TIER_COLORS] }}>{selectedObservation.confidence}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-500/70">Contributing signals:</span>
                    <span className="text-amber-300 font-bold">{selectedObservation.contributing_signals}</span>
                  </div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-amber-500/70">Status:</span>
                  <span className="text-amber-400">{selectedObservation.status}</span>
                </div>

                {/* Classification Notice */}
                <div className="p-1.5 bg-black/80 border border-amber-500/40 text-[9px] text-amber-400 leading-tight">
                  CLASSIFICATION: <span className="font-bold text-amber-200">SYNTHETIC EVIDENCE PACKAGE</span> — NOT LIVE SURVEILLANCE.<br />
                  Precomputed synthetic re-identification scores. Inferred — not confirmed. Requires investigator verification.
                </div>

                {/* Action Buttons */}
                <div className="flex gap-1 pt-2">
                  <button className="flex-1 py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1" onClick={() => console.log('View in graph')}>
                    <Target className="w-3 h-3" />
                    <span>VIEW IN GRAPH</span>
                  </button>
                  <button className="flex-1 py-1.5 bg-black border border-amber-500/50 hover:bg-amber-500/20 text-amber-300 font-bold text-center text-xs flex items-center justify-center gap-1" onClick={() => console.log('View evidence')}>
                    <Eye className="w-3 h-3" />
                    <span>VIEW EVIDENCE</span>
                  </button>
                </div>

                {/* Map Integration Note */}
                <div className="p-2 bg-black/60 border border-amber-500/20 text-[10px] text-amber-500/70 pt-2 border-t border-amber-500/15">
                  <div className="font-bold text-amber-300 mb-1">INTEGRATION STATUS:</div>
                  <div className="space-y-0.5 text-[9px]">
                    <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" /><span>Graph: CCTVObservation nodes linked to hypothesis path</span></div>
                    <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" /><span>Map: Markers at {selectedObservation.lat.toFixed(4)}, {selectedObservation.lon.toFixed(4)} with pulsing ring</span></div>
                    <div className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-2.5 h-2.5" /><span>Timeline: Event dot at {formatTimestamp(selectedObservation.timestamp)}</span></div>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          </div>
        )}
      </div>
    </div>
  );
}

function CCTVCard({ observation, isSelected, onClick, caseId, navigate }: any) {
  const confColor = CONFIDENCE_TIER_COLORS[observation.confidence as keyof typeof CONFIDENCE_TIER_COLORS];
  
  return (
    <div
      onClick={onClick}
      className={`p-3 bg-[#0b100b] border cursor-pointer transition-all ${isSelected ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/20' : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'}`}
    >
      <div className="flex items-center justify-between pb-2 border-b border-amber-500/20 mb-2">
        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">{observation.id}</span>
        <StatusBadge status={observation.confidence.toLowerCase()} size="sm" />
      </div>

      <div className="space-y-1.5 text-[11px]">
        <div className="text-amber-200/90 leading-relaxed">{observation.location}</div>
        <div className="text-amber-500/70 font-mono text-[10px]">{formatTimestamp(observation.timestamp)}</div>

        {/* Signals */}
        <div className="space-y-1 pt-1 border-t border-amber-500/15">
          <div className="text-[10px] text-amber-500/80 font-bold uppercase mb-1">SIGNALS:</div>
          <SignalRow label="Appearance" value={observation.signals.appearance} color="#06b6d4" compact />
          <SignalRow label="Telecom" value={observation.signals.telecom} color="#6366f1" compact />
          <SignalRow label="Temporal" value={observation.signals.temporal} color="#22c55e" compact />
        </div>

        <div className="flex justify-between items-center text-[10px] text-amber-500/60 pt-2 border-t border-amber-500/10 mt-2">
          <span>Confidence: <span className="font-bold" style={{ color: confColor }}>{observation.confidence}</span></span>
          <span className="text-amber-400 font-bold">CLICK TO EXPAND &rarr;</span>
        </div>
      </div>
    </div>
  );
}

function CCTVListItem({ observation, isSelected, onClick }: any) {
  const confColor = CONFIDENCE_TIER_COLORS[observation.confidence as keyof typeof CONFIDENCE_TIER_COLORS];
  
  return (
    <div
      onClick={onClick}
      className={`p-2 bg-[#0b100b] border cursor-pointer transition-all ${isSelected ? 'border-amber-400 bg-amber-950/20' : 'border-amber-500/35 hover:border-amber-400 hover:bg-[#0e160e]'} flex items-center gap-3`}
    >
      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300 w-16">{observation.id}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-bold text-amber-300 truncate">{observation.location}</span>
          <span className="text-amber-500/70 font-mono">{formatTimestamp(observation.timestamp)}</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] mt-0.5">
          <SignalRow label="App" value={observation.signals.appearance} color="#06b6d4" compact inline />
          <SignalRow label="Tel" value={observation.signals.telecom} color="#6366f1" compact inline />
          <SignalRow label="Tmp" value={observation.signals.temporal} color="#22c55e" compact inline />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StatusBadge status={observation.confidence.toLowerCase()} size="sm" />
      </div>
    </div>
  );
}

function SignalRow({ label, value, color, compact, inline }: any) {
  const barWidth = Math.round(value * 100);
  if (inline) {
    return (
      <div className="flex items-center gap-1" style={{ color }}>
        <span className="text-amber-500/70">{label}:</span>
        <span className="font-bold text-amber-300">{Math.round(value * 100)}%</span>
        <div className="w-12 h-1.5 bg-black/60 border border-amber-500/30 overflow-hidden">
          <div className="h-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-amber-500/70 w-28">{label}:</span>
      <div className="flex-1 h-2 bg-black/60 border border-amber-500/30 overflow-hidden">
        <div className="h-full" style={{ width: `${barWidth}%`, backgroundColor: color }} />
      </div>
      <span className="font-bold text-amber-300 w-10 text-right">{Math.round(value * 100)}%</span>
    </div>
  );
}