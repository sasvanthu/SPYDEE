import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import { api } from '../lib/api';
import { Terminal, Send, Sparkles, AlertTriangle, ArrowRight, CornerDownLeft, Shield } from 'lucide-react';
import { TerminalPanel } from '../components/common/TerminalPanel';
import { useTerminalAlert } from '../context/TerminalAlertContext';

export default function Copilot() {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { showAlert } = useTerminalAlert();
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: history } = useQuery({
    queryKey: ['copilot', caseId],
    queryFn: () => api.getCopilotHistory(caseId!),
    enabled: !!caseId,
  });

  const askMutation = useMutation({
    mutationFn: (q: string) => api.askCopilot(caseId!, q),
    onSuccess: (data, q) => {
      setMessages((prev) => [
        ...prev,
        { role: 'user', content: q, timestamp: new Date().toLocaleTimeString() },
        { role: 'assistant', content: data, timestamp: new Date().toLocaleTimeString() },
      ]);
    },
    onError: (err: any) => {
      showAlert(err?.response?.data?.detail || err?.message || 'Inference engine timeout', 'CRITICAL');
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, askMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || askMutation.isPending) return;
    const currentQ = query;
    setQuery('');
    askMutation.mutate(currentQ);
  };

  const handleSuggestedPrompt = (promptText: string) => {
    setQuery('');
    askMutation.mutate(promptText);
  };

  const examples = [
    'What are the strongest leads and corroborated paths?',
    'Who are the top high-frequency actors in intercepted communications?',
    'Explain Alias-01 and associated financial transaction vectors',
    'What critical evidence contradicts current primary hypotheses?',
    'Identify intelligence gaps with zero corroborating subpoena records',
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] font-mono text-xs text-[#f59e0b] space-y-2">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-amber-500/40 gap-2 shrink-0">
        <div>
          <div className="text-[11px] text-amber-500/70 font-bold tracking-widest uppercase">
            // CASE CONSOLE // INVESTIGATOR COPILOT
          </div>
          <div className="text-base md:text-lg font-black text-amber-300 tracking-wider">
            NATURAL LANGUAGE FORENSIC QUERY ENGINE
          </div>
          <div className="text-[10px] text-amber-500/80">
            EVIDENTIARY CITATIONS // MULTI-HOP GRAPH QUERIES // DISCREPANCY AUDITS
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-[10px] text-amber-400 bg-black/80 px-3 py-1.5 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>LOCAL REASONING ENGINE ONLINE</span>
          </div>
        </div>
      </div>

      {/* TERMINAL CHAT WINDOW */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto bg-[#080c08] border border-amber-500/35 p-4 space-y-4 rounded-xs relative"
      >
        {/* CRT Background Grid Texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #f59e0b 1px, transparent 1px), linear-gradient(to bottom, #f59e0b 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SYSTEM BANNER */}
        <div className="p-3 bg-[#0a0f0a] border border-amber-500/30 text-amber-400/90 text-xs space-y-1">
          <div className="flex items-center gap-2 text-amber-300 font-bold">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>SPYDEE INTELLIGENCE COPILOT v2.4 (TERMINAL RUNTIME)</span>
          </div>
          <p className="text-[11px] text-amber-500/80 leading-relaxed">
            Ingested case files, graph relationships, and CDR streams loaded. Ask natural language questions regarding suspects, cell towers, call volumes, and physical contradictions.
          </p>
        </div>

        {/* Prior sessions */}
        {messages.length === 0 && history && history.length > 0 && (
          <div className="border border-amber-500/30 bg-[#0a0f0a] p-3 rounded-xs space-y-2">
            <div className="text-[10px] text-amber-500/70 uppercase tracking-wider flex items-center justify-between">
              <span>PRIOR INTERROGATION LOGS (RECENT QUERIES)</span>
              <span className="text-amber-500/50">{history.length} SAVED SESSIONS</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {history.slice(0, 4).map((m: any) => (
                <div
                  key={m.id}
                  onClick={() => handleSuggestedPrompt(m.query)}
                  className="bg-black/60 hover:bg-amber-950/20 border border-amber-500/30 hover:border-amber-400 p-2 cursor-pointer transition-colors text-xs space-y-1 group"
                >
                  <div className="text-amber-300 font-bold truncate group-hover:text-amber-200">
                    &gt; {m.query}
                  </div>
                  <div className="text-[10px] text-amber-500/70 line-clamp-2">
                    {m.response?.substring(0, 100)}...
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Suggestions */}
        {messages.length === 0 && (
          <div className="text-center py-6 space-y-3">
            <div className="text-[10px] text-amber-500/70 uppercase tracking-widest">
              PRE-COMPILED RECONNAISSANCE QUERIES
            </div>
            <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto">
              {examples.map((ex) => (
                <button
                  key={ex}
                  onClick={() => handleSuggestedPrompt(ex)}
                  className="text-xs bg-black/80 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:border-amber-400 px-3 py-1.5 transition-colors text-left font-mono"
                >
                  &gt; {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message Feed */}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} space-y-1`}
          >
            <div className="flex items-center gap-2 text-[10px] text-amber-500/70 uppercase">
              <span>{m.role === 'user' ? 'OPERATOR // DISPATCH' : 'ORACLE // SYNTHESIS'}</span>
              {m.timestamp && <span>· {m.timestamp}</span>}
            </div>

            <div
              className={`max-w-[85%] p-3.5 text-xs border ${
                m.role === 'user'
                  ? 'bg-amber-950/30 border-amber-500 text-amber-200'
                  : 'bg-[#0b100b] border-amber-500/40 text-amber-300 space-y-2 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              }`}
            >
              {m.role === 'assistant' ? (
                <div>
                  <p className="whitespace-pre-wrap leading-relaxed font-mono text-xs text-amber-200">
                    {m.content.answer || m.content}
                  </p>

                  {/* Deep Navigation Jump Links */}
                  {m.content.links?.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-amber-500/25 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-amber-500/70 self-center mr-1">
                        JUMP TO:
                      </span>
                      {m.content.links.map((l: any, j: number) => {
                        if (l.type === 'contradiction')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/contradictions`)}
                              className="text-[10px] bg-red-950/60 text-red-300 border border-red-500/50 px-2 py-0.5 hover:bg-red-900/60 font-bold"
                            >
                              [ CONTRADICTION #{l.id ? l.id.slice(0, 6) : 'LINK'} ]
                            </button>
                          );
                        if (l.type === 'lead')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/leads`)}
                              className="text-[10px] bg-amber-950/60 text-amber-300 border border-amber-500/50 px-2 py-0.5 hover:bg-amber-900/60 font-bold"
                            >
                              [ LEAD RECORD ]
                            </button>
                          );
                        if (l.type === 'information_gap')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/leads`)}
                              className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 px-2 py-0.5 hover:bg-emerald-900/60 font-bold"
                            >
                              [ INTEL GAP ]
                            </button>
                          );
                        if (l.type === 'entity')
                          return (
                            <button
                              key={j}
                              onClick={() => navigate(`/cases/${caseId}/entities`)}
                              className="text-[10px] bg-black border border-amber-500/40 text-amber-300 px-2 py-0.5 hover:border-amber-400 font-bold"
                            >
                              [ ENTITY DOSSIER ]
                            </button>
                          );
                        return null;
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="font-mono text-xs">{m.content}</div>
              )}
            </div>
          </div>
        ))}

        {askMutation.isPending && (
          <div className="flex items-center gap-2 p-3 bg-black/60 border border-amber-500/30 text-amber-400 text-xs">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>[ TRAVERSING KNOWLEDGE GRAPH & SYNTHESIZING RESPONSE... ]</span>
          </div>
        )}
      </div>

      {/* INPUT COMMAND BAR */}
      <form onSubmit={handleSubmit} className="flex gap-2 shrink-0">
        <div className="flex-1 flex items-center bg-[#080c08] border border-amber-500/40 px-3 py-2 text-xs">
          <span className="text-amber-500 font-bold mr-2 select-none">COPILOT-PROMPT &gt;</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Interrogate case corpus, suspect links, CDR anomaly patterns..."
            disabled={askMutation.isPending}
            className="flex-1 bg-transparent text-amber-200 placeholder-amber-500/40 outline-none font-mono text-xs"
          />
        </div>

        <button
          type="submit"
          disabled={!query.trim() || askMutation.isPending}
          className="px-4 py-2 bg-amber-500 text-black font-bold hover:bg-amber-400 disabled:opacity-40 transition-colors flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.4)] text-xs"
        >
          <Send className="w-3.5 h-3.5" />
          <span>[ TRANSMIT ]</span>
        </button>
      </form>
    </div>
  );
}
