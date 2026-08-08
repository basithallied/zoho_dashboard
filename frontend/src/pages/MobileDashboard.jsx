import React, { useState, useEffect } from 'react';
import { 
  Smartphone, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, 
  Target, Folder, DollarSign, Sparkles, Trophy, Layers, ChevronRight, Bell, ShieldCheck
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

const MobileDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [kpis, setKpis] = useState([]);
  const [summary, setSummary] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMobileData = async () => {
    setLoading(true);
    try {
      const [kpiRes, sumRes, forcRes, altRes, leadRes, cashRes] = await Promise.all([
        fetch('http://localhost:8000/api/kpis?module=all'),
        fetch('http://localhost:8000/api/analytics/summary'),
        fetch('http://localhost:8000/api/analytics/ai-forecast'),
        fetch('http://localhost:8000/api/alerts'),
        fetch('http://localhost:8000/api/crm/leaderboard'),
        fetch('http://localhost:8000/api/books/cashflow-timeline')
      ]);

      if (kpiRes.ok) setKpis(await kpiRes.json());
      if (sumRes.ok) setSummary(await sumRes.json());
      if (forcRes.ok) setForecast(await forcRes.json());
      if (altRes.ok) setAlerts(await altRes.json());
      if (leadRes.ok) setLeaderboard(await leadRes.json());
      if (cashRes.ok) setCashflow(await cashRes.json());
    } catch (err) {
      console.error("Error fetching mobile dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMobileData();
  }, []);

  const triggeredAlerts = (alerts || []).filter(a => a.is_triggered);

  return (
    <div style={{
      maxWidth: '430px',
      margin: '0 auto',
      backgroundColor: '#0f172a',
      color: '#f8fafc',
      borderRadius: '36px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 12px #1e293b',
      overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      position: 'relative',
      minHeight: '844px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      
      {/* Mobile Status Bar */}
      <div style={{
        padding: '0.75rem 1.5rem 0.25rem 1.5rem',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        fontWeight: 600,
        color: '#94a3b8',
        background: 'rgba(15, 23, 42, 0.95)'
      }}>
        <span>9:41</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <ShieldCheck size={14} color="#10b981" />
          <span>Zoho Mobile MIS</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span>5G</span>
          <div style={{ width: '18px', height: '9px', border: '1px solid #94a3b8', borderRadius: '2px', padding: '1px' }}>
            <div style={{ width: '80%', height: '100%', backgroundColor: '#10b981' }}></div>
          </div>
        </div>
      </div>

      {/* App Header */}
      <div style={{
        padding: '1rem 1.25rem',
        background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        alignItems: 'center',
        justify: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Smartphone size={22} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Executive Mobile View
            </div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Real-time Zoho MIS Sync
            </div>
          </div>
        </div>

        <button 
          onClick={fetchMobileData}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '50%',
            width: '36px', height: '36px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#3b82f6', cursor: 'pointer'
          }}
          title="Refresh Data"
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
        </button>
      </div>

      {/* Main Mobile Scrollable Content */}
      <div style={{ flex: 1, padding: '1.25rem 1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Triggered Alerts Notification Banner */}
        {triggeredAlerts.length > 0 && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '16px',
            padding: '0.85rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <Bell size={20} color="#ef4444" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#fca5a5' }}>
                {triggeredAlerts.length} Active Alert Breach
              </div>
              <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>
                {triggeredAlerts[0].kpi_name} exceeded threshold
              </div>
            </div>
            <ChevronRight size={16} color="#94a3b8" />
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <>
            {/* Quick Hero Summary Card */}
            <div style={{
              background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '1.25rem',
              backdropFilter: 'blur(10px)'
            }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Total Pipeline (SAR)
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 900, color: '#ffffff', marginTop: '0.25rem' }}>
                SAR {summary ? summary.pipeline_total.toLocaleString() : '2,845,000'}
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Net Profit</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                    SAR {summary ? summary.net_profit.toLocaleString() : '57.2%'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Active Projects</div>
                  <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#3b82f6' }}>12 Active</div>
                </div>
              </div>
            </div>

            {/* Horizontal Swipeable KPI Cards */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                Key Performance Metrics
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {kpis.slice(0, 5).map(kpi => (
                  <div key={kpi.id} style={{
                    minWidth: '160px',
                    background: 'rgba(30, 41, 59, 0.7)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between'
                  }}>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>{kpi.name}</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: '0.5rem 0' }}>
                      {kpi.unit}{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                    </div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: kpi.trend === 'up' ? '#10b981' : '#ef4444' }}>
                      {kpi.trend_value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Predictive Highlight */}
            {forecast && (
              <div style={{
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '16px',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  <Sparkles size={16} /> Kimi AI Q4 Forecast
                </div>
                <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'white' }}>
                  SAR {forecast.predicted_pipeline.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
                  Predicted Q4 Growth: <span style={{ color: '#10b981', fontWeight: 700 }}>{forecast.growth_projection}</span> (94.2% Confidence)
                </div>
              </div>
            )}
          </>
        )}

        {/* TAB 2: ZOHO CRM */}
        {activeTab === 'crm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Target size={18} color="#3b82f6" /> Sales & CRM Performance
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.75rem' }}>
                Top Sales Representatives
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {leaderboard.map((rep, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: idx < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{rep.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{rep.deals_closed} Deals Closed ({rep.win_rate} Win)</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#3b82f6' }}>SAR {(rep.revenue / 1000).toFixed(0)}k</div>
                      <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>{rep.quota_attainment}% Quota</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ZOHO PROJECTS */}
        {activeTab === 'projects' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Folder size={18} color="#8b5cf6" /> Projects & Delivery Status
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Delivery Velocity</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#10b981' }}>88.5% On-Time</span>
              </div>
              <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: '88.5%', height: '100%', background: '#10b981' }}></div>
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>Resource Utilization Matrix</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#3b82f6' }}>85.2% Overall Team Load</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>Senior Developers at 92.5% Capacity</div>
            </div>
          </div>
        )}

        {/* TAB 4: ZOHO BOOKS / FINANCE */}
        {activeTab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="#10b981" /> Financial Position & Cash Flow
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Days Sales Outstanding (DSO)</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.2rem' }}>28.4 Days</div>
              <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.25rem' }}>Target: &lt; 35 Days (Optimal Collection)</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', borderRadius: '16px', padding: '1rem', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>30-Day Projected Cash Flow</div>
              <div style={{ height: '140px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashflow}>
                    <XAxis dataKey="day" tick={{fill: '#94a3b8', fontSize: 10}} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="projected_inflow" fill="#10b981" radius={[4,4,0,0]} />
                    <Bar dataKey="projected_outflow" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Mobile App Bottom Tab Bar Navigation */}
      <div style={{
        padding: '0.65rem 0.5rem 1.25rem 0.5rem',
        background: 'rgba(15, 23, 42, 0.95)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        justify: 'space-around',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
            color: activeTab === 'overview' ? '#3b82f6' : '#64748b', cursor: 'pointer'
          }}
        >
          <Layers size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'overview' ? 700 : 500 }}>Overview</span>
        </button>

        <button 
          onClick={() => setActiveTab('crm')}
          style={{
            background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
            color: activeTab === 'crm' ? '#3b82f6' : '#64748b', cursor: 'pointer'
          }}
        >
          <Target size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'crm' ? 700 : 500 }}>CRM</span>
        </button>

        <button 
          onClick={() => setActiveTab('projects')}
          style={{
            background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
            color: activeTab === 'projects' ? '#3b82f6' : '#64748b', cursor: 'pointer'
          }}
        >
          <Folder size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'projects' ? 700 : 500 }}>Projects</span>
        </button>

        <button 
          onClick={() => setActiveTab('finance')}
          style={{
            background: 'transparent', border: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
            color: activeTab === 'finance' ? '#3b82f6' : '#64748b', cursor: 'pointer'
          }}
        >
          <DollarSign size={20} />
          <span style={{ fontSize: '0.65rem', fontWeight: activeTab === 'finance' ? 700 : 500 }}>Finance</span>
        </button>
      </div>

    </div>
  );
};

export default MobileDashboard;
