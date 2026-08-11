import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { api, formatDateTime, initials, titleCase } from '../api';
import { Card, EmptyState, ErrorBanner, Loading } from '../components/ui';

export default function AuditLogs() {
  const [entries, setEntries] = useState(null);
  const [actions, setActions] = useState([]);
  const [action, setAction] = useState('all');
  const [actor, setActor] = useState('');
  const [days, setDays] = useState(30);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ action, days: String(days) });
      if (actor) query.set('actor', actor);
      setEntries(await api.get(`/audit-logs?${query}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [action, actor, days]);

  useEffect(() => {
    api.get('/audit-logs/actions').then(setActions).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 250);
    return () => clearTimeout(timer);
  }, [load]);

  if (error && !entries) return <ErrorBanner error={error} onRetry={load} />;
  if (!entries) return <Loading label="Loading audit trail…" />;

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <div className="banner banner-info">
        <ScrollText size={16} />
        <div>
          Generation, viewing, approval, rejection, publication, anomaly triage, rule changes and
          every chat answer are recorded here. The trail is append-only — nothing in the app deletes
          from it.
        </div>
      </div>

      <Card noBody>
        <div className="card-head">
          <div className="row wrap" style={{ gap: 8, flex: 1 }}>
            <div className="row" style={{ gap: 6 }}>
              <Search size={15} className="faint" />
              <input
                className="field"
                style={{ width: 200 }}
                placeholder="Filter by actor…"
                value={actor}
                onChange={(event) => setActor(event.target.value)}
              />
            </div>
            <select className="field" style={{ width: 210 }} value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="all">All actions</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>
            <select className="field" style={{ width: 130 }} value={days} onChange={(event) => setDays(Number(event.target.value))}>
              <option value={7}>Last 7 days</option>
              <option value={30}>Last 30 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          <span className="small muted">{entries.length} entries</span>
        </div>

        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="small nowrap">{formatDateTime(entry.at)}</td>
                  <td>
                    <div className="row">
                      <span className="avatar sm">{initials(entry.actor_email)}</span>
                      <div>
                        <div className="small strong">{entry.actor_email}</div>
                        <div className="muted-cell">{titleCase(entry.actor_role || 'system')}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-indigo">{titleCase(entry.action)}</span>
                  </td>
                  <td className="small mono">
                    {entry.entity_type}
                    <div className="muted-cell mono">{entry.entity_id}</div>
                  </td>
                  <td className="small">
                    {entry.summary}
                    {Object.keys(entry.details || {}).length > 0 && (
                      <details style={{ marginTop: 4 }}>
                        <summary className="small faint" style={{ cursor: 'pointer' }}>
                          Details
                        </summary>
                        <pre className="mono small muted" style={{ whiteSpace: 'pre-wrap', marginTop: 4 }}>
                          {JSON.stringify(entry.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={5}>
                    <EmptyState message="No audit entries match this filter." />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
