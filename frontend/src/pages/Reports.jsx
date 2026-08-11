import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CheckCircle2, Clock, FileText, Play, Search, Send, Settings2, XCircle,
} from 'lucide-react';
import { api, formatDateTime, relativeTime, titleCase } from '../api';
import {
  BarList, Card, EmptyState, ErrorBanner, KeyValue, Loading, StatTile, StatusBadge, Tabs,
} from '../components/ui';
import ReportRunView from '../components/ReportRunView';

const DONUT_COLOURS = ['#4f46e5', '#7c3aed', '#f59e0b', '#10b981', '#ef4444'];

export default function Reports({ user, onCountsChanged }) {
  const [schedules, setSchedules] = useState([]);
  const [overview, setOverview] = useState(null);
  const [runs, setRuns] = useState([]);
  const [cadence, setCadence] = useState('all');
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [openRunId, setOpenRunId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      const [scheduleData, overviewData, runData] = await Promise.all([
        api.get('/reports/schedules'),
        api.get('/reports/schedules/overview'),
        api.get('/reports/runs?limit=100'),
      ]);
      setSchedules(scheduleData);
      setOverview(overviewData);
      setRuns(runData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const runNow = async (templateId) => {
    setBusy(templateId);
    try {
      const run = await api.post(`/reports/schedules/${templateId}/run`);
      await load();
      onCountsChanged?.();
      setOpenRunId(run.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  const visible = useMemo(
    () =>
      schedules.filter(
        (schedule) =>
          (cadence === 'all' || schedule.cadence === cadence) &&
          (!search || schedule.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [schedules, cadence, search],
  );

  if (openRunId) {
    return (
      <ReportRunView
        runId={openRunId}
        onBack={() => {
          setOpenRunId(null);
          load();
        }}
        onChanged={onCountsChanged}
        canDecide={user?.permissions?.includes('approve')}
        canPublish={user?.permissions?.includes('publish')}
      />
    );
  }

  if (error && !overview) return <ErrorBanner error={error} onRetry={load} />;
  if (!overview) return <Loading label="Loading schedules…" />;

  const cadenceTabs = [
    { key: 'all', label: 'All Schedules' },
    ...['daily', 'weekly', 'monthly', 'quarterly'].map((key) => ({ key, label: titleCase(key) })),
  ];
  const donut = overview.by_cadence.map((row) => ({ name: titleCase(row.cadence), value: row.count }));

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <div className="grid grid-4">
        <StatTile icon={FileText} tone="indigo" value={overview.scheduled} label="Reports Scheduled" hint="Across all cadences" />
        <StatTile icon={CheckCircle2} tone="green" value={overview.active} label="Active Schedules" hint="Running as planned" />
        <StatTile icon={Send} tone="blue" value={overview.sent_today} label="Reports Sent Today" hint="Across all teams" />
        <StatTile
          icon={overview.failed_or_skipped ? XCircle : Clock}
          tone={overview.failed_or_skipped ? 'red' : 'amber'}
          value={`${overview.on_time_delivery_pct}%`}
          label="On-time Delivery"
          hint={`${overview.failed_or_skipped} failed or skipped this month`}
        />
      </div>

      <div className="split">
        <Card noBody>
          <Tabs tabs={cadenceTabs} active={cadence} onChange={setCadence} />
          <div className="card-head" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row" style={{ flex: 1, gap: 8 }}>
              <Search size={15} className="faint" />
              <input
                className="field"
                style={{ maxWidth: 260 }}
                placeholder="Search reports…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>

          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Report name</th>
                  <th>Frequency</th>
                  <th>Next run</th>
                  <th>Recipients</th>
                  <th>Last run</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((schedule) => (
                  <React.Fragment key={schedule.id}>
                    <tr>
                      <td>
                        <div className="primary-cell">{schedule.name}</div>
                        <div className="muted-cell">Team: {schedule.owner_team?.name || 'Unassigned'}</div>
                      </td>
                      <td>
                        <span className="badge badge-grey">{titleCase(schedule.cadence)}</span>
                      </td>
                      <td className="nowrap small">{formatDateTime(schedule.next_run_at)}</td>
                      <td>{schedule.recipients.length}</td>
                      <td className="small nowrap">
                        {schedule.last_run ? (
                          <>
                            <div>{formatDateTime(schedule.last_run.generated_at)}</div>
                            <div className="muted-cell">{schedule.last_run.period_label}</div>
                          </>
                        ) : (
                          <span className="faint">Never</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={schedule.last_run?.status || (schedule.is_active ? 'scheduled' : 'paused')} />
                      </td>
                      <td className="right nowrap">
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy === schedule.id}
                          onClick={() => runNow(schedule.id)}
                          title="Generate now"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setExpanded(expanded === schedule.id ? null : schedule.id)}
                          title="Template configuration"
                        >
                          <Settings2 size={14} />
                        </button>
                        {schedule.last_run && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setOpenRunId(schedule.last_run.id)}>
                            Open
                          </button>
                        )}
                      </td>
                    </tr>
                    {expanded === schedule.id && (
                      <tr>
                        <td colSpan={7} style={{ background: 'var(--surface-muted)' }}>
                          <TemplateConfig schedule={schedule} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
                {!visible.length && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState message="No schedules match this filter." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="Schedule Overview" subtitle="Templates by cadence">
            <div className="row" style={{ gap: 16 }}>
              <div style={{ width: 150, height: 150 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={donut} dataKey="value" innerRadius={44} outerRadius={68} paddingAngle={3}>
                      {donut.map((entry, index) => (
                        <Cell key={entry.name} fill={DONUT_COLOURS[index % DONUT_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend" style={{ flex: 1 }}>
                {donut.map((entry, index) => (
                  <div className="legend-row" key={entry.name}>
                    <span className="swatch" style={{ background: DONUT_COLOURS[index % DONUT_COLOURS.length] }} />
                    <span className="name">{entry.name}</span>
                    <span className="value">{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="Upcoming Runs">
            <div className="stack" style={{ gap: 11 }}>
              {overview.upcoming.map((item) => (
                <div className="row" key={item.id}>
                  <div style={{ minWidth: 0 }}>
                    <div className="small strong">{item.name}</div>
                    <div className="small faint">{titleCase(item.cadence)} · {item.team}</div>
                  </div>
                  <span className="spacer" />
                  <span className="small nowrap">{formatDateTime(item.next_run_at)}</span>
                </div>
              ))}
              {!overview.upcoming.length && <EmptyState message="No upcoming runs." />}
            </div>
          </Card>

          <Card title="Delivery & Performance" subtitle="This month">
            <div className="grid grid-2" style={{ gap: 12 }}>
              <KeyValue label="Delivered" value={overview.delivered_this_month} />
              <KeyValue label="Failed / skipped" value={overview.failed_or_skipped} />
              <KeyValue label="On-time" value={`${overview.on_time_delivery_pct}%`} />
              <KeyValue label="Avg generation" value={`${overview.avg_generation_seconds}s`} />
            </div>
          </Card>

          <Card title="Report Distribution by Team">
            <BarList rows={overview.by_team.map((row) => ({ label: row.team, value: row.count }))} />
          </Card>
        </div>
      </div>

      <Card title="Recent runs" subtitle="Every generated instance and where it got to" noBody>
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Report</th>
                <th>Period</th>
                <th>Generated</th>
                <th>Status</th>
                <th>Delivery</th>
                <th>Sources</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 15).map((run) => (
                <tr key={run.id}>
                  <td className="primary-cell">{run.template_name}</td>
                  <td className="small">{run.period_label}</td>
                  <td className="small nowrap">{relativeTime(run.generated_at)}</td>
                  <td>
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="small">{titleCase(run.delivery_status)}</td>
                  <td className="small">{run.source_record_count}</td>
                  <td className="right">
                    <button className="btn btn-sm" onClick={() => setOpenRunId(run.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function TemplateConfig({ schedule }) {
  return (
    <div style={{ padding: '14px 4px' }}>
      <p className="small muted" style={{ marginBottom: 10 }}>
        {schedule.description} — sections, metrics, comparison periods and thresholds are
        configuration, so a template change needs no code release.
      </p>
      <div className="grid grid-2" style={{ gap: 14 }}>
        <div>
          <h5 className="small strong" style={{ marginBottom: 6 }}>Sections</h5>
          {schedule.sections.map((section) => (
            <div key={section.key} className="small muted" style={{ marginBottom: 4 }}>
              <span className="strong" style={{ color: 'var(--text)' }}>{section.title}</span>{' '}
              — {section.metrics.join(', ')}{' '}
              <span className="faint">({section.comparison || schedule.default_comparison})</span>
            </div>
          ))}
        </div>
        <div>
          <h5 className="small strong" style={{ marginBottom: 6 }}>Routing</h5>
          <KeyValue label="Owner" value={schedule.owner_team?.name || '—'} />
          <KeyValue label="Reviewer" value={schedule.reviewer_team?.name || '—'} />
          <KeyValue label="Escalation" value={`${schedule.escalation_team?.name || '—'} after ${schedule.escalation_after_hours}h`} />
          <KeyValue label="Recipients" value={schedule.recipients.join(', ') || '—'} />
          <KeyValue
            label="Thresholds"
            value={
              Object.keys(schedule.thresholds).length
                ? Object.entries(schedule.thresholds).map(([key, value]) => `${key}: ${value}`).join(', ')
                : 'None'
            }
          />
        </div>
      </div>
    </div>
  );
}
