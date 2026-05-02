import { useEffect, useState, useRef } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import './KPICard.css';

export default function KPICard({ title, value, icon: Icon, trend, trendValue, color = 'primary', prefix = '', suffix = '', loading }) {
  const [displayValue, setDisplayValue] = useState(0);
  const cardRef = useRef(null);

  useEffect(() => {
    if (loading || typeof value !== 'number') return;
    const duration = 800;
    const steps = 40;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, loading]);

  if (loading) {
    return (
      <div className="kpi-card">
        <div className="skeleton skeleton-text" style={{ width: '60%' }} />
        <div className="skeleton" style={{ height: 36, width: '40%', marginTop: 8 }} />
        <div className="skeleton skeleton-text" style={{ width: '50%', marginTop: 12 }} />
      </div>
    );
  }

  return (
    <div className={`kpi-card kpi-${color}`} ref={cardRef}>
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {Icon && <div className="kpi-icon"><Icon size={20} /></div>}
      </div>
      <div className="kpi-value">
        {prefix}{typeof value === 'number' ? displayValue.toLocaleString() : value}{suffix}
      </div>
      {trendValue !== undefined && (
        <div className={`kpi-trend ${trend === 'up' ? 'trend-up' : 'trend-down'}`}>
          {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
          <span>{trendValue}%</span>
          <span className="kpi-trend-label">vs last month</span>
        </div>
      )}
    </div>
  );
}
