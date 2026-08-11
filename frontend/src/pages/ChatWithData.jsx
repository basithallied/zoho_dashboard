import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Bot, Download, Info, Loader2, Plus, Send, ShieldAlert, Trash2,
} from 'lucide-react';
import { api, formatNumber, relativeTime } from '../api';
import { Card, EmptyState, ErrorBanner } from '../components/ui';
import { SourceList } from '../components/SourceRecords';

const CONFIDENCE_TONE = { high: 'green', medium: 'amber', low: 'red' };

function compactTick(value) {
  const number = Number(value);
  if (Math.abs(number) >= 1e6) return `${(number / 1e6).toFixed(1)}M`;
  if (Math.abs(number) >= 1e3) return `${(number / 1e3).toFixed(0)}K`;
  return number;
}

export default function ChatWithData() {
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const threadRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      setConversations(await api.get('/chat/conversations'));
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    api.get('/chat/suggestions').then((data) => setPrompts(data.prompts)).catch(() => {});
  }, [loadConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    api
      .get(`/chat/conversations/${activeId}`)
      .then((data) => setMessages(data.messages))
      .catch((err) => setError(err.message));
  }, [activeId]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  const ask = async (question) => {
    const text = (question ?? input).trim();
    if (!text || thinking) return;
    setInput('');
    setThinking(true);
    setMessages((current) => [...current, { id: `local-${Date.now()}`, role: 'user', text }]);
    try {
      const response = await api.post('/chat/ask', { message: text, conversation_id: activeId });
      setActiveId(response.conversation_id);
      const conversation = await api.get(`/chat/conversations/${response.conversation_id}`);
      setMessages(conversation.messages);
      loadConversations();
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setThinking(false);
    }
  };

  const removeConversation = async (id) => {
    await api.del(`/chat/conversations/${id}`);
    if (id === activeId) setActiveId(null);
    loadConversations();
  };

  return (
    <div className="chat-layout">
      <Card
        title="Conversations"
        action={
          <button className="btn btn-sm btn-primary" onClick={() => setActiveId(null)}>
            <Plus size={14} /> New
          </button>
        }
      >
        <div className="stack" style={{ gap: 4 }}>
          {conversations.map((conversation) => (
            <div key={conversation.id} className="row" style={{ gap: 4 }}>
              <button
                className={`conversation-item ${activeId === conversation.id ? 'active' : ''}`}
                onClick={() => setActiveId(conversation.id)}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{conversation.title}</div>
                <div className="when">{relativeTime(conversation.updated_at)}</div>
              </button>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => removeConversation(conversation.id)}
                aria-label="Delete conversation"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!conversations.length && <EmptyState message="No saved conversations yet." />}
        </div>
      </Card>

      <section className="card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
        <div className="card-head">
          <div>
            <h3>Ask about your data</h3>
            <div className="sub">Answers come from defined metrics, with the source records attached.</div>
          </div>
        </div>

        <div className="chat-thread" ref={threadRef}>
          {!messages.length && !thinking && (
            <div className="stack" style={{ gap: 12, margin: 'auto 0' }}>
              <EmptyState message="Ask a question in plain language — the agent resolves the metric, period and breakdown." icon={Bot} />
              <div className="row wrap" style={{ justifyContent: 'center' }}>
                {prompts.map((prompt) => (
                  <button key={prompt} className="chip" onClick={() => ask(prompt)}>
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) =>
            message.role === 'user' ? (
              <div className="bubble-user" key={message.id}>
                {message.text}
              </div>
            ) : (
              <AgentMessage key={message.id} message={message} onAsk={ask} />
            ),
          )}

          {thinking && (
            <div className="bubble-agent">
              <span className="avatar sm">
                <Bot size={13} />
              </span>
              <div className="text row" style={{ gap: 8 }}>
                <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} />
                Resolving the metric and querying source records…
                <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
              </div>
            </div>
          )}
        </div>

        <div className="chat-composer">
          <ErrorBanner error={error} />
          <form
            className="row"
            style={{ gap: 10, marginTop: error ? 10 : 0 }}
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <input
              className="field"
              placeholder="Ask anything about your data…"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <button className="btn btn-primary" type="submit" disabled={thinking || !input.trim()}>
              <Send size={16} />
            </button>
          </form>
          <div className="small faint" style={{ marginTop: 8 }}>
            The agent answers from the same metric definitions the scheduled reports use, so a figure
            here and a figure in a report cannot disagree.
          </div>
        </div>
      </section>
    </div>
  );
}

function AgentMessage({ message, onAsk }) {
  const answer = message.payload || {};
  const chart = answer.chart;
  const table = answer.table;

  return (
    <div className="bubble-agent">
      <span className="avatar sm">
        <Bot size={13} />
      </span>
      <div className="body">
        <div className="text">{message.text}</div>

        {answer.permission_denied && (
          <div className="banner banner-danger">
            <ShieldAlert size={16} />
            <div>Blocked by your role's data scope. Nothing was returned from the restricted module.</div>
          </div>
        )}

        {answer.needs_clarification && answer.suggestions?.length > 0 && (
          <div className="row wrap">
            {answer.suggestions.slice(0, 6).map((suggestion) => (
              <button
                key={suggestion.key}
                className="chip"
                onClick={() => onAsk(`${suggestion.label} this month`)}
                title={suggestion.description}
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        {answer.kpis?.length > 0 && (
          <div className="answer-grid">
            {answer.kpis.map((kpi) => (
              <div className="answer-kpi" key={kpi.key}>
                <div className="label">{kpi.label}</div>
                <div className="value">{kpi.formatted}</div>
                <div className="small faint" style={{ marginTop: 3 }}>
                  {kpi.period}
                  {kpi.change_pct !== undefined && (
                    <span className={`badge badge-${kpi.favourable ? 'green' : 'red'}`} style={{ marginLeft: 6 }}>
                      {kpi.change_pct > 0 ? '+' : ''}
                      {kpi.change_pct}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {chart?.series?.length > 0 && (
          <div className="card" style={{ padding: 14 }}>
            <div className="small strong" style={{ marginBottom: 8 }}>{chart.title}</div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer>
                {chart.type === 'line' ? (
                  <LineChart data={chart.series} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      width={58}
                      tickFormatter={compactTick}
                    />
                    <Tooltip formatter={(value) => formatNumber(value)} />
                    <Line type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} dot={false} />
                  </LineChart>
                ) : (
                  <BarChart data={chart.series} margin={{ top: 5, right: 10, left: -14, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                      width={58}
                      tickFormatter={compactTick}
                    />
                    <Tooltip formatter={(value) => formatNumber(value)} />
                    <Bar dataKey="value" fill="#4f46e5" radius={[5, 5, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {table?.rows?.length > 0 && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-head">
              <h3 style={{ fontSize: 13 }}>Summary</h3>
              {String(message.id).startsWith('local-') ? null : (
                <a className="btn btn-sm" href={api.exportUrl(`/chat/messages/${message.id}/export.csv`)}>
                  <Download size={13} /> Export
                </a>
              )}
            </div>
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    {table.columns.map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((row, index) => (
                    <tr key={index}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="row wrap" style={{ gap: 8 }}>
          {answer.confidence && (
            <span className={`badge badge-${CONFIDENCE_TONE[answer.confidence] || 'grey'}`}>
              Confidence: {answer.confidence}
            </span>
          )}
          {answer.query_description && (
            <span className="small faint mono" title="How the figure was computed">
              {answer.query_description}
            </span>
          )}
        </div>

        {answer.sources?.length > 0 && (
          <div>
            <div className="small strong" style={{ marginBottom: 6 }}>
              Source records ({answer.sources.length})
            </div>
            <SourceList refs={answer.sources} limit={8} />
          </div>
        )}

        {answer.limits?.length > 0 && (
          <div className="banner banner-amber">
            <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              {answer.limits.map((limit) => (
                <div key={limit} className="small">{limit}</div>
              ))}
            </div>
          </div>
        )}

        {!answer.needs_clarification && answer.suggestions?.length > 0 && (
          <div className="row wrap">
            {answer.suggestions.map((suggestion) => (
              <button key={suggestion.question} className="chip" onClick={() => onAsk(suggestion.question)}>
                {suggestion.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
