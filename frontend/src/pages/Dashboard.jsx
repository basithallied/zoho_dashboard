import React, { useCallback, useEffect, useState } from 'react';
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, Area, AreaChart,
} from 'recharts';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Database, FileText, Send, Sparkles,
  TrendingDown, TrendingUp,
} from 'lucide-react';
import { api, formatDateTime, formatNumber, relativeTime, titleCase } from '../api';
import { Card, EmptyState, ErrorBanner, Loading, SeverityBadge, StatTile, StatusBadge, Tabs } from '../components/ui';
import { SourceList } from '../components/SourceRecords';

const DONUT_COLOURS = ['#4f46e5', '#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard({ onCountsChanged, onNavigate }) {
  const [data, setData] = useState(null);
  const [trend, setTrend] = useState(null);
  const [error, setError] = useState(null);
  const [cadence, setCadence] = useState('all');
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [dashboard, trendData] = await Promise.all([
        api.get('/dashboard'),
        api.get('/dashboard/trend?metric_key=revenue_invoiced&period_name=this year'),
      ]);
      setData(dashboard);
      setTrend(trendData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (runId, action) => {
    setBusy(runId);
    try {
      if (action === 'approve') {
        // Opening the run is what records the review; the API refuses to
        // approve anything the reviewer has not opened.
        await api.get(`/reports/runs/${runId}`);
        await api.post(`/approvals/runs/${runId}/approve`);
      } else {
        await api.post(`/approvals/runs/${runId}/reject`, {
          reason: 'Rejected from the dashboard queue — figures need review before release.',
        });
      }
      await load();
      onCountsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !data) return <ErrorBanner error={error} onRetry={load} />;
  if (!data) return <Loading label="Loading dashboard…" />;

  const { cards, upcoming_runs: upcoming, pending_approvals: pending, recent_anomalies: anomalies } = data;
  const present = new Set(upcoming.map((run) => run.cadence));
  const cadences = ['all', ...['daily', 'weekly', 'monthly', 'quarterly'].filter((key) => present.has(key))];
  const visibleRuns = cadence === 'all' ? upcoming : upcoming.filter((run) => run.cadence === cadence);
  const sentByModule = data.reports_sent_by_module.map((row) => ({
    name: titleCase(row.module),
    value: row.count,
  }));

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <div className="grid grid-4">
        <StatTile icon={FileText} tone="indigo" value={cards.reports_scheduled} label="Reports Scheduled" hint="Across all cadences" />
        <StatTile icon={Send} tone="blue" value={cards.reports_sent_today} label="Reports Sent Today" hint="Published to recipients" />
        <StatTile icon={CheckCircle2} tone="green" value={cards.pending_approvals} label="Pending Approvals" hint="Awaiting team review" />
        <StatTile icon={AlertTriangle} tone="red" value={cards.anomalies_detected} label="Anomalies Detected" hint="Needs attention" />
      </div>

      <div className="split">
        <div className="stack">
          <Card
            title="Reports & Schedules"
            noBody
            action={
              <button className="link-button" onClick={() => onNavigate('reports')}>
                View all <ArrowRight size={14} />
              </button>
            }
          >
            <Tabs
              tabs={cadences.map((key) => ({ key, label: titleCase(key) }))}
              active={cadence}
              onChange={setCadence}
            />
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Report name</th>
                    <th>Cadence</th>
                    <th>Next run</th>
                    <th>Recipients</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRuns.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <div className="primary-cell">{run.name}</div>
                        <div className="muted-cell">Team: {run.team || 'Unassigned'}</div>
                      </td>
                      <td>
                        <span className="badge badge-grey">{titleCase(run.cadence)}</span>
                      </td>
                      <td className="nowrap">{formatDateTime(run.next_run_at)}</td>
                      <td>{run.recipients}</td>
                      <td>
                        <StatusBadge status={run.status} />
                      </td>
                    </tr>
                  ))}
                  {!visibleRuns.length && (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState message="No scheduled reports for this cadence." />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid grid-2">
            <Card title="Reports Sent Overview" subtitle="Published today, by module">
              {sentByModule.length ? (
                <div className="row" style={{ gap: 18 }}>
                  <div style={{ width: 160, height: 160 }}>
                    <ResponsiveContainer>
                      <PieChart>
                        <Pie data={sentByModule} dataKey="value" innerRadius={48} outerRadius={72} paddingAngle={3}>
                          {sentByModule.map((entry, index) => (
                            <Cell key={entry.name} fill={DONUT_COLOURS[index % DONUT_COLOURS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="legend" style={{ flex: 1 }}>
                    {sentByModule.map((entry, index) => (
                      <div className="legend-row" key={entry.name}>
                        <span className="swatch" style={{ background: DONUT_COLOURS[index % DONUT_COLOURS.length] }} />
                        <span className="name">{entry.name}</span>
                        <span className="value">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState message="Nothing published yet today." />
              )}
            </Card>

            <Card
              title="Anomalies Detected"
              action={
                <button className="link-button" onClick={() => onNavigate('anomalies')}>
                  View all <ArrowRight size={14} />
                </button>
              }
            >
              <div className="stack" style={{ gap: 12 }}>
                {anomalies.map((anomaly) => (
                  <div key={anomaly.id} className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
                    <span
                      className="tile-icon"
                      style={{ width: 30, height: 30, background: 'var(--danger-soft)', color: 'var(--danger)' }}
                    >
                      <AlertTriangle size={14} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="row" style={{ gap: 8 }}>
                        <span className="strong small">{anomaly.title}</span>
                        <SeverityBadge severity={anomaly.severity} />
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {anomaly.entity_label} · {relativeTime(anomaly.detected_at)}
                      </div>
                    </div>
                  </div>
                ))}
                {!anomalies.length && <EmptyState message="No open anomalies." icon={CheckCircle2} />}
              </div>
            </Card>
          </div>

          <Card title="Revenue Invoiced" subtitle={`Source-backed trend · ${trend?.period || ''}`}>
            <div style={{ height: 210 }}>
              <ResponsiveContainer>
                <AreaChart data={trend?.points || []} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={70}
                    tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(value) => `SAR ${Number(value).toLocaleString()}`} />
                  <Area type="monotone" dataKey="value" stroke="#4f46e5" strokeWidth={2} fill="url(#revenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card
            title="Pending Approvals"
            subtitle="Only approved reports reach management"
            action={
              <button className="link-button" onClick={() => onNavigate('approvals')}>
                View all
              </button>
            }
          >
            <div className="stack" style={{ gap: 14 }}>
              {pending.map((item) => (
                <div key={item.approval_id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="strong small">{item.report}</span>
                    {item.escalated && <span className="badge badge-red">Escalated</span>}
                  </div>
                  <div className="small muted" style={{ margin: '3px 0 9px' }}>
                    {item.period} · {item.team} · requested {relativeTime(item.requested_at)}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn btn-sm btn-success"
                      disabled={busy === item.run_id}
                      onClick={() => decide(item.run_id, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      disabled={busy === item.run_id}
                      onClick={() => decide(item.run_id, 'reject')}
                    >
                      Reject
                    </button>
                    {!item.opened && <span className="small faint">Not opened yet</span>}
                  </div>
                </div>
              ))}
              {!pending.length && <EmptyState message="Nothing waiting on a decision." icon={CheckCircle2} />}
            </div>
          </Card>

          <Card title="Key Figures" subtitle="Every number opens its source records">
            <div className="stack" style={{ gap: 14 }}>
              {data.headline_metrics.map((metric) => (
                <div key={metric.key}>
                  <div className="row">
                    <span className="small muted">{metric.label}</span>
                    <span className="spacer" />
                    {metric.change_pct !== null && metric.change_pct !== undefined && (
                      <span className={`badge badge-${metric.change_pct >= 0 === metric.higher_is_better ? 'green' : 'red'}`}>
                        {metric.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(metric.change_pct).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="strong" style={{ fontSize: 19, letterSpacing: '-0.02em' }}>{metric.formatted}</div>
                  <div className="small faint" style={{ margin: '3px 0 6px' }}>
                    {metric.period} · {formatNumber(metric.record_count)} source records
                  </div>
                  <SourceList refs={metric.source_refs} limit={3} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Data Source Connectivity" action={<Database size={15} className="faint" />}>
            <div className="stack" style={{ gap: 11 }}>
              {data.data_sources.map((source) => (
                <div className="row" key={source.id}>
                  <div>
                    <div className="small strong">
                      {source.name} <span className="faint">({source.vendor})</span>
                    </div>
                    <div className="small faint">Last sync {relativeTime(source.last_sync_at)}</div>
                  </div>
                  <span className="spacer" />
                  <StatusBadge status={source.status} />
                </div>
              ))}
            </div>
          </Card>

          <Card title="Ask the agent" action={<Sparkles size={15} style={{ color: 'var(--primary)' }} />}>
            <p className="small muted" style={{ marginBottom: 10 }}>
              Ask a question in plain language and get the answer with charts and the records behind it.
            </p>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onNavigate('chat')}>
              Open Chat with Data
            </button>
          </Card>
        </div>
      </div>
    </>
  );
}
