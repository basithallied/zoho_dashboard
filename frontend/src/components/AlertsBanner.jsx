import React, { useState } from 'react';
import { AlertTriangle, BellRing, X, PlusCircle, Trash2 } from 'lucide-react';
import { API_BASE } from '../apiConfig';

const AlertsBanner = ({ alerts, onRefreshAlerts }) => {
  const [showManager, setShowManager] = useState(false);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  // Alert Rule Form State
  const [kpiName, setKpiName] = useState('Overdue Receivables');
  const [condition, setCondition] = useState('greater_than');
  const [thresholdValue, setThresholdValue] = useState(50000);
  const [channel, setChannel] = useState('Dashboard Banner');

  const triggeredAlerts = (alerts || []).filter(a => a.is_triggered && !dismissedAlerts.includes(a.id));

  const handleCreateAlert = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kpi_name: kpiName,
          condition: condition,
          threshold_value: parseFloat(thresholdValue),
          channel: channel
        })
      });
      if (res.ok) {
        onRefreshAlerts();
        setShowManager(false);
      }
    } catch (err) {
      console.error("Error creating alert rule:", err);
    }
  };

  const handleDeleteAlert = async (id) => {
    try {
      await fetch(`${API_BASE}/alerts/${id}`, { method: 'DELETE' });
      onRefreshAlerts();
    } catch (err) {
      console.error("Error deleting alert:", err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
      
      {/* Live Triggered Alerts Banner */}
      {triggeredAlerts.length > 0 && (
        <div className="fade-in" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1.5px solid var(--danger)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem 1.25rem',
          display: 'flex',
          alignItems: 'center',
          justify: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          boxShadow: 'var(--shadow-md)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ 
              width: '36px', height: '36px', borderRadius: '50%', 
              backgroundColor: 'var(--danger)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '0.9rem' }}>
                Threshold Alert Breached ({triggeredAlerts.length} Active)
              </div>
              <div style={{ color: 'var(--text-primary)', fontSize: '0.85rem', fontWeight: 500 }}>
                {triggeredAlerts[0].message || `${triggeredAlerts[0].kpi_name} breached threshold ${triggeredAlerts[0].threshold_value}`}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button 
              className="btn" 
              style={{ background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
              onClick={() => setShowManager(true)}
            >
              <BellRing size={14} /> Alert Rules
            </button>
            <button 
              className="btn" 
              style={{ background: 'transparent', padding: '0.35rem' }}
              onClick={() => setDismissedAlerts([...dismissedAlerts, triggeredAlerts[0].id])}
              title="Dismiss Banner"
            >
              <X size={18} color="var(--text-secondary)" />
            </button>
          </div>
        </div>
      )}

      {/* Header Button if no active alerts */}
      {triggeredAlerts.length === 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="btn" 
            style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid var(--surface-border)', fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
            onClick={() => setShowManager(true)}
          >
            <BellRing size={14} color="var(--primary-color)" /> Configure KPI Alerts ({alerts ? alerts.length : 0})
          </button>
        </div>
      )}

      {/* Alert Rules Manager Modal */}
      {showManager && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass glass-card fade-in" style={{ width: '520px', padding: '2rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BellRing size={20} color="var(--primary-color)" /> KPI Threshold Alert Manager
              </h3>
              <button className="btn" style={{ background: 'transparent' }} onClick={() => setShowManager(false)}>
                <X size={20} />
              </button>
            </div>

            {/* Existing Rules List */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                Active Alert Rules
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {alerts && alerts.map(rule => (
                  <div key={rule.id} style={{ 
                    padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', 
                    backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid var(--surface-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{rule.kpi_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Condition: <strong>{rule.condition === 'greater_than' ? '>' : '<'} {rule.threshold_value.toLocaleString()}</strong> ({rule.channel})
                      </div>
                    </div>
                    <button className="btn" style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger)', padding: '0.35rem' }} onClick={() => handleDeleteAlert(rule.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Alert Rule Form */}
            <form onSubmit={handleCreateAlert} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.25rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <PlusCircle size={16} /> Create New Threshold Rule
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>KPI Metric</label>
                  <select value={kpiName} onChange={e => setKpiName(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.2rem', outline: 'none' }}>
                    <option value="Overdue Receivables">Overdue Receivables</option>
                    <option value="Lead Win Rate">Lead Win Rate</option>
                    <option value="Total Pipeline Value">Total Pipeline Value</option>
                    <option value="Budget Utilization">Budget Utilization</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Condition</label>
                  <select value={condition} onChange={e => setCondition(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.2rem', outline: 'none' }}>
                    <option value="greater_than">Breaches Exceed (&gt;)</option>
                    <option value="less_than">Drops Below (&lt;)</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Threshold Amount</label>
                  <input type="number" required value={thresholdValue} onChange={e => setThresholdValue(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.2rem', outline: 'none' }} />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Channel</label>
                  <select value={channel} onChange={e => setChannel(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', marginTop: '0.2rem', outline: 'none' }}>
                    <option value="Dashboard Banner">Dashboard Banner</option>
                    <option value="Email">Email Digest</option>
                    <option value="Slack">Slack Webhook</option>
                  </select>
                </div>
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>
                Save Alert Rule
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AlertsBanner;
