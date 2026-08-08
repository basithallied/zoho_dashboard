import React, { useEffect, useState } from 'react';
import { Trophy, DollarSign, Target, Calendar, ArrowUpRight, TrendingUp, Users, Printer } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ExecutiveAuditInsights = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [channels, setChannels] = useState([]);
  const [cashflow, setCashflow] = useState([]);
  const [workload, setWorkload] = useState([]);

  useEffect(() => {
    const fetchAuditData = async () => {
      try {
        const [leadRes, chanRes, cashRes, workRes] = await Promise.all([
          fetch('http://localhost:8000/api/crm/leaderboard'),
          fetch('http://localhost:8000/api/crm/channel-roi'),
          fetch('http://localhost:8000/api/books/cashflow-timeline'),
          fetch('http://localhost:8000/api/projects/workload')
        ]);
        if (leadRes.ok) setLeaderboard(await leadRes.json());
        if (chanRes.ok) setChannels(await chanRes.json());
        if (cashRes.ok) setCashflow(await cashRes.json());
        if (workRes.ok) setWorkload(await workRes.json());
      } catch (err) {
        console.error("Error fetching executive audit insights:", err);
      }
    };
    fetchAuditData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '1rem' }}>
      
      {/* 1. Sales Rep Performance Leaderboard */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Trophy size={20} color="var(--warning)" /> Executive Sales Leaderboard & Quota Attainment
        </h3>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--surface-border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '0.75rem 0.5rem' }}>Sales Representative</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Deals Closed</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Total Revenue (SAR)</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Quota Attainment</th>
                <th style={{ padding: '0.75rem 0.5rem' }}>Lead Win Rate</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((rep, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ 
                      width: '24px', height: '24px', borderRadius: '50%', 
                      backgroundColor: idx === 0 ? 'var(--warning)' : 'var(--surface-border)',
                      color: idx === 0 ? 'black' : 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700
                    }}>
                      {idx + 1}
                    </span>
                    {rep.name}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 500 }}>{rep.deals_closed} Deals</td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 700, color: 'var(--primary-color)' }}>
                    SAR {rep.revenue.toLocaleString()}
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: '8px', borderRadius: '4px', backgroundColor: 'var(--surface-border)', overflow: 'hidden' }}>
                        <div style={{ 
                          width: `${Math.min(100, rep.quota_attainment)}%`, height: '100%', 
                          backgroundColor: rep.quota_attainment >= 100 ? 'var(--success)' : 'var(--primary-color)' 
                        }}></div>
                      </div>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{rep.quota_attainment}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: 'var(--success)' }}>
                    {rep.win_rate}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2. Acquisition Channel ROI & 30-Day Cashflow Timeline */}
      <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
        
        {/* Lead Channel ROI */}
        <div className="glass glass-card slide-up" style={{ padding: '1.5rem', height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: 0, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowUpRight size={20} color="var(--success)" /> Acquisition Channel ROI Breakdown
          </h3>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channels} layout="vertical" margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--surface-border)" />
                <XAxis type="number" tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <YAxis dataKey="channel" type="category" tick={{fill: 'var(--text-secondary)', fontSize: 11}} width={120} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px' }} />
                <Bar dataKey="revenue" name="Revenue Generated (SAR)" fill="var(--primary-color)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 30-Day Cash Flow Timeline */}
        <div className="glass glass-card slide-up" style={{ padding: '1.5rem', height: '360px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: 0, marginBottom: '0.75rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <TrendingUp size={20} color="var(--primary-color)" /> 30-Day Cash Flow Projection (SAR)
          </h3>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflow} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="day" tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <YAxis tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="projected_inflow" name="Projected Cash Inflow" fill="var(--success)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="projected_outflow" name="Projected Outflow" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* 3. Team Workload & Resource Utilization Matrix */}
      <div className="glass glass-card slide-up" style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: 0, marginBottom: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Users size={20} color="var(--primary-color)" /> Engineering & Delivery Workload Matrix (Zoho Projects)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat( auto-fit, minmax(200px, 1fr) )', gap: '1rem' }}>
          {workload.map((role, idx) => (
            <div key={idx} style={{ 
              padding: '1rem', borderRadius: 'var(--radius-md)', 
              backgroundColor: 'rgba(255,255,255,0.6)', border: '1px solid var(--surface-border)',
              display: 'flex', flexDirection: 'column', gap: '0.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{role.role}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>{role.utilization}%</div>
              
              <div style={{ height: '6px', borderRadius: '3px', backgroundColor: 'var(--surface-border)', overflow: 'hidden' }}>
                <div style={{ 
                  width: `${role.utilization}%`, height: '100%', 
                  backgroundColor: role.utilization > 90 ? 'var(--danger)' : role.utilization > 80 ? 'var(--primary-color)' : 'var(--success)' 
                }}></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                <span>{role.billable_hours} Billable Hrs</span>
                <span style={{ fontWeight: 700, color: role.utilization > 90 ? 'var(--danger)' : 'var(--text-primary)' }}>{role.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default ExecutiveAuditInsights;
