import React, { useCallback, useEffect, useState } from 'react';
import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Target, X,
} from 'lucide-react';
import { api, formatCurrency, formatDateTime, relativeTime, titleCase } from '../api';
import {
  BarList, Card, EmptyState, ErrorBanner, KeyValue, Loading, SeverityBadge, StatTile, StatusBadge, Tabs,
} from '../components/ui';
import { SourceList } from '../components/SourceRecords';

const SEVERITY_COLOURS = { high: '#ef4444', medium: '#f59e0b', low: '#3b82f6', info: '#94a3b8' };

export default function Anomalies({ onCountsChanged }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('active');
  const [severity, setSeverity] = useState('all');
  const [domain, setDomain] = useState('all');
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams({ status, severity, domain });
      const [list, summaryData] = await Promise.all([
        api.get(`/anomalies?${query}`),
        api.get('/anomalies/summary'),
      ]);
      setItems(list);
      setSummary(summaryData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [status, severity, domain]);

  useEffect(() => {
    load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    try {
      await api.post('/anomalies/scan');
      await load();
      onCountsChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setScanning(false);
    }
  };

  const openDetail = async (id) => {
    try {
      setSelected(await api.get(`/anomalies/${id}`));
    } catch (err) {
      setError(err.message);
    }
  };

  const changeStatus = async (id, next, note) => {
    try {
      await api.patch(`/anomalies/${id}/status`, { status: next, note });
      await load();
      onCountsChanged?.();
      if (selected?.id === id) openDetail(id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (error && !summary) return <ErrorBanner error={error} onRetry={load} />;
  if (!summary) return <Loading label="Loading anomalies…" />;

  const severityDonut = summary.by_severity.filter((row) => row.count > 0);
  const total = severityDonut.reduce((sum, row) => sum + row.count, 0);

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <div className="grid grid-4">
        <StatTile icon={AlertTriangle} tone="red" value={summary.active} label="Active Anomalies" hint="Needs attention" />
        <StatTile icon={Activity} tone="amber" value={summary.this_month} label="Detected This Month" hint={`${summary.investigating} under investigation`} />
        <StatTile
          icon={Target}
          tone="violet"
          value={`${summary.false_positive_rate}%`}
          label="False-positive Rate"
          hint="Target is under 20% after tuning"
        />
        <StatTile
          icon={ShieldCheck}
          tone="green"
          value={summary.resolved_this_month}
          label="Resolved This Month"
          hint={`Open exposure ${formatCurrency(summary.total_impact, { compact: true })}`}
        />
      </div>

      <div className="split">
        <Card noBody>
          <Tabs
            tabs={[
              { key: 'active', label: 'Active', count: summary.active },
              { key: 'investigating', label: 'Investigating' },
              { key: 'resolved', label: 'Resolved' },
              { key: 'false_positive', label: 'False positives' },
              { key: 'all', label: 'All' },
            ]}
            active={status}
            onChange={setStatus}
          />

          <div className="card-head" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <select className="field" style={{ width: 140 }} value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="all">All severity</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <select className="field" style={{ width: 175 }} value={domain} onChange={(e) => setDomain(e.target.value)}>
                <option value="all">All domains</option>
                <option value="business">Business data</option>
                <option value="software_usage">Software usage</option>
              </select>
            </div>
            <button className="btn btn-sm" onClick={scan} disabled={scanning}>
              <RefreshCw size={14} style={scanning ? { animation: 'spin 1s linear infinite' } : undefined} />
              {scanning ? 'Scanning…' : 'Run scan'}
              <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
            </button>
          </div>

          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Anomaly</th>
                  <th>Module</th>
                  <th>Severity</th>
                  <th>Detected</th>
                  <th>Impact</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((anomaly) => (
                  <tr key={anomaly.id}>
                    <td>
                      <div className="primary-cell">{anomaly.title}</div>
                      <div className="muted-cell">{anomaly.entity_label}</div>
                    </td>
                    <td>
                      <span className="badge badge-indigo">{titleCase(anomaly.module)}</span>
                    </td>
                    <td>
                      <SeverityBadge severity={anomaly.severity} />
                    </td>
                    <td className="small nowrap">{relativeTime(anomaly.detected_at)}</td>
                    <td className="small">
                      {anomaly.financial_impact ? (
                        <>
                          <div className="strong" style={{ color: 'var(--danger)' }}>
                            {formatCurrency(anomaly.financial_impact)}
                          </div>
                          <div className="muted-cell">{anomaly.impact_label}</div>
                        </>
                      ) : (
                        <span className="faint">{anomaly.impact_label || '—'}</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={anomaly.status} />
                      {anomaly.alerted && (
                        <div className="muted-cell" title="Critical items alert immediately">
                          Alerted
                        </div>
                      )}
                    </td>
                    <td className="right">
                      <button className="btn btn-sm" onClick={() => openDetail(anomaly.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
                {!items.length && (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState message="Nothing matches this filter." icon={CheckCircle2} />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="stack">
          <Card title="By Severity" subtitle={`Last scan ${relativeTime(summary.last_scan_at)}`}>
            <div className="row" style={{ gap: 16 }}>
              <div style={{ width: 140, height: 140, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={severityDonut} dataKey="count" innerRadius={42} outerRadius={64} paddingAngle={3}>
                      {severityDonut.map((entry) => (
                        <Cell key={entry.severity} fill={SEVERITY_COLOURS[entry.severity]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend" style={{ flex: 1 }}>
                {severityDonut.map((entry) => (
                  <div className="legend-row" key={entry.severity}>
                    <span className="swatch" style={{ background: SEVERITY_COLOURS[entry.severity] }} />
                    <span className="name">{titleCase(entry.severity)}</span>
                    <span className="value">
                      {entry.count} ({total ? Math.round((entry.count / total) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card title="By Module">
            <BarList rows={summary.by_module.map((row) => ({ label: titleCase(row.module), value: row.count }))} />
          </Card>

          <Card title="Detections Over Time" subtitle="Last 7 days">
            <div style={{ height: 140 }}>
              <ResponsiveContainer>
                <LineChart data={summary.over_time} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={38} allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Most Affected">
            <div className="stack" style={{ gap: 10 }}>
              {summary.top_entities.map((entity) => (
                <div className="row" key={entity.label}>
                  <span className="small" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entity.label}
                  </span>
                  <span className="badge badge-grey">{entity.count}</span>
                  <SeverityBadge severity={entity.severity} />
                </div>
              ))}
              {!summary.top_entities.length && <EmptyState message="Nothing affected." />}
            </div>
          </Card>
        </div>
      </div>

      {selected && (
        <AnomalyDetail anomaly={selected} onClose={() => setSelected(null)} onStatus={changeStatus} />
      )}
    </>
  );
}

function AnomalyDetail({ anomaly, onClose, onStatus }) {
  const [note, setNote] = useState('');

  return (
    <Card
      title={anomaly.title}
      subtitle={`${anomaly.reference} · detected ${formatDateTime(anomaly.detected_at)} · rule ${anomaly.rule_code}`}
      action={
        <div className="row" style={{ gap: 8 }}>
          <SeverityBadge severity={anomaly.severity} />
          <StatusBadge status={anomaly.status} />
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      }
      noBody
    >
      <div className="detail-grid">
        <div className="detail-block">
          <h5>What happened</h5>
          <p>{anomaly.what_happened}</p>
          <h5 style={{ marginTop: 14 }}>Why it matters</h5>
          <p>{anomaly.why_it_matters}</p>
        </div>

        <div className="detail-block">
          <h5>The numbers behind it</h5>
          {Object.entries(anomaly.facts || {}).map(([key, value]) => (
            <KeyValue key={key} label={titleCase(key)} value={String(value ?? '—')} />
          ))}
        </div>

        <div className="detail-block">
          <h5>Impact</h5>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--danger)', letterSpacing: '-0.02em' }}>
            {anomaly.financial_impact ? formatCurrency(anomaly.financial_impact) : '—'}
          </div>
          <p>{anomaly.impact_label}</p>
          <h5 style={{ marginTop: 14 }}>Owner</h5>
          <p>{anomaly.owner_email || 'Unassigned'}</p>
          {anomaly.rule && (
            <>
              <h5 style={{ marginTop: 14 }}>Rule tuning</h5>
              <KeyValue label="Detections" value={anomaly.rule.detections} />
              <KeyValue label="False positives" value={`${anomaly.rule.false_positives} (${anomaly.rule.false_positive_rate}%)`} />
              <KeyValue label="Sensitivity" value={`×${anomaly.rule.sensitivity}`} />
            </>
          )}
        </div>

        <div className="detail-block">
          <h5>Recommended actions</h5>
          <ul style={{ margin: '0 0 0 16px' }}>
            {(anomaly.recommended_actions || []).map((action) => (
              <li key={action} className="small muted" style={{ marginBottom: 4 }}>
                {action}
              </li>
            ))}
          </ul>
          <h5 style={{ marginTop: 14 }}>Source records</h5>
          <SourceList refs={anomaly.source_refs || []} limit={5} />
        </div>
      </div>

      <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
        <input
          className="field"
          placeholder="Resolution note (recorded in the audit log)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          style={{ marginBottom: 10 }}
        />
        <div className="row wrap" style={{ gap: 8 }}>
          <button className="btn btn-sm" onClick={() => onStatus(anomaly.id, 'investigating', note)}>
            Mark investigating
          </button>
          <button className="btn btn-sm btn-success" onClick={() => onStatus(anomaly.id, 'resolved', note)}>
            Resolve
          </button>
          <button className="btn btn-sm" onClick={() => onStatus(anomaly.id, 'ignored', note)}>
            Ignore
          </button>
          <button
            className="btn btn-sm btn-danger"
            onClick={() => onStatus(anomaly.id, 'false_positive', note)}
            title="Suppresses this finding and tightens the rule that raised it"
          >
            False positive
          </button>
        </div>
      </div>
    </Card>
  );
}
