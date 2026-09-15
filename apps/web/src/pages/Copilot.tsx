import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

export default function Copilot() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<any[]>([]);

  const { data: history } = useQuery({
    queryKey: ['copilot', caseId],
    queryFn: () => api.getCopilotHistory(caseId!),
    enabled: !!caseId,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => api.askCopilot(caseId!, q),
    onSuccess: (data, q) => {
      setMessages(prev => [...prev, { role: 'user', content: q }, { role: 'assistant', content: data }]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    askMutation.mutate(query);
    setQuery('');
  };

  const examples = [
    'What are the strongest leads?',
    'Who appeared most frequently?',
    'Explain Alias-01',
    'What contradicts this lead?',
    'What evidence is missing?',
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <h1 className="text-2xl font-bold text-navy-700 mb-4">Investigator Copilot</h1>

      <div className="flex-1 overflow-y-auto bg-white border rounded-lg p-4 mb-4 space-y-4">
        {messages.length === 0 && history && history.length > 0 && (
          <div className="text-sm text-navy-400 mb-4">
            <p className="font-medium mb-2">Recent queries:</p>
            {history.slice(0, 3).map((m: any) => (
              <div key={m.id} className="bg-gray-50 rounded p-2 mb-2">
                <div className="text-navy-600">Q: {m.query}</div>
                <div className="text-navy-400 mt-1">A: {m.response?.substring(0, 150)}...</div>
              </div>
            ))}
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-navy-400 mb-4">Ask me about this case. I can help you find entities, explain hypotheses, show paths, or identify missing evidence.</div>
            <div className="flex flex-wrap justify-center gap-2">
              {examples.map(ex => (
                <button key={ex} onClick={() => { setQuery(ex); askMutation.mutate(ex); }}
                  className="text-xs bg-azure-50 text-azure-700 px-3 py-1.5 rounded-full hover:bg-azure-100 border border-azure-200">
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[70%] rounded-lg p-3 text-sm ${m.role === 'user' ? 'bg-azure-500 text-white' : 'bg-gray-100 text-navy-700'}`}>
              {m.role === 'assistant' ? (
                <div>
                  <p className="whitespace-pre-wrap">{m.content.answer}</p>
                  {m.content.links?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.content.links.map((l: any, j: number) => {
                        if (l.type === 'contradiction') return (
                          <button key={j} onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                            className="text-[10px] bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">Contradiction</button>
                        );
                        if (l.type === 'lead') return (
                          <button key={j} onClick={() => navigate(`/cases/${caseId}/leads`)}
                            className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">Lead</button>
                        );
                        if (l.type === 'information_gap') return (
                          <button key={j} onClick={() => navigate(`/cases/${caseId}/leads`)}
                            className="text-[10px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Info Gap</button>
                        );
                        if (l.type === 'entity') return (
                          <button key={j} onClick={() => navigate(`/cases/${caseId}/entities`)}
                            className="text-[10px] bg-cyan-50 text-cyan-700 border border-cyan-200 px-2 py-0.5 rounded-full">Entity</button>
                        );
                        if (l.type === 'hypothesis') return (
                          <button key={j} onClick={() => navigate(`/cases/${caseId}/hypotheses`)}
                            className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-2 py-0.5 rounded-full">Hypothesis</button>
                        );
                        return (
                          <span key={j} className="text-[10px] bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded-full">
                            {l.type}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {m.content.citations?.length > 0 && (
                    <div className="mt-2 pt-2 border-t text-xs text-navy-400">
                      <strong>Citations:</strong>
                      <div className="mt-1 space-y-1">
                        {m.content.citations.map((c: any, j: number) => (
                          <div key={j} className="flex items-start gap-1.5">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-azure-50 text-azure-700 uppercase font-medium flex-shrink-0">{c.type}</span>
                            <span className="text-navy-500">
                              {c.title || c.label || c.id || (c.count != null ? `${c.count} records` : '') || ''}
                              {c.evidence_file_id && <span className="text-navy-400"> · evidence #{c.evidence_file_id.slice(0, 8)}{c.page ? ` p.${c.page}` : ''}</span>}
                              {c.hops != null && <span className="text-navy-400"> · {c.hops} hops</span>}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {m.content.follow_ups?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.content.follow_ups.map((f: string, j: number) => (
                        <button key={j} onClick={() => { setQuery(f); askMutation.mutate(f); }}
                          className="text-xs bg-white border rounded px-2 py-1 hover:bg-gray-50">
                          {f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p>{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {askMutation.isPending && (
          <div className="flex justify-start"><div className="bg-gray-100 rounded-lg p-3 text-sm text-navy-400">Thinking...</div></div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input type="text" value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Ask about entities, hypotheses, paths, or missing evidence..."
          className="flex-1 px-4 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-azure-500 outline-none" />
        <button type="submit" disabled={!query.trim() || askMutation.isPending}
          className="bg-azure-500 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-azure-600 disabled:opacity-50">
          Ask
        </button>
      </form>
    </div>
  );
}
