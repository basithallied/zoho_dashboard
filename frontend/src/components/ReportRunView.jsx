import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, FileCode2, MessageSquarePlus, TrendingDown, TrendingUp } from 'lucide-react';
import { api, formatDateTime, formatNumber, titleCase } from '../api';
import { Card, ErrorBanner, Loading, StatusBadge } from './ui';
import { SourceList } from './SourceRecords';

function Fact({ label, value }) {
  return (
    <div>
      <div className="small muted">{label}</div>
      <div className="strong">{value}</div>
    </div>
  );
}

/**
 * A generated report.
 *
 * Fetching it is not a neutral read: the API stamps the reviewer's `opened_at`
 * when this loads, which is the precondition for approving.
 */
export default function ReportRunView({ runId, onBack, onChanged, canDecide, canPublish }) {
  const [run, setRun] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [annotating, setAnnotating] = useState(null);
  const [annotation, setAnnotation] = useState('');

  const load = async () => {
    try {
      setRun(await api.get(`/reports/runs/${runId}`));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  const act = async (path, body) => {
    setBusy(true);
    try {
      await api.post(path, body);
      await load();
      onChanged?.();
      setRejecting(false);
      setReason('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveAnnotation = async (sectionKey, metricKey) => {
    if (!annotation.trim()) return;
    await act(`/approvals/runs/${runId}/annotations`, {
      section_key: sectionKey,
      metric_key: metricKey,
      body: annotation,
    });
    setAnnotation('');
    setAnnotating(null);
  };

  if (error && !run) return <ErrorBanner error={error} onRetry={load} />;
  if (!run) return <Loading label="Opening report…" />;

  const pendingApproval = run.approvals.find((approval) => approval.status === 'pending');
  const commentary = run.commentary?.sections || {};

  return (
    <div className="stack">
      <ErrorBanner error={error} />

      <div className="row wrap">
        <button className="btn btn-sm" onClick={onBack}>
          <ArrowLeft size={14} /> Back
        </button>
        <span className="spacer" />
        <a className="btn btn-sm" href={api.exportUrl(`/reports/runs/${runId}/export.html`)} target="_blank" rel="noreferrer">
          <FileCode2 size={14} /> HTML
        </a>
        <a className="btn btn-sm" href={api.exportUrl(`/reports/runs/${runId}/export.csv`)}>
          <Download size={14} /> Excel / CSV
        </a>
        {canDecide && run.status === 'in_review' && (
          <>
            <button
              className="btn btn-sm btn-success"
              disabled={busy || !pendingApproval?.can_approve}
              title={pendingApproval?.can_approve ? '' : 'Open the report content before approving'}
              onClick={() => act(`/approvals/runs/${runId}/approve`)}
            >
              Approve
            </button>
            <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => setRejecting(true)}>
              Reject
            </button>
          </>
        )}
        {canPublish && run.status === 'approved' && (
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => act(`/approvals/runs/${runId}/publish`)}>
            Publish to {run.recipients.length} recipient{run.recipients.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {rejecting && (
        <Card title="Reason for rejection" subtitle="Recorded against the approval and visible to the report owner">
          <textarea
            className="field"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What needs to change before this can be released?"
          />
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn btn-sm btn-danger"
              disabled={busy || reason.trim().length < 10}
              onClick={() => act(`/approvals/runs/${runId}/reject`, { reason })}
            >
              Confirm rejection
            </button>
            <button className="btn btn-sm" onClick={() => setRejecting(false)}>
              Cancel
            </button>
            {reason.trim().length < 10 && <span className="small faint">At least 10 characters</span>}
          </div>
        </Card>
      )}

      <Card
        title={run.template_name}
        subtitle={`${run.period_label} · generated ${formatDateTime(run.generated_at)} in ${run.generation_ms}ms`}
        action={<StatusBadge status={run.status} />}
      >
        <div className="grid grid-4">
          <Fact label="Owning team" value={run.owner_team?.name || '—'} />
          <Fact label="Reviewing team" value={run.reviewer_team?.name || '—'} />
          <Fact label="Source records" value={formatNumber(run.source_record_count)} />
          <Fact label="Delivery" value={titleCase(run.delivery_status)} />
        </div>
        {run.commentary?.highlights?.length > 0 && (
          <div className="banner banner-info" style={{ marginTop: 14 }}>
            <div>
              <div className="strong small">Highlights</div>
              <ul style={{ margin: '5px 0 0 16px' }}>
                {run.commentary.highlights.map((line) => (
                  <li key={line} className="small">{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        {run.commentary?.concerns?.length > 0 && (
          <div className="banner banner-amber" style={{ marginTop: 10 }}>
            <div>
              <div className="strong small">Needs attention</div>
              <ul style={{ margin: '5px 0 0 16px' }}>
                {run.commentary.concerns.map((line) => (
                  <li key={line} className="small">{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <p className="small faint" style={{ marginTop: 12 }}>
          Figures come from source records. The agent writes the commentary only — never the numbers.
        </p>
      </Card>

      {(run.figures?.sections || []).map((section) => (
        <Card
          key={section.key}
          title={section.title}
          subtitle={section.comparison ? `Compared against ${section.comparison}` : 'No comparison period'}
          noBody
        >
          <div className="scroll-x">
            <table className="data">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="right">Value</th>
                  <th className="right">Comparison</th>
                  <th>Source records</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {section.metrics.map((metric) => (
                  <tr key={metric.key}>
                    <td>
                      <div className="primary-cell">{metric.label}</div>
                      {metric.note && <div className="muted-cell">{metric.note}</div>}
                      {metric.error && <div className="muted-cell" style={{ color: 'var(--danger)' }}>{metric.error}</div>}
                    </td>
                    <td className="right strong">{metric.formatted || '—'}</td>
                    <td className="right">
                      {metric.comparison?.change_pct !== null && metric.comparison?.change_pct !== undefined ? (
                        <span
                          className={`badge badge-${
                            (metric.comparison.change_pct >= 0) === (metric.higher_is_better ?? true) ? 'green' : 'red'
                          }`}
                        >
                          {metric.comparison.change_pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(metric.comparison.change_pct).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="faint small">—</span>
                      )}
                    </td>
                    <td>
                      <SourceList refs={metric.source_refs || []} limit={3} />
                    </td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setAnnotating({ section: section.key, metric: metric.key })}
                        title="Annotate this line item"
                      >
                        <MessageSquarePlus size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {annotating?.section === section.key && (
            <div className="card-body" style={{ borderTop: '1px solid var(--border)' }}>
              <textarea
                className="field"
                value={annotation}
                onChange={(event) => setAnnotation(event.target.value)}
                placeholder={`Comment on ${annotating.metric}`}
              />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn btn-sm btn-primary" onClick={() => saveAnnotation(annotating.section, annotating.metric)}>
                  Save annotation
                </button>
                <button className="btn btn-sm" onClick={() => setAnnotating(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {commentary[section.key]?.length > 0 && (
            <div className="detail-panel">
              <div className="card-body">
                <h5 className="small strong" style={{ marginBottom: 6 }}>Agent commentary</h5>
                {commentary[section.key].map((line) => (
                  <p key={line} className="small muted">{line}</p>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}

      {run.annotations?.length > 0 && (
        <Card title="Reviewer annotations">
          <div className="stack" style={{ gap: 10 }}>
            {run.annotations.map((item) => (
              <div key={item.id}>
                <div className="small strong">
                  {item.author_email} · {item.section_key}
                  {item.metric_key ? ` / ${item.metric_key}` : ''}
                </div>
                <div className="small muted">{item.body}</div>
                <div className="small faint">{formatDateTime(item.created_at)}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card title="Approval history">
        <div className="stack" style={{ gap: 10 }}>
          {run.approvals.map((approval) => (
            <div key={approval.id}>
              <div className="row" style={{ gap: 8 }}>
                <StatusBadge status={approval.status} />
                <span className="small">{approval.reviewer_team?.name}</span>
                {approval.reviewer_email && <span className="small muted">· {approval.reviewer_email}</span>}
              </div>
              <div className="small faint" style={{ marginTop: 3 }}>
                Requested {formatDateTime(approval.requested_at)} · opened{' '}
                {approval.opened_at ? formatDateTime(approval.opened_at) : 'not yet'} · decided{' '}
                {approval.decided_at ? formatDateTime(approval.decided_at) : '—'}
              </div>
              {approval.reason && (
                <div className="banner banner-danger small" style={{ marginTop: 6 }}>
                  {approval.reason}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
