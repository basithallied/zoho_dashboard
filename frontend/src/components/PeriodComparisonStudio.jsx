import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';

const PeriodComparisonStudio = ({ comparisonData }) => {
  if (!comparisonData || comparisonData.length === 0) return null;

  return (
    <div className="glass glass-card slide-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} color="var(--primary-color)" /> Period-over-Period (YoY / QoQ) Comparison Studio
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Compare Q3 2026 performance against historical quarters (Revenue, Expenses & Delivery Velocity)
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
        
        {/* Chart 1: Revenue vs Expenses Growth over Quarters */}
        <div style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Quarterly Financial Growth (SAR)
          </h4>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', backdropFilter: 'blur(12px)' }} />
                <Legend verticalAlign="top" height={36} />
                <Bar dataKey="revenue" name="Revenue (SAR)" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses (SAR)" fill="var(--danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Deals Won vs Project Velocity */}
        <div style={{ height: '320px', display: 'flex', flexDirection: 'column' }}>
          <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Deals Closed vs Project Velocity Trend
          </h4>
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={comparisonData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--surface-border)" />
                <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: 'var(--text-secondary)', fontSize: 11}} />
                <Tooltip contentStyle={{ backgroundColor: 'var(--surface-color)', borderRadius: '12px', backdropFilter: 'blur(12px)' }} />
                <Legend verticalAlign="top" height={36} />
                <Line type="monotone" dataKey="deals_won" name="Deals Won" stroke="var(--success)" strokeWidth={3} dot={{ r: 5 }} />
                <Line type="monotone" dataKey="project_velocity" name="Project Velocity (%)" stroke="var(--secondary-color)" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
};

export default PeriodComparisonStudio;
