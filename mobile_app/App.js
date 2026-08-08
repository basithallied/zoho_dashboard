import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, ScrollView, TouchableOpacity, 
  SafeAreaView, StatusBar, RefreshControl, ActivityIndicator 
} from 'react-native';
import { fetchMobileDashboardData } from './src/services/api';
import { KPICardMobile } from './src/components/KPICardMobile';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [data, setData] = useState({
    kpis: [], summary: null, forecast: null, alerts: [], leaderboard: [], cashflow: [], workload: []
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const res = await fetchMobileDashboardData();
    setData(res);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const triggeredAlerts = (data.alerts || []).filter(a => a.is_triggered);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f172a" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Zoho Executive MIS</Text>
          <Text style={styles.headerSubtitle}>Real-time Read-Only Mobile View</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadData}>
          <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      {/* Main Scroll Content */}
      <ScrollView 
        style={styles.scrollArea}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />}
      >
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Fetching Zoho MIS Analytics...</Text>
          </View>
        ) : (
          <>
            {/* Active Alerts Banner */}
            {triggeredAlerts.length > 0 && (
              <View style={styles.alertBanner}>
                <Text style={styles.alertTitle}>⚠️ Threshold Alert ({triggeredAlerts.length} Active)</Text>
                <Text style={styles.alertMessage}>{triggeredAlerts[0].message || `${triggeredAlerts[0].kpi_name} breached threshold`}</Text>
              </View>
            )}

            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <View style={styles.tabContent}>
                {/* Hero Summary Card */}
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Total Pipeline Value (SAR)</Text>
                  <Text style={styles.heroValue}>
                    SAR {data.summary ? data.summary.pipeline_total.toLocaleString() : '2,845,000'}
                  </Text>
                  <View style={styles.heroRow}>
                    <View>
                      <Text style={styles.heroSubLabel}>Net Profit Margin</Text>
                      <Text style={styles.heroSubVal}>
                        SAR {data.summary ? data.summary.net_profit.toLocaleString() : '57.2%'}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.heroSubLabel}>Active Projects</Text>
                      <Text style={styles.heroSubVal}>12 Active</Text>
                    </View>
                  </View>
                </View>

                {/* KPI Carousel */}
                <Text style={styles.sectionHeader}>Key Performance Indicators</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiRow}>
                  {data.kpis.map(kpi => (
                    <KPICardMobile 
                      key={kpi.id} 
                      title={kpi.name} 
                      value={kpi.value} 
                      unit={kpi.unit} 
                      trend={kpi.trend} 
                      trendValue={kpi.trend_value} 
                    />
                  ))}
                </ScrollView>

                {/* AI Forecast */}
                {data.forecast && (
                  <View style={styles.aiCard}>
                    <Text style={styles.aiHeader}>✨ Kimi AI Q4 Forecast</Text>
                    <Text style={styles.aiValue}>SAR {data.forecast.predicted_pipeline.toLocaleString()}</Text>
                    <Text style={styles.aiSub}>
                      Predicted Growth: <Text style={{ color: '#10b981', fontWeight: 'bold' }}>{data.forecast.growth_projection}</Text> ({data.forecast.confidence_score} Confidence)
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* TAB 2: CRM & SALES */}
            {activeTab === 'crm' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>🏆 Executive Sales Rep Leaderboard</Text>
                {data.leaderboard.map((rep, idx) => (
                  <View key={idx} style={styles.listCard}>
                    <View style={styles.listRow}>
                      <Text style={styles.listName}>{idx + 1}. {rep.name}</Text>
                      <Text style={styles.listAmount}>SAR {(rep.revenue / 1000).toFixed(0)}k</Text>
                    </View>
                    <View style={styles.listRow}>
                      <Text style={styles.listSub}>{rep.deals_closed} Deals Closed ({rep.win_rate} Win Rate)</Text>
                      <Text style={{ color: '#10b981', fontWeight: 'bold', fontSize: 12 }}>{rep.quota_attainment}% Quota</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 3: PROJECTS & OPERATIONS */}
            {activeTab === 'projects' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>📁 Delivery Velocity & Workload</Text>
                
                <View style={styles.listCard}>
                  <Text style={styles.listName}>On-Time Delivery Velocity</Text>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#10b981', marginVertical: 4 }}>88.5% On-Time</Text>
                  <Text style={styles.listSub}>Completion rate across 12 active client projects</Text>
                </View>

                <Text style={[styles.sectionHeader, { marginTop: 16 }]}>Team Utilization Matrix</Text>
                {data.workload.map((role, idx) => (
                  <View key={idx} style={styles.listCard}>
                    <View style={styles.listRow}>
                      <Text style={styles.listName}>{role.role}</Text>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: role.utilization > 90 ? '#ef4444' : '#3b82f6' }}>{role.utilization}%</Text>
                    </View>
                    <View style={styles.listRow}>
                      <Text style={styles.listSub}>{role.billable_hours} Billable Hours</Text>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: role.utilization > 90 ? '#ef4444' : '#10b981' }}>{role.status}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* TAB 4: FINANCE & BOOKS */}
            {activeTab === 'finance' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionHeader}>💰 Days Sales Outstanding (DSO)</Text>
                <View style={styles.listCard}>
                  <Text style={styles.listSub}>Average Collection Time</Text>
                  <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#10b981', marginVertical: 4 }}>28.4 Days</Text>
                  <Text style={styles.listSub}>Target: &lt; 35 Days (Optimal Liquidity)</Text>
                </View>

                <Text style={[styles.sectionHeader, { marginTop: 16 }]}>30-Day Cash Flow Timeline</Text>
                {data.cashflow.map((cf, idx) => (
                  <View key={idx} style={styles.listCard}>
                    <Text style={styles.listName}>{cf.day}</Text>
                    <View style={[styles.listRow, { marginTop: 4 }]}>
                      <Text style={{ color: '#10b981', fontWeight: 'bold' }}>Inflow: SAR {cf.projected_inflow.toLocaleString()}</Text>
                      <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Outflow: SAR {cf.projected_outflow.toLocaleString()}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('overview')}>
          <Text style={[styles.tabText, activeTab === 'overview' && styles.tabTextActive]}>🏠 Overview</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('crm')}>
          <Text style={[styles.tabText, activeTab === 'crm' && styles.tabTextActive]}>🎯 CRM</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('projects')}>
          <Text style={[styles.tabText, activeTab === 'projects' && styles.tabTextActive]}>📁 Projects</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setActiveTab('finance')}>
          <Text style={[styles.tabText, activeTab === 'finance' && styles.tabTextActive]}>💰 Finance</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#f8fafc'
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#94a3b8'
  },
  refreshBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  refreshBtnText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: 'bold'
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16
  },
  loaderContainer: {
    marginTop: 60,
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 14
  },
  alertBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#ef4444',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 12
  },
  alertTitle: {
    color: '#ef4444',
    fontWeight: 'bold',
    fontSize: 13
  },
  alertMessage: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2
  },
  tabContent: {
    paddingVertical: 16
  },
  heroCard: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  heroLabel: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
    textTransform: 'uppercase'
  },
  heroValue: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    marginVertical: 4
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)'
  },
  heroSubLabel: {
    fontSize: 11,
    color: '#94a3b8'
  },
  heroSubVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 2
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8
  },
  kpiRow: {
    flexDirection: 'row',
    marginVertical: 4
  },
  aiCard: {
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 16
  },
  aiHeader: {
    color: '#a78bfa',
    fontWeight: 'bold',
    fontSize: 14
  },
  aiValue: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    marginVertical: 4
  },
  aiSub: {
    fontSize: 12,
    color: '#cbd5e1'
  },
  listCard: {
    backgroundColor: '#1e293b',
    borderRadius: 14,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)'
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  listName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff'
  },
  listAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#3b82f6'
  },
  listSub: {
    fontSize: 12,
    color: '#94a3b8'
  },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0f172a',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12
  },
  tabItem: {
    paddingHorizontal: 12,
    paddingVertical: 4
  },
  tabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500'
  },
  tabTextActive: {
    color: '#3b82f6',
    fontWeight: 'bold'
  }
});
