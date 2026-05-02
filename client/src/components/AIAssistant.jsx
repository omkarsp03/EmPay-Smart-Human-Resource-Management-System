import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api';
import { X, AlertTriangle, TrendingUp, Clock, CheckCircle, ChevronRight, Sparkles } from 'lucide-react';
import './AIAssistant.css';

const iconMap = {
  'alert-triangle': AlertTriangle,
  'trending-up': TrendingUp,
  'clock': Clock,
  'check-circle': CheckCircle,
};

export default function AIAssistant({ isOpen, onClose }) {
  const [insights, setInsights] = useState([]);
  const [deptHealth, setDeptHealth] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) loadInsights();
  }, [isOpen]);

  const loadInsights = async () => {
    setLoading(true);
    try {
      const res = await analyticsAPI.getInsights();
      setInsights(res.data.insights || []);
      setDeptHealth(res.data.departmentHealth || []);
    } catch {}
    setLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-panel animate-slide-in-right" onClick={e => e.stopPropagation()}>
        <div className="ai-header">
          <div className="ai-header-title">
            <div className="ai-logo"><Sparkles size={18} /></div>
            <div>
              <h3>AI Assistant</h3>
              <span className="text-xs text-tertiary">Powered by EmPay Intelligence</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="ai-body">
          {loading ? (
            <div className="ai-loading">
              <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 80, marginBottom: 12 }} />
              <div className="skeleton" style={{ height: 80 }} />
            </div>
          ) : (
            <>
              <div className="ai-section">
                <h4 className="ai-section-title">🔍 Insights</h4>
                {insights.map((insight, i) => {
                  const Icon = iconMap[insight.icon] || AlertTriangle;
                  return (
                    <div key={i} className={`ai-insight ai-insight-${insight.type}`} style={{ animationDelay: `${i * 100}ms` }}>
                      <div className="ai-insight-icon"><Icon size={18} /></div>
                      <div className="ai-insight-content">
                        <h5>{insight.title}</h5>
                        <p>{insight.message}</p>
                      </div>
                      <ChevronRight size={16} className="ai-insight-arrow" />
                    </div>
                  );
                })}
              </div>

              <div className="ai-section">
                <h4 className="ai-section-title">🏢 Department Health</h4>
                {deptHealth.map((dept, i) => (
                  <div key={i} className="ai-dept" style={{ animationDelay: `${(insights.length + i) * 100}ms` }}>
                    <div className="ai-dept-header">
                      <span className="ai-dept-name">{dept.department}</span>
                      <span className="ai-dept-score">{dept.score}%</span>
                    </div>
                    <div className="ai-dept-bar">
                      <div
                        className="ai-dept-fill"
                        style={{
                          width: `${dept.score}%`,
                          background: dept.score > 80 ? 'var(--success)' : dept.score > 50 ? 'var(--warning)' : 'var(--error)',
                        }}
                      />
                    </div>
                    <span className="ai-dept-meta">{dept.employees} employees</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
