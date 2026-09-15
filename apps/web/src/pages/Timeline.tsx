import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function Timeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const queryClient = useQueryClient();
  const [eventType, setEventType] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [source, setSource] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualForm, setManualForm] = useState({
    event_type: 'observation',
    label: '',
    start_time: '',
    time_precision: 'full',
    details: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', caseId, eventType, entityLabel, dateFrom, dateTo, source],
    queryFn: () => api.getTimeline(caseId!, {
      event_type: eventType || undefined,
      entity_label: entityLabel || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      source: source || undefined,
      page_size: 100,
    }),
    enabled: !!caseId,
  });
  const events = data?.items || [];

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
    },
  });

  const typeColors: Record<string, string> = {
    call: 'border-cyan-300 bg-cyan-50',
    message: 'border-green-300 bg-green-50',
    transaction: 'border-amber-300 bg-amber-50',
    device_event: 'border-purple-300 bg-purple-50',
    observation: 'border-blue-300 bg-blue-50',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Timeline</h1>
          <p className="text-sm text-gray-500 mt-1">{data?.total || 0} events</p>
        </div>
        <button onClick={() => setShowManual(v => !v)}
          className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700">
          {showManual ? 'Cancel' : '+ Add Event'}
        </button>
      </div>

      {showManual && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Add Manual Event</h2>
          <p className="text-xs text-gray-500">Manual events are labelled as investigator-added and are never presented as evidence-derived.</p>
          <div className="grid grid-cols-2 gap-3">
            <select value={manualForm.event_type} onChange={e => setManualForm({ ...manualForm, event_type: e.target.value })}
              className="px-3 py-2 border rounded-md text-sm">
              <option value="observation">Observation</option>
              <option value="call">Call</option>
              <option value="message">Message</option>
              <option value="transaction">Transaction</option>
              <option value="device_event">Device Event</option>
            </select>
            <input type="datetime-local" value={manualForm.start_time} onChange={e => setManualForm({ ...manualForm, start_time: e.target.value })}
              className="px-3 py-2 border rounded-md text-sm" />
          </div>
          <input value={manualForm.label} onChange={e => setManualForm({ ...manualForm, label: e.target.value })}
            placeholder="Event label (e.g. Investigator observed suspect at location)" className="w-full px-3 py-2 border rounded-md text-sm" />
          <textarea value={manualForm.details} onChange={e => setManualForm({ ...manualForm, details: e.target.value })}
            placeholder="Notes about the event" className="w-full px-3 py-2 border rounded-md text-sm" rows={2} />
          <button onClick={() => manualMutation.mutate()} disabled={!manualForm.label || manualMutation.isPending}
            className="bg-cyan-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-cyan-700 disabled:opacity-50">
            {manualMutation.isPending ? 'Saving...' : 'Record Event'}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={eventType} onChange={e => setEventType(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm bg-white">
          <option value="">All event types</option>
          <option value="call">Calls</option>
          <option value="message">Messages</option>
          <option value="transaction">Transactions</option>
          <option value="device_event">Device Events</option>
          <option value="observation">Observations</option>
        </select>
        <input type="text" value={entityLabel} onChange={e => setEntityLabel(e.target.value)} placeholder="Filter by entity label..."
          className="px-3 py-2 border rounded-md text-sm" />
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm" />
        <span className="text-gray-400 self-center">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm" />
        <input type="text" value={source} onChange={e => setSource(e.target.value)} placeholder="Source type..."
          className="px-3 py-2 border rounded-md text-sm" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading timeline...</div>
      ) : events.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          <div className="space-y-3">
            {events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-4 relative">
                <div className={`w-3 h-3 rounded-full mt-1.5 ml-[21px] z-10 border-2 ${typeColors[ev.event_type] || 'bg-gray-200 border-gray-300'}`}></div>
                <div className={`flex-1 border rounded-lg p-4 ${typeColors[ev.event_type] || 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize text-gray-800">{ev.event_type?.replace('_', ' ')}</span>
                      {ev.participants?.length > 0 && (
                        <span className="text-xs text-gray-500">{ev.participants.slice(0, 3).join(' ↔ ')}{ev.participants.length > 3 ? ` +${ev.participants.length - 3}` : ''}</span>
                      )}
                      {ev.is_manual && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium uppercase">Manual</span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {ev.start_time ? new Date(ev.start_time).toLocaleString() : 'Undated'}
                      {ev.time_precision === 'unknown' && ev.start_time ? ` (${ev.time_precision})` : ''}
                    </span>
                  </div>
                  {ev.location && <div className="text-xs text-gray-500 mt-1">📍 {ev.location}</div>}
                  {ev.source_type && <div className="text-xs text-gray-400 mt-1">Source: {ev.source_type}</div>}
                  {ev.details?.text && <div className="text-xs text-gray-600 mt-2 italic">"{ev.details.text}"</div>}
                  {ev.details?.amount && <div className="text-xs text-gray-600 mt-1">₹{ev.details.amount} ({ev.details.currency || 'INR'})</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">No events found for the selected filters</div>
      )}
    </div>
  );
}