import React from 'react';
import {
  AlertTriangle, Bell, Bot, CheckSquare, Database, FileText, LayoutDashboard,
  MessageSquare, ScrollText, Settings, Users,
} from 'lucide-react';
import { initials, titleCase } from '../api';

export const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'reports', label: 'Reports & Schedules', icon: FileText },
  { key: 'approvals', label: 'Approvals', icon: CheckSquare, badge: 'approvals', calm: true },
  { key: 'chat', label: 'Chat with Data', icon: MessageSquare },
  { key: 'anomalies', label: 'Anomalies', icon: AlertTriangle, badge: 'anomalies' },
  { key: 'sources', label: 'Data Sources', icon: Database },
  { key: 'people', label: 'Users & Teams', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'audit', label: 'Audit Logs', icon: ScrollText },
];

export function Rail({ active, onNavigate, counts, sources, open }) {
  const connected = sources.filter((source) => source.status === 'connected').length;
  const lastSync = sources[0]?.last_sync_at;

  return (
    <nav className={`rail ${open ? 'open' : ''}`}>
      <div className="rail-brand">
        <span className="rail-mark">
          <Bot size={21} />
        </span>
        <div>
          <h1>MIS Agent</h1>
          <p>Your AI MIS Partner</p>
        </div>
      </div>

      <div className="rail-nav">
        {NAV_ITEMS.map((item) => {
          const count = item.badge ? counts[item.badge] : 0;
          return (
            <button
              key={item.key}
              className={`rail-link ${active === item.key ? 'active' : ''}`}
              onClick={() => onNavigate(item.key)}
            >
              <item.icon size={17} />
              {item.label}
              {count > 0 && <span className={`count ${item.calm ? 'calm' : ''}`}>{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="rail-panel">
        <h4>
          Connected systems
          <span className="badge badge-green">{connected}/{sources.length || 0}</span>
        </h4>
        <div className="line">Access mode: read-only</div>
        <div className="line">
          Last sync: {lastSync ? new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </div>
      </div>
    </nav>
  );
}

export function TopBar({ title, subtitle, user, users, onIdentityChange, actions, onToggleRail }) {
  return (
    <header className="topbar">
      <div className="row">
        <button className="btn btn-ghost btn-icon" onClick={onToggleRail} style={{ display: 'none' }}>
          ☰
        </button>
        <div>
          <h2>{title}</h2>
          {subtitle && <div className="sub">{subtitle}</div>}
        </div>
      </div>

      <div className="topbar-right">
        {actions}
        <button className="btn btn-ghost btn-icon" aria-label="Notifications">
          <Bell size={17} />
        </button>
        <div className="row" style={{ gap: 9 }}>
          <span className="avatar">{initials(user?.name || user?.email || '')}</span>
          <div style={{ lineHeight: 1.25 }}>
            <div className="small strong">{user?.name || 'Loading…'}</div>
            <div className="small muted">
              {titleCase(user?.role || '')}
              {user?.team ? ` · ${user.team}` : ''}
            </div>
          </div>
          {/* Persona switch — stands in for SSO while the identity provider is not wired up. */}
          <label className="row" style={{ gap: 6 }} title="Switch persona to see role-based permissions">
            <span className="small faint nowrap">View as</span>
            <select
              className="field"
              style={{ width: 172 }}
              value={user?.email || ''}
              onChange={(event) => onIdentityChange(event.target.value)}
            >
              {users.map((person) => (
                <option key={person.email} value={person.email}>
                  {person.full_name} · {titleCase(person.role)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </header>
  );
}
