import React, { useState } from 'react';
import { Filter, ArrowDown, TrendingUp, Users, DollarSign } from 'lucide-react';

const SalesFunnel = ({ funnelData }) => {
  const [funnelType, setFunnelType] = useState('lead'); // 'lead' or 'deal'
  
  if (!funnelData) return null;

  const currentFunnel = funnelType === 'lead' ? funnelData.lead_funnel : funnelData.deal_funnel;
  const maxCount = currentFunnel && currentFunnel.length > 0 ? currentFunnel[0].count : 1;

  // Funnel stage colors
  const stageColors = [
    'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    'linear-gradient(135deg, #10b981 0%, #059669 100%)'
  ];

  return (
    <div className="glass glass-card slide-up" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header & Toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h3 style={{ margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={20} color="var(--primary-color)" />
            Sales & Lead Conversion Funnel
          </h3>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Track stage-by-stage progression and conversion dropoff
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.5)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
          <button 
            className={`btn ${funnelType === 'lead' ? 'btn-primary' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: funnelType !== 'lead' ? 'transparent' : '', color: funnelType !== 'lead' ? 'var(--text-secondary)' : '' }}
            onClick={() => setFunnelType('lead')}
          >
            <Users size={14} /> Lead Funnel
          </button>
          <button 
            className={`btn ${funnelType === 'deal' ? 'btn-primary' : ''}`}
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: funnelType !== 'deal' ? 'transparent' : '', color: funnelType !== 'deal' ? 'var(--text-secondary)' : '' }}
            onClick={() => setFunnelType('deal')}
          >
            <DollarSign size={14} /> Deal Funnel
          </button>
        </div>
      </div>

      {/* Visual Funnel Representation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
        {currentFunnel && currentFunnel.map((item, index) => {
          const widthPercent = Math.max(35, (item.count / maxCount) * 100);
          
          return (
            <React.Fragment key={index}>
              {/* Funnel Stage Bar */}
              <div 
                className="fade-in"
                style={{ 
                  width: `${widthPercent}%`,
                  minWidth: '280px',
                  background: stageColors[index % stageColors.length],
                  color: 'white',
                  borderRadius: '16px',
                  padding: '1.25rem 1.5rem',
                  boxShadow: '0 8px 20px rgba(59, 130, 246, 0.2)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
                    {item.stage}
                  </span>
                  <span style={{ 
                    background: 'rgba(255,255,255,0.25)', 
                    padding: '0.2rem 0.6rem', 
                    borderRadius: '20px', 
                    fontSize: '0.8rem', 
                    fontWeight: 700 
                  }}>
                    {item.conversion} Conversion
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>
                      {item.count}
                    </span>
                    <span style={{ fontSize: '0.85rem', opacity: 0.9, marginLeft: '0.4rem' }}>
                      {funnelType === 'lead' ? 'Leads' : 'Deals'}
                    </span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                      SAR {item.value.toLocaleString()}
                    </span>
                    <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>Pipeline Volume</div>
                  </div>
                </div>
              </div>

              {/* Conversion Arrow between steps */}
              {index < currentFunnel.length - 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600, margin: '-0.25rem 0' }}>
                  <ArrowDown size={16} color="var(--primary-color)" />
                  <span>
                    {Math.round(100 - (currentFunnel[index+1].count / item.count) * 100)}% Drop-off
                  </span>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

    </div>
  );
};

export default SalesFunnel;
