import React, { useCallback, useEffect, useState } from 'react';
import { CalendarClock, SlidersHorizontal } from 'lucide-react';
import { api, titleCase } from '../api';
import { Card, ErrorBanner, KeyValue, Loading, SeverityBadge, Tabs } from '../components/ui';

const CADENCE_RULES = [
  ['Daily', 'T+1 at 07:00', 'Covers the previous day.'],
  ['Weekly', 'Monday', 'Covers the previous Monday–Sunday week.'],
  ['Monthly', '3rd working day', 'Covers the previous calendar month.'],
  ['Quarterly', '5th working day', 'Covers the previous quarter.'],
];

export default function Settings({ user }) {
  const [tab, setTab] = useState('rules');
  const [rules, setRules] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [error, setError] = useState(null);
  const [savingCode, setSavingCode] = useState(null);

  const load = useCallback(async () => {
    try {
      const [ruleData, metricData] = await Promise.all([
        api.get('/anomalies/rules/list'),
        api.get('/reports/metrics'),
      ]);
      setRules(ruleData);
      setMetrics(metricData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleRule = async (rule) => {
    setSavingCode(rule.code);
    try {
      await api.patch(`/anomalies/rules/${rule.code}`, { enabled: !rule.enabled });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCode(null);
    }
  };

  const updateParam = async (rule, key, value) => {
    setSavingCode(rule.code);
    try {
      await api.patch(`/anomalies/rules/${rule.code}`, {
        params: { ...rule.params, [key]: Number.isNaN(Number(value)) ? value : Number(value) },
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingCode(null);
    }
  };

  if (error && !rules) return <ErrorBanner error={error} onRetry={load} />;
  if (!rules) return <Loading label="Loading configuration…" />;

  const canTune = user?.permissions?.includes('tune_rules');

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <Card noBody>
        <Tabs
          tabs={[
            { key: 'rules', label: 'Detection rules' },
            { key: 'calendar', label: 'Reporting calendar' },
            { key: 'metrics', label: 'Metric registry' },
          ]}
          active={tab}
          onChange={setTab}
        />

        {tab === 'rules' && (
          <>
            {!canTune && (
              <div className="card-body">
                <div className="banner banner-info">
                  <SlidersHorizontal size={16} />
                  <div>Your role can view rules but not change them.</div>
                </div>
              </div>
            )}
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Rule</th>
                    <th>Domain</th>
                    <th>Severity</th>
                    <th>Thresholds</th>
                    <th>Detections</th>
                    <th>False positives</th>
                    <th>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr key={rule.code}>
                      <td>
                        <div className="primary-cell">{rule.name}</div>
                        <div className="muted-cell">{rule.description}</div>
                      </td>
                      <td>
                        <span className="badge badge-grey">{titleCase(rule.domain)}</span>
                      </td>
                      <td>
                        <SeverityBadge severity={rule.base_severity} />
                        {rule.alert_immediately && <div className="muted-cell">Alerts immediately</div>}
                      </td>
                      <td>
                        <div className="stack" style={{ gap: 5 }}>
                          {Object.entries(rule.params || {}).map(([key, value]) => (
                            <div className="row" key={key} style={{ gap: 6 }}>
                              <span className="small muted" style={{ minWidth: 108 }}>{titleCase(key)}</span>
                              {Array.isArray(value) ? (
                                <span className="small mono">{value.join(', ')}</span>
                              ) : (
                                <input
                                  className="field"
                                  style={{ width: 84 }}
                                  defaultValue={value}
                                  disabled={!canTune || savingCode === rule.code}
                                  onBlur={(event) => {
                                    if (String(value) !== event.target.value) {
                                      updateParam(rule, key, event.target.value);
                                    }
                                  }}
                                />
                              )}
                            </div>
                          ))}
                          {rule.sensitivity !== 1 && (
                            <span className="small faint">Tuned ×{rule.sensitivity} by false-positive marks</span>
                          )}
                        </div>
                      </td>
                      <td className="small">{rule.detections}</td>
                      <td className="small">
                        {rule.false_positives}
                        <div className="muted-cell">{rule.false_positive_rate}%</div>
                      </td>
                      <td>
                        <button
                          className={`btn btn-sm ${rule.enabled ? 'btn-success' : ''}`}
                          disabled={!canTune || savingCode === rule.code}
                          onClick={() => toggleRule(rule)}
                        >
                          {rule.enabled ? 'On' : 'Off'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'calendar' && (
          <div className="card-body">
            <div className="banner banner-info" style={{ marginBottom: 14 }}>
              <CalendarClock size={16} />
              <div>
                Run times are computed from the reporting calendar, so a month whose 3rd working day
                falls after a holiday shifts automatically. Holidays are configuration, not code.
              </div>
            </div>
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Cadence</th>
                    <th>Runs on</th>
                    <th>Period covered</th>
                  </tr>
                </thead>
                <tbody>
                  {CADENCE_RULES.map(([cadence, runsOn, covers]) => (
                    <tr key={cadence}>
                      <td className="primary-cell">{cadence}</td>
                      <td className="small">{runsOn}</td>
                      <td className="small muted">{covers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'metrics' && (
          <>
            <div className="card-body">
              <p className="small muted">
                Every figure in a report or a chat answer resolves to one of these definitions. Adding a
                metric here makes it available to templates and to the chat agent at the same time.
              </p>
            </div>
            <div className="scroll-x">
              <table className="data">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Module</th>
                    <th>Unit</th>
                    <th>Breakdowns</th>
                    <th>Visible to you</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((metric) => (
                    <tr key={metric.key}>
                      <td>
                        <div className="primary-cell">{metric.label}</div>
                        <div className="muted-cell">{metric.description}</div>
                      </td>
                      <td>
                        <span className="badge badge-indigo">{titleCase(metric.module)}</span>
                      </td>
                      <td className="small">{metric.unit || '—'}</td>
                      <td className="small muted">{metric.dimensions.join(', ') || '—'}</td>
                      <td>
                        <span className={`badge badge-${metric.readable ? 'green' : 'grey'}`}>
                          {metric.readable ? 'Yes' : 'Out of scope'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card title="Delivery" subtitle="How approved reports reach their recipients">
        <div className="grid grid-3">
          <KeyValue label="Formats" value="Interactive HTML, CSV/Excel" />
          <KeyValue label="Channel" value="In-app + email recipients per template" />
          <KeyValue label="Gate" value="Approved runs only" />
        </div>
      </Card>
    </>
  );
}
