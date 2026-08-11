import React, { useCallback, useEffect, useState } from 'react';
import { api, currentIdentity, setIdentity } from './api';
import { NAV_ITEMS, Rail, TopBar } from './components/Shell';
import { SourceRecordProvider } from './components/SourceRecords';
import { ErrorBanner } from './components/ui';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import Approvals from './pages/Approvals';
import ChatWithData from './pages/ChatWithData';
import Anomalies from './pages/Anomalies';
import DataSources from './pages/DataSources';
import UsersTeams from './pages/UsersTeams';
import SettingsPage from './pages/Settings';
import AuditLogs from './pages/AuditLogs';

const PAGE_META = {
  dashboard: ['Dashboard', 'AI-powered MIS reporting, approvals, insights and anomaly detection.'],
  reports: ['Reports & Schedules', 'Create, schedule and manage all your automated reports.'],
  approvals: ['Approvals', 'Reports waiting on their reviewing team before they reach management.'],
  chat: ['Chat with Data', 'Ask questions, get insights, and visualise your business data.'],
  anomalies: ['Anomalies', 'Detection of unusual patterns in your business data and software usage.'],
  sources: ['Data Sources', 'Connected systems the agent reads from. Nothing is written back.'],
  people: ['Users & Teams', 'Who can see what, and which team reviews which report.'],
  settings: ['Settings', 'Reporting calendar, detection rules and delivery configuration.'],
  audit: ['Audit Logs', 'Who saw what, when, and what changed.'],
};

export default function App() {
  const [view, setView] = useState('dashboard');
  const [railOpen, setRailOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [sources, setSources] = useState([]);
  const [counts, setCounts] = useState({ approvals: 0, anomalies: 0 });
  const [error, setError] = useState(null);
  const [identity, setIdentityState] = useState(currentIdentity());

  const refreshShell = useCallback(async () => {
    try {
      const [me, people, dataSources, approvalSummary, anomalySummary] = await Promise.all([
        api.get('/me'),
        api.get('/users'),
        api.get('/data-sources'),
        api.get('/approvals/summary'),
        api.get('/anomalies/summary'),
      ]);
      setUser(me);
      setUsers(people);
      setSources(dataSources);
      setCounts({ approvals: approvalSummary.pending, anomalies: anomalySummary.active });
      setError(null);
    } catch (err) {
      setError(`${err.message} — is the MIS Agent API running?`);
    }
  }, []);

  useEffect(() => {
    refreshShell();
  }, [refreshShell, identity]);

  const handleIdentityChange = (email) => {
    setIdentity(email);
    setIdentityState(email);
    setView('dashboard');
  };

  const [title, subtitle] = PAGE_META[view] || PAGE_META.dashboard;
  const pageProps = { user, onCountsChanged: refreshShell, onNavigate: setView };

  return (
    <SourceRecordProvider>
      <div className="shell">
        <Rail
          active={view}
          onNavigate={(key) => {
            setView(key);
            setRailOpen(false);
          }}
          counts={counts}
          sources={sources}
          open={railOpen}
        />

        <main className="main">
          <TopBar
            title={title}
            subtitle={subtitle}
            user={user}
            users={users}
            onIdentityChange={handleIdentityChange}
            onToggleRail={() => setRailOpen((open) => !open)}
          />

          <div className="page">
            <ErrorBanner error={error} onRetry={refreshShell} />
            {view === 'dashboard' && <Dashboard key={identity} {...pageProps} />}
            {view === 'reports' && <Reports key={identity} {...pageProps} />}
            {view === 'approvals' && <Approvals key={identity} {...pageProps} />}
            {view === 'chat' && <ChatWithData key={identity} {...pageProps} />}
            {view === 'anomalies' && <Anomalies key={identity} {...pageProps} />}
            {view === 'sources' && <DataSources key={identity} {...pageProps} />}
            {view === 'people' && <UsersTeams key={identity} {...pageProps} />}
            {view === 'settings' && <SettingsPage key={identity} {...pageProps} />}
            {view === 'audit' && <AuditLogs key={identity} {...pageProps} />}
          </div>
        </main>
      </div>
    </SourceRecordProvider>
  );
}

export { NAV_ITEMS };
