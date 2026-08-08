import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const KPICard = ({ title, value, unit, trend, delay = 0 }) => {
  return (
    <div 
      className="glass glass-card slide-up" 
      style={{ animationDelay: `${delay}ms` }}
    >
      <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: '1rem' }}>
        <div style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1 }}>
          {unit === '$' ? 'SAR ' : ''}{typeof value === 'number' ? value.toLocaleString() : value}{unit !== '$' ? unit : ''}
        </div>
        
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.25rem',
          fontSize: '0.875rem',
          fontWeight: '500',
          padding: '0.25rem 0.5rem',
          borderRadius: '20px',
          backgroundColor: trend === 'up' ? 'rgba(16, 185, 129, 0.1)' : trend === 'down' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(100, 116, 139, 0.1)',
          color: trend === 'up' ? 'var(--success)' : trend === 'down' ? 'var(--danger)' : 'var(--text-secondary)'
        }}>
          {trend === 'up' && <TrendingUp size={16} />}
          {trend === 'down' && <TrendingDown size={16} />}
          {trend === 'neutral' && <Minus size={16} />}
          <span>{trend === 'up' ? '+12%' : trend === 'down' ? '-2.4%' : '0%'}</span>
        </div>
      </div>
    </div>
  );
};

export default KPICard;
