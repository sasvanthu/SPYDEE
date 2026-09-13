import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function Timeline() {
  const { caseId } = useParams<{ caseId: string }>();
  const [eventType, setEventType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: events, isLoading } = useQuery({
    queryKey: ['timeline', caseId, eventType, dateFrom, dateTo],
    queryFn: () => api.getTimeline(caseId!, { event_type: eventType || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    enabled: !!caseId,
  });

  const typeColors: Record<string, string> = {
    call: 'bg-azure-100 border-azure-300 text-azure-700',
    message: 'bg-green-100 border-green-300 text-green-700',
    transaction: 'bg-amber-100 border-amber-300 text-amber-700',
    device_event: 'bg-purple-100 border-purple-300 text-purple-700',
    observation: 'bg-cyan-100 border-cyan-300 text-cyan-700',
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-navy-700 mb-6">Timeline</h1>
      <div className="flex gap-3 mb-6">
        <select value={eventType} onChange={e => setEventType(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm">
          <option value="">All events</option>
          <option value="call">Calls</option>
          <option value="message">Messages</option>
          <option value="transaction">Transactions</option>
          <option value="device_event">Device Events</option>
          <option value="observation">Observations</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm" />
        <span className="text-navy-400 self-center">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 border rounded-md text-sm" />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-navy-400">Loading timeline...</div>
      ) : events && events.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
          <div className="space-y-3">
            {events.map((ev: any) => (
              <div key={ev.id} className="flex items-start gap-4 relative">
                <div className={`w-3 h-3 rounded-full mt-1.5 ml-4.5 z-10 border-2 ${typeColors[ev.event_type] || 'bg-gray-200 border-gray-300'}`}></div>
                <div className={`flex-1 border rounded-lg p-4 ${typeColors[ev.event_type] || 'bg-gray-50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">{ev.event_type?.replace('_', ' ')}</span>
                      {ev.participants?.length > 0 && (
                        <span className="text-xs text-navy-400">{ev.participants.join(' ↔ ')}</span>
                      )}
                    </div>
                    <span className="text-xs text-navy-400">{ev.start_time ? new Date(ev.start_time).toLocaleString() : ''}</span>
                  </div>
                  {ev.location && <div className="text-xs text-navy-400 mt-1">📍 {ev.location}</div>}
                  {ev.details?.text && <div className="text-xs text-navy-600 mt-2 italic">"{ev.details.text}"</div>}
                  {ev.details?.amount && <div className="text-xs text-navy-600 mt-1">₹{ev.details.amount} ({ev.details.currency || 'INR'})</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-navy-400">No events found for the selected filters</div>
      )}
    </div>
  );
}
