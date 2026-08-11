import React, { useCallback, useEffect, useState } from 'react';
import { Database, Lock, RefreshCw, Server } from 'lucide-react';
import { api, formatNumber, relativeTime, titleCase } from '../api';
import { Card, ErrorBanner, KeyValue, Loading, StatTile, StatusBadge } from '../components/ui';

export default function DataSources({ user }) {
  const [sources, setSources] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try {
      setSources(await api.get('/data-sources'));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async (id) => {
    setBusy(id);
    try {
      await api.post(`/data-sources/${id}/sync`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !sources) return <ErrorBanner error={error} onRetry={load} />;
  if (!sources) return <Loading label="Loading connections…" />;

  const connected = sources.filter((source) => source.status === 'connected').length;
  const records = sources.reduce((sum, source) => sum + (source.record_count || 0), 0);

  return (
    <>
      <ErrorBanner error={error} onRetry={load} />

      <div className="grid grid-3">
        <StatTile icon={Server} tone="green" value={`${connected}/${sources.length}`} label="Systems Connected" hint="Read-only access" />
        <StatTile icon={Database} tone="indigo" value={formatNumber(records)} label="Records In Scope" hint="Across all connected systems" />
        <StatTile icon={Lock} tone="violet" value="Read-only" label="Access Mode" hint="The agent never posts entries back" />
      </div>

      <div className="banner banner-info">
        <Lock size={16} />
        <div>
          The agent is a reporting layer. It reads from the ERP, CRM, HRMS and databases; every write
          in this system goes to the agent's own tables — report runs, approvals, anomalies and the
          audit log.
        </div>
      </div>

      <div className="grid grid-2">
        {sources.map((source) => (
          <Card
            key={source.id}
            title={`${source.name} — ${source.vendor}`}
            subtitle={titleCase(source.kind)}
            action={<StatusBadge status={source.status} />}
          >
            <KeyValue label="Access mode" value={titleCase(source.access_mode)} />
            <KeyValue label="Sync interval" value={`Every ${source.sync_interval_minutes} min`} />
            <KeyValue label="Last sync" value={relativeTime(source.last_sync_at)} />
            <KeyValue label="Records" value={formatNumber(source.record_count)} />
            {source.last_error && (
              <div className="banner banner-danger small" style={{ marginTop: 10 }}>
                {source.last_error}
              </div>
            )}
            <button
              className="btn btn-sm"
              style={{ marginTop: 12 }}
              disabled={busy === source.id || !user?.permissions?.includes('manage_sources')}
              onClick={() => sync(source.id)}
              title={user?.permissions?.includes('manage_sources') ? '' : 'Requires the manage sources permission'}
            >
              <RefreshCw size={14} /> Sync now
            </button>
          </Card>
        ))}
      </div>
    </>
  );
}
