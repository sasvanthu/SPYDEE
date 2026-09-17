import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import {
  Clock,
  Plus,
  Filter,
  Calendar,
  Search,
  X,
  Phone,
  MessageSquare,
  DollarSign,
  Radio,
  Eye,
  MapPin,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { StatusBadge } from '../components/common/StatusBadge';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function Timeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const { showAlert } = useTerminalAlert();

  const [eventType, setEventType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<'all' | 'critical' | '24h'>('all');

  const [manualForm, setManualForm] = useState({
    event_type: 'observation',
    label: '',
    start_time: '',
    time_precision: 'full',
    details: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', caseId, eventType, dateFrom, dateTo],
    queryFn: () => api.getTimeline(caseId!, {
      event_type: eventType || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      page_size: 100,
    }),
    enabled: !!caseId,
  });

  const rawEvents = data?.items || [];

  const manualMutation = useMutation({
    mutationFn: () => api.createManualEvent(caseId!, {
      event_type: manualForm.event_type,
      label: manualForm.label,
      start_time: manualForm.start_time ? new Date(manualForm.start_time).toISOString() : undefined,
      time_precision: manualForm.start_time ? manualForm.time_precision : 'unknown',
      details: manualForm.details ? { text: manualForm.details } : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timeline', caseId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-summary', caseId] });
      setShowManual(false);
      setManualForm({ event_type: 'observation', label: '', start_time: '', time_precision: 'full', details: '' });
      showAlert('Investigator observation recorded to case chronological sequence.', 'SUCCESS');
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Failed to record event', 'CRITICAL');
    }
  });

  // Filter with client search query
  const filteredEvents = rawEvents.filter((ev: any) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const labelMatch = ev.label?.toLowerCase().includes(q);
    const textMatch = ev.details?.text?.toLowerCase().includes(q);
    const actorMatch = ev.participants?.some((p: string) => p.toLowerCase().includes(q));
    const locMatch = ev.location?.toLowerCase().includes(q);
    return labelMatch || textMatch || actorMatch || locMatch;
  });

  const getEventIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'call': return <Phone className="w-3.5 h-3.5 text-amber-400" />;
      case 'message': return <MessageSquare className="w-3.5 h-3.5 text-amber-400" />;
      case 'transaction': return <DollarSign className="w-3.5 h-3.5 text-emerald-400" />;
      case 'tower_ping':
      case 'device_event': return <Radio className="w-3.5 h-3.5 text-amber-400" />;
      case 'observation': return <Eye className="w-3.5 h-3.5 text-amber-300" />;
      default: return <Clock className="w-3.5 h-3.5 text-amber-500" />;
    }
  };

  const applyPreset = (preset: 'all' | 'critical' | '24h') => {
    setSelectedPreset(preset);
    if (preset === 'all') {
      setDateFrom('');
      setDateTo('');
    } else if (preset === 'critical') {
      setDateFrom('2026-09-12T00:00');
      setDateTo('2026-09-15T23:59');
    } else if (preset === '24h') {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
      setDateFrom(yesterday.toISOString().slice(0, 16));
      setDateTo(now.toISOString().slice(0, 16));
    }
  };

  return (
    <div className="space-y-3 font-mono text-xs text-[#f59e0b]">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // CHRONOLOGY
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            INVESTIGATIVE TIMELINE & EVENT SEQUENCER
          </div>
          <div className="text-[10px] text-amber-500/80">
            TOTAL {data?.total || rawEvents.length} RECORDED TELECOM, TOWER, GEOLOCATION & OBSERVATION EVENTS
          </div>
        </div>

        <button
          onClick={() => setShowManual(!showManual)}
          className="px-3 py-1.5 bg-amber-500 text-black font-bold hover:bg-amber-400 transition-colors flex items-center gap-1.5 text-xs self-start sm:self-auto shadow-[0_0_10px_rgba(245,158,11,0.4)]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{showManual ? 'CLOSE ENTRY FORM' : '+ LOG MANUAL EVENT'}</span>
        </button>
      </div>

      {/* MANUAL ENTRY FORM */}
      {showManual && (
        <TerminalPanel title="LOG INVESTIGATOR OBSERVATION" subtitle="SECTION 91 ATTESTATION">
          <div className="space-y-3 text-xs">
            <p className="text-amber-500/80 text-[11px]">
              Manual entries are attested by investigating officers and recorded as secondary corroborated events distinct from automated CDR extraction.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">EVENT TYPE:</label>
                <select
                  value={manualForm.event_type}
                  onChange={(e) => setManualForm({ ...manualForm, event_type: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                >
                  <option value="observation">Physical Observation / Surveillance</option>
                  <option value="call">Witnessed / Intercepted Call</option>
                  <option value="message">Transcribed Message</option>
                  <option value="transaction">Cash / Hawala Transfer</option>
                  <option value="device_event">Hardware / SIM Handover</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] text-amber-500/80 uppercase mb-1">TIMESTAMP (LOCAL IST):</label>
                <input
                  type="datetime-local"
                  value={manualForm.start_time}
                  onChange={(e) => setManualForm({ ...manualForm, start_time: e.target.value })}
                  className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] text-amber-500/80 uppercase mb-1">DESCRIPTION / SUMMARY:</label>
              <input
                type="text"
                placeholder="e.g. Target observed entering Sector 14 coffee shop with secondary courier"
                value={manualForm.label}
                onChange={(e) => setManualForm({ ...manualForm, label: e.target.value })}
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] text-amber-500/80 uppercase mb-1">FORENSIC FIELD NOTES:</label>
              <textarea
                placeholder="License plates, physical description, accompanying associates..."
                value={manualForm.details}
                onChange={(e) => setManualForm({ ...manualForm, details: e.target.value })}
                className="w-full p-2 bg-black border border-amber-500/40 text-amber-300 text-xs outline-none h-16 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="px-3 py-1 bg-black border border-amber-500/30 text-amber-400 hover:bg-amber-950/30"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => manualMutation.mutate()}
                disabled={!manualForm.label || manualMutation.isPending}
                className="px-3 py-1 bg-amber-500 text-black font-bold hover:bg-amber-400 shadow-[0_0_8px_#f59e0b] disabled:opacity-50"
              >
                {manualMutation.isPending ? 'COMMITTING...' : 'COMMIT TO CHRONOLOGY'}
              </button>
            </div>
          </div>
        </TerminalPanel>
      )}

      {/* FILTER & TEMPORAL MATRIX */}
      <div className="p-2.5 bg-[#0a0f0a] border border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-black/80 border border-amber-500/40 px-2 py-1 min-w-[200px] flex-1">
            <Search className="w-3.5 h-3.5 text-amber-500/70" />
            <input
              type="text"
              placeholder="SEARCH EVENT TEXT / ID / ACTORS..."
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

          {/* Event Type Filter */}
          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="bg-black border border-amber-500/40 text-amber-300 text-xs px-2 py-1 outline-none font-mono"
          >
            <option value="">ALL EVENT CLASSES</option>
            <option value="call">CALLS</option>
            <option value="message">MESSAGES</option>
            <option value="transaction">TRANSACTIONS</option>
            <option value="device_event">DEVICE EVENTS</option>
            <option value="observation">OBSERVATIONS</option>
          </select>
        </div>

        {/* Date Presets */}
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-amber-500/70 uppercase">WINDOW:</span>
          {(['all', 'critical', '24h'] as const).map((pr) => (
            <button
              key={pr}
              onClick={() => applyPreset(pr)}
              className={`px-2 py-0.5 text-[10px] uppercase border transition-colors ${
                selectedPreset === pr
                  ? 'bg-amber-500 text-black font-bold border-amber-400'
                  : 'bg-black/80 border-amber-500/30 text-amber-400 hover:bg-amber-500/20'
              }`}
            >
              {pr === 'all' ? 'ALL TIME' : pr === 'critical' ? 'CRITICAL (12-15 SEP)' : 'PAST 24H'}
            </button>
          ))}
        </div>
      </div>

      {/* CHRONOLOGICAL STREAM */}
      {isLoading ? (
        <div className="text-center py-16 text-xs text-amber-500">
          [ SCANNING & ORDERING TEMPORAL EVENT LEDGER... ]
        </div>
      ) : filteredEvents.length > 0 ? (
        <div className="relative pl-6 sm:pl-8 space-y-3.5 my-3">
          {/* Vertical central guide line */}
          <div className="absolute left-2.5 sm:left-3 top-2 bottom-2 w-0.5 bg-amber-500/30" />

          {filteredEvents.map((ev: any, idx: number) => {
            const timeStr = ev.start_time
              ? new Date(ev.start_time).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                }) + ' IST'
              : '14 SEP 2026 // 21:40:12 IST';

            return (
              <div key={ev.id || idx} className="relative flex items-start gap-3">
                {/* Timeline Node Marker */}
                <div className="absolute -left-6 sm:-left-8 top-3.5 w-3 h-3 rounded-full border-2 border-amber-400 bg-black z-10 shadow-[0_0_8px_rgba(245,158,11,0.6)] flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
                </div>

                {/* Event Card */}
                <div className="flex-1 bg-[#0b100b] border border-amber-500/35 hover:border-amber-400 p-3.5 rounded-xs transition-colors space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-500/25 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="p-1 bg-black border border-amber-500/40">
                        {getEventIcon(ev.event_type)}
                      </div>
                      <span className="font-bold text-xs uppercase text-amber-300">
                        [{ev.event_type?.replace('_', ' ') || 'EVENT'}]
                      </span>
                      <span className="text-xs text-amber-200 font-bold">
                        {ev.label || ev.event_type}
                      </span>
                      {ev.is_manual && (
                        <span className="text-[9px] px-1.5 py-0.2 bg-amber-500/20 border border-amber-500/50 text-amber-300 uppercase font-bold">
                          MANUAL
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-amber-500 font-mono">
                      {timeStr}
                    </div>
                  </div>

                  {/* Participants & Actors */}
                  {ev.participants?.length > 0 && (
                    <div className="text-xs flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-amber-500/70 uppercase">ACTORS:</span>
                      {ev.participants.map((p: string, pIdx: number) => (
                        <span
                          key={pIdx}
                          className="px-2 py-0.5 bg-black border border-amber-500/40 text-[10px] text-amber-300 font-bold"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Metadata Row */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-amber-500/80 pt-0.5">
                    {ev.location && (
                      <span className="flex items-center gap-1 text-red-400">
                        <MapPin className="w-3 h-3" />
                        <span>{ev.location}</span>
                      </span>
                    )}
                    {ev.source_type && (
                      <span>
                        SRC: <span className="text-amber-300 font-bold">{ev.source_type.toUpperCase()}</span>
                      </span>
                    )}
                    {ev.details?.amount && (
                      <span className="text-emerald-400 font-bold">
                        ₹{ev.details.amount.toLocaleString()} ({ev.details.currency || 'INR'})
                      </span>
                    )}
                  </div>

                  {ev.details?.text && (
                    <div className="text-xs text-amber-200/90 italic bg-black/60 border-l-2 border-amber-500 p-2 text-[11px]">
                      "{ev.details.text}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="p-12 text-center text-xs text-amber-500/70 border border-dashed border-amber-500/30 bg-[#0a0f0a]">
          NO EVENTS MATCHING ACTIVE CHRONOLOGICAL SCOPE.
        </div>
      )}
    </div>
  );
}
