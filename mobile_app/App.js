import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  approveReport, fetchMobileDashboardData, openReport, rejectReport,
} from './src/services/api';
import { KPICardMobile } from './src/components/KPICardMobile';

const REJECTION_REASON =
  'Rejected from mobile — figures need a desk review before this is released.';

export default function App() {
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyRunId, setBusyRunId] = useState(null);

  const load = async () => {
    try {
      setData(await fetchMobileDashboardData());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const decide = async (runId, action) => {
    setBusyRunId(runId);
    try {
      if (action === 'approve') {
        await openReport(runId);
        await approveReport(runId);
      } else {
        await rejectReport(runId, REJECTION_REASON);
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyRunId(null);
    }
  };

  const dashboard = data?.dashboard;
  const approvals = data?.approvals || [];
  const anomalies = data?.anomalies || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#12142b" />

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>MIS Agent</Text>
          <Text style={styles.headerSubtitle}>
            {dashboard ? `${dashboard.user.name} · ${dashboard.user.role}` : 'Your AI MIS Partner'}
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />}
      >
        {loading && (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading your MIS position…</Text>
          </View>
        )}

        {!!error && (
          <View style={styles.alertBanner}>
            <Text style={styles.alertTitle}>Could not reach the MIS Agent API</Text>
            <Text style={styles.alertMessage}>{error}</Text>
          </View>
        )}

        {!loading && dashboard && tab === 'overview' && (
          <View style={styles.tabContent}>
            <View style={styles.heroCard}>
              <Text style={styles.heroLabel}>Pending approvals</Text>
              <Text style={styles.heroValue}>{dashboard.cards.pending_approvals}</Text>
              <View style={styles.heroRow}>
                <View>
                  <Text style={styles.heroSubLabel}>Sent today</Text>
                  <Text style={styles.heroSubVal}>{dashboard.cards.reports_sent_today}</Text>
                </View>
                <View>
                  <Text style={styles.heroSubLabel}>Open anomalies</Text>
                  <Text style={styles.heroSubVal}>{dashboard.cards.anomalies_detected}</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionHeader}>Key figures</Text>
            {dashboard.headline_metrics.map((metric) => (
              <KPICardMobile
                key={metric.key}
                title={metric.label}
                value={metric.formatted}
                subtitle={`${metric.period} · ${metric.record_count} source records`}
                change={metric.change_pct}
                positive={metric.change_pct === null ? null : (metric.change_pct >= 0) === metric.higher_is_better}
              />
            ))}

            <Text style={styles.sectionHeader}>Upcoming runs</Text>
            {dashboard.upcoming_runs.map((run) => (
              <View style={styles.listCard} key={run.id}>
                <View style={styles.listRow}>
                  <Text style={styles.listName}>{run.name}</Text>
                  <Text style={styles.listAmount}>{run.cadence}</Text>
                </View>
                <Text style={styles.listSub}>
                  {new Date(run.next_run_at).toLocaleString()} · {run.recipients} recipients
                </Text>
              </View>
            ))}
          </View>
        )}

        {!loading && tab === 'approvals' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Awaiting review</Text>
            {approvals.map((item) => (
              <View style={styles.listCard} key={item.id}>
                <View style={styles.listRow}>
                  <Text style={styles.listName}>{item.run.template_name}</Text>
                  <Text style={styles.listSub}>{item.run.period_label}</Text>
                </View>
                <Text style={styles.listSub}>
                  {item.reviewer_team?.name} · {item.opened_at ? 'opened' : 'not opened yet'}
                </Text>
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    disabled={busyRunId === item.run_id}
                    onPress={() => decide(item.run_id, 'approve')}
                  >
                    <Text style={styles.approveText}>Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    disabled={busyRunId === item.run_id}
                    onPress={() => decide(item.run_id, 'reject')}
                  >
                    <Text style={styles.rejectText}>Reject</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            {!approvals.length && <Text style={styles.emptyText}>Nothing waiting on a decision.</Text>}
          </View>
        )}

        {!loading && tab === 'anomalies' && (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeader}>Open anomalies</Text>
            {anomalies.map((anomaly) => (
              <View style={styles.listCard} key={anomaly.id}>
                <View style={styles.listRow}>
                  <Text style={styles.listName}>{anomaly.title}</Text>
                  <Text style={[styles.severity, severityStyle(anomaly.severity)]}>
                    {anomaly.severity}
                  </Text>
                </View>
                <Text style={styles.listSub}>{anomaly.entity_label}</Text>
                <Text style={styles.listSub}>{anomaly.what_happened}</Text>
                {!!anomaly.financial_impact && (
                  <Text style={styles.impact}>
                    SAR {Math.round(anomaly.financial_impact).toLocaleString()} · {anomaly.impact_label}
                  </Text>
                )}
              </View>
            ))}
            {!anomalies.length && <Text style={styles.emptyText}>No open anomalies.</Text>}
          </View>
        )}
      </ScrollView>

      <View style={styles.tabBar}>
        {[
          ['overview', 'Overview'],
          ['approvals', `Approvals${approvals.length ? ` (${approvals.length})` : ''}`],
          ['anomalies', `Anomalies${anomalies.length ? ` (${anomalies.length})` : ''}`],
        ].map(([key, label]) => (
          <TouchableOpacity key={key} style={styles.tabItem} onPress={() => setTab(key)}>
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

function severityStyle(severity) {
  if (severity === 'high') return { color: '#f87171' };
  if (severity === 'medium') return { color: '#fbbf24' };
  return { color: '#60a5fa' };
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#12142b' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff' },
  headerSubtitle: { fontSize: 11, color: '#a8adc9' },
  refreshBtn: {
    backgroundColor: 'rgba(99, 102, 241, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  refreshBtnText: { color: '#a5b4fc', fontSize: 12, fontWeight: 'bold' },
  scrollArea: { flex: 1, paddingHorizontal: 16 },
  loaderContainer: { marginTop: 60, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#a8adc9', fontSize: 14 },
  alertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  alertTitle: { color: '#f87171', fontWeight: 'bold', fontSize: 13 },
  alertMessage: { color: '#cbd5e1', fontSize: 12, marginTop: 2 },
  tabContent: { paddingVertical: 16 },
  heroCard: {
    backgroundColor: '#1c1f3d',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  heroLabel: { fontSize: 12, color: '#a8adc9', fontWeight: '600', textTransform: 'uppercase' },
  heroValue: { fontSize: 30, fontWeight: '900', color: '#ffffff', marginVertical: 4 },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  heroSubLabel: { fontSize: 11, color: '#a8adc9' },
  heroSubVal: { fontSize: 15, fontWeight: 'bold', color: '#34d399', marginTop: 2 },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#a8adc9',
    textTransform: 'uppercase',
    marginTop: 18,
    marginBottom: 8,
  },
  listCard: {
    backgroundColor: '#1c1f3d',
    borderRadius: 14,
    padding: 13,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  listName: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', flexShrink: 1 },
  listAmount: { fontSize: 12, fontWeight: 'bold', color: '#a5b4fc' },
  listSub: { fontSize: 12, color: '#a8adc9', marginTop: 3 },
  impact: { fontSize: 13, fontWeight: 'bold', color: '#f87171', marginTop: 6 },
  severity: { fontSize: 12, fontWeight: 'bold', textTransform: 'capitalize' },
  actionRow: { flexDirection: 'row', marginTop: 10 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginRight: 8 },
  approveBtn: { backgroundColor: '#16a34a' },
  approveText: { color: '#ffffff', fontWeight: 'bold', fontSize: 12 },
  rejectBtn: { borderWidth: 1, borderColor: '#f87171' },
  rejectText: { color: '#f87171', fontWeight: 'bold', fontSize: 12 },
  emptyText: { color: '#a8adc9', fontSize: 13, textAlign: 'center', marginTop: 20 },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#12142b',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
  },
  tabItem: { paddingHorizontal: 12, paddingVertical: 4 },
  tabText: { color: '#6b7186', fontSize: 12, fontWeight: '500' },
  tabTextActive: { color: '#a5b4fc', fontWeight: 'bold' },
});
