import React from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { titleCase } from '../api';

export function Card({ title, subtitle, action, children, bodyClass = '', noBody = false }) {
  return (
    <section className="card">
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          {action}
        </header>
      )}
      {noBody ? children : <div className={`card-body ${bodyClass}`}>{children}</div>}
    </section>
  );
}

export function StatTile({ icon: Icon, value, label, hint, tone = 'indigo' }) {
  const tones = {
    indigo: ['var(--primary-soft)', 'var(--primary)'],
    blue: ['var(--info-soft)', 'var(--info)'],
    green: ['var(--success-soft)', 'var(--success)'],
    amber: ['var(--warning-soft)', 'var(--warning)'],
    red: ['var(--danger-soft)', 'var(--danger)'],
    violet: ['var(--violet-soft)', 'var(--violet)'],
  };
  const [background, color] = tones[tone] || tones.indigo;
  return (
    <div className="card tile">
      <div className="tile-icon" style={{ background, color }}>
        <Icon size={19} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="tile-value">{value}</div>
        <div className="tile-label">{label}</div>
        {hint && <div className="tile-hint">{hint}</div>}
      </div>
    </div>
  );
}

const STATUS_TONES = {
  published: 'green',
  approved: 'green',
  delivered: 'green',
  connected: 'green',
  resolved: 'green',
  scheduled: 'grey',
  draft: 'grey',
  ignored: 'grey',
  pending: 'amber',
  in_review: 'amber',
  investigating: 'amber',
  degraded: 'amber',
  active: 'red',
  rejected: 'red',
  failed: 'red',
  disconnected: 'red',
  false_positive: 'violet',
  paused: 'grey',
};

export function StatusBadge({ status, label }) {
  const tone = STATUS_TONES[status] || 'grey';
  return (
    <span className={`badge badge-${tone}`}>
      <span className="dot" />
      {label || titleCase(status || 'unknown')}
    </span>
  );
}

const SEVERITY_TONES = { high: 'red', medium: 'amber', low: 'blue', info: 'grey' };

export function SeverityBadge({ severity }) {
  return (
    <span className={`badge badge-${SEVERITY_TONES[severity] || 'grey'}`}>{titleCase(severity)}</span>
  );
}

export function ModuleBadge({ module }) {
  return <span className="badge badge-indigo">{titleCase(module || 'all')}</span>;
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${active === tab.key ? 'active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count > 0 && <span className="pill">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ message, icon: Icon = Inbox }) {
  return (
    <div className="empty">
      <Icon size={26} />
      <div>{message}</div>
    </div>
  );
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="empty">
      <Loader2 size={22} className="spin" style={{ animation: 'spin 1s linear infinite' }} />
      <div>{label}</div>
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

export function ErrorBanner({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="banner banner-danger">
      <AlertCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>{error}</div>
      {onRetry && (
        <button className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function BarList({ rows, colour = 'var(--primary)', format = (value) => value }) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="barlist">
      {rows.map((row) => (
        <div className="barlist-row" key={row.label}>
          <span className="name" title={row.label}>
            {row.label}
          </span>
          <span className="meter">
            <span style={{ width: `${(row.value / max) * 100}%`, background: colour }} />
          </span>
          <span className="value">{format(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function KeyValue({ label, value }) {
  return (
    <div className="kv">
      <span className="k">{label}</span>
      <span className="v">{value}</span>
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(event) => event.stopPropagation()}>
        <div className="card-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="card-body">{children}</div>
        {footer && (
          <div className="card-head" style={{ borderBottom: 'none', borderTop: '1px solid var(--border)', justifyContent: 'flex-end' }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
