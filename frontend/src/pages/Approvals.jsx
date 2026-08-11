import React, { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, CheckCircle2, Clock, Eye, XCircle } from 'lucide-react';
import { api, formatDateTime, relativeTime, titleCase } from '../api';
import { Card, EmptyState, ErrorBanner, Loading, StatTile, StatusBadge, Tabs } from '../components/ui';
import ReportRunView from '../components/ReportRunView';

export default function Approvals({ user, onCountsChanged }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('pending');
  const [openRunId, setOpenRunId] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [approvals, summaryData] = await Promise.all([
        api.get(`/approvals?status=${status}`),
        api.get('/approvals/summary'),
      ]);
      setItems(approvals);
      setSummary(summaryData);
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  if (openRunId) {
    return (
      <ReportRunView
        runId={openRunId}
        onBack={() => {
          setOpenRunId(null);
          load();
        }}
        onChanged={() => {
          load();
          onCountsChanged?.();
        }}
        canDecide={user?.permissions?.includes('approve')}
        canPublish={user?.permissions?.includes('publish')}
      />
    );
  }

  if (error && !summary) return <ErrorBanner error={error} onRetry={load} />;
  if (!summary) return <Loading label="Loading approval queue…" />;

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      {!user?.permissions?.includes('approve') && (
        <div className="banner banner-info">
          <Eye size={16} />
          <div>
            Your role ({titleCase(user?.role || '')}) can read this queue but not decide on it. Approval
            rights belong to the reviewing team named on each report.
          </div>
        </div>
      )}

      <div className="grid grid-4">
        <StatTile icon={Clock} tone="amber" value={summary.pending} label="Awaiting review" hint={`${summary.unopened} not yet opened`} />
        <StatTile icon={CheckCircle2} tone="green" value={summary.approved_this_month} label="Approved this month" hint="With a logged reviewer" />
        <StatTile icon={XCircle} tone="red" value={summary.rejected_this_month} label="Rejected this month" hint="Each with a recorded reason" />
        <StatTile icon={AlertOctagon} tone="violet" value={summary.escalated} label="Escalated" hint="Past the review SLA" />
      </div>

      <Card noBody>
        <Tabs
          tabs={[
            { key: 'pending', label: 'Awaiting review', count: summary.pending },
            { key: 'approved', label: 'Approved' },
            { key: 'rejected', label: 'Rejected' },
            { key: 'all', label: 'All' },
          ]}
          active={status}
          onChange={setStatus}
        />
        <div className="scroll-x">
          <table className="data">
            <thead>
              <tr>
                <th>Report</th>
                <th>Period</th>
                <th>Reviewing team</th>
                <th>Requested</th>
                <th>Opened</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="primary-cell">{item.run.template_name}</div>
                    <div className="muted-cell">
                      {item.run.recipients.length} recipient{item.run.recipients.length === 1 ? '' : 's'} once published
                    </div>
                  </td>
                  <td className="small">{item.run.period_label}</td>
                  <td className="small">
                    {item.reviewer_team?.name}
                    {item.escalated_at && <span className="badge badge-red" style={{ marginLeft: 6 }}>Escalated</span>}
                  </td>
                  <td className="small nowrap">{relativeTime(item.requested_at)}</td>
                  <td className="small nowrap">
                    {item.opened_at ? (
                      <span className="badge badge-green">{formatDateTime(item.opened_at)}</span>
                    ) : (
                      <span className="badge badge-grey">Not opened</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={item.status} />
                    {item.reason && <div className="muted-cell" title={item.reason}>{item.reason.slice(0, 60)}…</div>}
                  </td>
                  <td className="right">
                    <button className="btn btn-sm btn-primary" onClick={() => setOpenRunId(item.run_id)}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
              {!items.length && (
                <tr>
                  <td colSpan={7}>
                    <EmptyState message="Nothing in this queue." icon={CheckCircle2} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="banner banner-info">
        <Eye size={16} />
        <div>
          A reviewer has to open a report before the API will accept an approval, a rejection needs a
          written reason, and only an approved run can be published — every one of those steps is
          written to the audit log.
        </div>
      </div>
    </>
  );
}
