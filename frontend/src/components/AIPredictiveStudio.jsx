import React from 'react';
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Zap } from 'lucide-react';

const AIPredictiveStudio = ({ forecastData }) => {
  if (!forecastData) return null;

  return (
    <div className="glass glass-card slide-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} color="var(--secondary-color)" /> AI Predictive Forecasting & Anomaly Engine
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            LLM-driven pipeline predictions & unusual cost/velocity anomaly flags
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ 
            padding: '0.3rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
            backgroundColor: 'rgba(139, 92, 246, 0.15)', color: 'var(--secondary-color)'
          }}>
            Confidence Score: {forecastData.confidence_score}
          </span>
        </div>
      </div>

      {/* Forecast Metric Hero Card */}
      <div style={{ 
        padding: '1.25rem 1.5rem', borderRadius: 'var(--radius-md)', 
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
        border: '1px solid var(--surface-border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
      }}>
        <div>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {forecastData.forecast_period} Projected Pipeline
          </div>
          <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
            SAR {forecastData.predicted_pipeline.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--success)', fontWeight: 700, fontSize: '1.1rem' }}>
          <TrendingUp size={22} />
          <span>{forecastData.growth_projection} Projected Growth</span>
        </div>
      </div>

      {/* AI Anomaly & Insight Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Detected Anomalies & Strategic Recommendations
        </h4>

        {forecastData.anomalies.map((anom) => (
          <div key={anom.id} style={{ 
            padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)',
            backgroundColor: anom.type === 'warning' ? 'rgba(245, 158, 11, 0.1)' : anom.type === 'opportunity' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${anom.type === 'warning' ? 'var(--warning)' : anom.type === 'opportunity' ? 'var(--success)' : 'var(--danger)'}`,
            display: 'flex', alignItems: 'flex-start', gap: '1rem'
          }}>
            <div style={{ marginTop: '0.2rem' }}>
              {anom.type === 'warning' && <AlertTriangle size={20} color="var(--warning)" />}
              {anom.type === 'opportunity' && <Zap size={20} color="var(--success)" />}
              {anom.type === 'risk' && <AlertTriangle size={20} color="var(--danger)" />}
            </div>

            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                  {anom.title}
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  {anom.category}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                {anom.description}
              </p>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
};

export default AIPredictiveStudio;
