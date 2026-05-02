import { useState, useEffect } from 'react';
import { analyticsAPI, userAPI, payrollAPI } from '../api';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Download, AlertTriangle, Users, TrendingUp, Shield, DollarSign } from 'lucide-react';
import './Reports.css';

const COLORS = ['#0071E3', '#34C759', '#FF9F0A', '#FF3B30', '#5AC8FA', '#AF52DE', '#FF2D55'];
const TABS = ['Salary Statement', 'Overview', 'Anomalies', 'Attrition Risk', 'Salary Report', 'Payroll Forecast'];

export default function Reports() {
  const [data, setData] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [attrition, setAttrition] = useState(null);
  const [costs, setCosts] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [activeTab, setActiveTab] = useState('Salary Statement');
  const [loading, setLoading] = useState(true);
  const [stmtUsers, setStmtUsers] = useState([]);
  const [stmtUserId, setStmtUserId] = useState('');
  const [stmtYear, setStmtYear] = useState(() => new Date().getFullYear());
  const [stmtYearOptions, setStmtYearOptions] = useState(() => {
    const y = new Date().getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
  });
  const [stmtData, setStmtData] = useState(null);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (activeTab !== 'Salary Statement') return;
    let cancelled = false;
    (async () => {
      try {
        const [usersRes, payRes] = await Promise.all([
          userAPI.getAll({ page: 1, limit: 300 }),
          payrollAPI.getAll({}).catch(() => ({ data: { records: [] } })),
        ]);
        if (cancelled) return;
        const users = usersRes.data.users || [];
        const precords = payRes.data.records || [];
        const withPay = new Set(precords.map((r) => r.userId));
        const yearStrs = [...new Set(precords.map((r) => (r.month || '').split('-')[0]).filter(Boolean))].sort((a, b) =>
          b.localeCompare(a)
        );
        const sortedUsers = [...users].sort((a, b) => {
          const aw = withPay.has(a._id) ? 0 : 1;
          const bw = withPay.has(b._id) ? 0 : 1;
          if (aw !== bw) return aw - bw;
          return (a.name || '').localeCompare(b.name || '');
        });
        setStmtUsers(sortedUsers);
        const yNow = new Date().getFullYear();
        const fallbackYears = [yNow, yNow - 1, yNow - 2, yNow - 3, yNow - 4];
        const yearsNumeric = yearStrs.length ? yearStrs.map((s) => Number(s)) : fallbackYears;
        setStmtYearOptions(yearsNumeric);
        const pick = sortedUsers.find((u) => withPay.has(u._id)) || sortedUsers[0];
        setStmtUserId((prev) => {
          if (prev && sortedUsers.some((u) => u._id === prev)) return prev;
          return pick?._id || '';
        });
        setStmtYear((prev) => (yearsNumeric.includes(prev) ? prev : yearsNumeric[0] ?? yNow));
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'Salary Statement' || !stmtUserId) return;
    (async () => {
      try {
        const res = await payrollAPI.getSalaryStatement(stmtUserId, { year: stmtYear });
        setStmtData(res.data);
      } catch {
        setStmtData(null);
      }
    })();
  }, [activeTab, stmtUserId, stmtYear]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [dash, anom, attr, cost, fore] = await Promise.all([
        analyticsAPI.getDashboard(),
        analyticsAPI.getAnomalies().catch(() => ({ data: { anomalies: [] } })),
        analyticsAPI.getAttritionRisk().catch(() => ({ data: { employees: [], summary: {} } })),
        analyticsAPI.getCostBreakdown().catch(() => ({ data: { breakdown: [], totalCompanyCost: 0 } })),
        analyticsAPI.getPayrollForecast().catch(() => ({ data: { history: [], forecast: [], combined: [] } })),
      ]);
      setData(dash.data);
      setAnomalies(anom.data);
      setAttrition(attr.data);
      setCosts(cost.data);
      setForecast(fore.data);
    } catch {}
    setLoading(false);
  };

  const exportCSV = () => {
    if (!data) return;
    const rows = [['Department', 'Employees']];
    (data.departments || []).forEach(d => rows.push([d.name, d.count]));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'empay_report.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!data) return;
    let content = '<html><head><meta charset="utf-8"></head><body><table border="1">';
    content += '<tr><th>Department</th><th>Employees</th></tr>';
    (data.departments || []).forEach(d => { content += `<tr><td>${d.name}</td><td>${d.count}</td></tr>`; });
    content += '</table>';
    if (costs?.breakdown) {
      content += '<br/><table border="1"><tr><th>Department</th><th>Total Cost</th><th>Headcount</th><th>Cost/Employee</th></tr>';
      costs.breakdown.forEach(d => { content += `<tr><td>${d.department}</td><td>${d.totalCost}</td><td>${d.headcount}</td><td>${d.costPerEmployee}</td></tr>`; });
      content += '</table>';
    }
    content += '</body></html>';
    const blob = new Blob([content], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'empay_report.xls'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="analytics animate-fade-in">
      <div className="page-header">
        <div><h1>HR Analytics</h1><p className="text-secondary">Reports, insights & intelligence</p></div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={exportCSV}><Download size={16} /> CSV</button>
          <button className="btn btn-secondary" onClick={exportExcel}><Download size={16} /> Excel</button>
        </div>
      </div>

      <div className="analytics-tabs">
        {TABS.map(tab => (
          <button key={tab} type="button" className={`analytics-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'Anomalies' && <AlertTriangle size={14} />}
            {tab === 'Attrition Risk' && <Users size={14} />}
            {tab === 'Salary Report' && <DollarSign size={14} />}
            {tab === 'Payroll Forecast' && <TrendingUp size={14} />}
            {tab === 'Overview' && <Shield size={14} />}
            {tab}
            {tab === 'Anomalies' && anomalies?.total > 0 && <span className="tab-badge">{anomalies.total}</span>}
          </button>
        ))}
      </div>

      {activeTab === 'Salary Statement' && (
        <div className="card salary-statement-card">
          <div className="page-header salary-statement-toolbar">
            <div>
              <h2 style={{ margin: 0 }}>Salary Statement Report</h2>
              <p className="text-secondary text-sm">Select employee and year, then print in report format.</p>
              {stmtData?.meta?.yearNote && (
                <p className="text-sm" style={{ margin: '8px 0 0', color: 'var(--warning-700, #b45309)' }}>
                  {stmtData.meta.yearNote}
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary salary-print-btn"
              onClick={() => window.print()}
            >
              Print
            </button>
          </div>
          <div className="form-row salary-statement-form">
            <div className="form-group">
              <label className="form-label">Employee Name</label>
              <select className="input" value={stmtUserId} onChange={(e) => setStmtUserId(e.target.value)}>
                {stmtUsers.map((u) => (
                  <option key={u._id} value={u._id}>{u.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Year</label>
              <select className="input" value={stmtYear} onChange={(e) => setStmtYear(Number(e.target.value))}>
                {stmtYearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          <div id="salary-statement-print" className="salary-statement-print">
            <h3 className="salary-print-title">Salary Statement Report Print</h3>
            <p className="salary-print-company">{stmtData?.employee?.companyName || 'Company'}</p>
            <h4 className="salary-print-subtitle">Salary Statement Report</h4>
            {stmtData?.employee && (
              <div className="salary-statement-meta">
                <div><span>Employee Name</span><strong>{stmtData.employee.name}</strong></div>
                <div><span>Designation</span><strong>{stmtData.employee.designation || '—'}</strong></div>
                <div><span>Date Of Joining</span><strong>{stmtData.employee.dateOfJoining ? new Date(stmtData.employee.dateOfJoining).toLocaleDateString() : '—'}</strong></div>
                <div><span>Salary Effective From</span><strong>{stmtData.employee.salaryEffectiveFrom ? new Date(stmtData.employee.salaryEffectiveFrom).toLocaleDateString() : '—'}</strong></div>
              </div>
            )}
            <table className="data-table salary-statement-table">
              <thead>
                <tr>
                  <th>Salary Components</th>
                  <th>Monthly Amount</th>
                  <th>Yearly Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr className="salary-group-row"><td colSpan={3}>Earnings</td></tr>
                {(stmtData?.earnings || []).map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>₹ {Number(row.monthly || 0).toLocaleString('en-IN')}</td>
                    <td>₹ {Number(row.yearly || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                <tr className="salary-group-row"><td colSpan={3}>Deductions</td></tr>
                {(stmtData?.deductions || []).map((row) => (
                  <tr key={row.name}>
                    <td>{row.name}</td>
                    <td>₹ {Number(row.monthly || 0).toLocaleString('en-IN')}</td>
                    <td>₹ {Number(row.yearly || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
                <tr className="salary-net-row">
                  <td>Net Salary</td>
                  <td>₹ {Number(stmtData?.netMonthly || 0).toLocaleString('en-IN')}</td>
                  <td>₹ {Number(stmtData?.netYearly || 0).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Overview' && (
        <div className="analytics-grid">
          <div className="card chart-card">
            <div className="card-header"><h3 className="card-title">Attendance Trends</h3><span className="badge badge-neutral">7 days</span></div>
            {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data?.attendanceTrends || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="day" stroke="var(--text-tertiary)" fontSize={12} />
                  <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="present" stroke="#0071E3" strokeWidth={2} name="Present" />
                  <Line type="monotone" dataKey="wfh" stroke="#06B6D4" strokeWidth={2} name="WFH" />
                  <Line type="monotone" dataKey="absent" stroke="#EF4444" strokeWidth={2} name="Absent" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="card chart-card">
            <div className="card-header"><h3 className="card-title">Department Distribution</h3></div>
            {loading ? <div className="skeleton" style={{ height: 280 }} /> : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data?.departments || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="count" nameKey="name">
                    {(data?.departments || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="card chart-card">
            <div className="card-header"><h3 className="card-title">Headcount Trend</h3><span className="badge badge-neutral">6 months</span></div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.headcountTrends || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} />
                <Area type="monotone" dataKey="count" stroke="#0071E3" fill="rgba(0,113,227,0.08)" strokeWidth={2} name="Headcount" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card chart-card">
            <div className="card-header"><h3 className="card-title">Payroll by Department</h3></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data?.payrollDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="name" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} formatter={v => `₹${v.toLocaleString()}`} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} name="Total">
                  {(data?.payrollDistribution || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {activeTab === 'Anomalies' && (
        <div className="anomalies-section">
          <div className="anomaly-summary">
            <div className="anomaly-stat"><span className="anomaly-count" style={{ color: 'var(--error)' }}>{anomalies?.anomalies?.filter(a => a.severity === 'high').length || 0}</span><span className="text-xs text-tertiary">High Risk</span></div>
            <div className="anomaly-stat"><span className="anomaly-count" style={{ color: 'var(--warning)' }}>{anomalies?.anomalies?.filter(a => a.severity === 'medium').length || 0}</span><span className="text-xs text-tertiary">Medium</span></div>
            <div className="anomaly-stat"><span className="anomaly-count" style={{ color: 'var(--text-primary)' }}>{anomalies?.total || 0}</span><span className="text-xs text-tertiary">Total</span></div>
          </div>
          <div className="anomaly-list">
            {(anomalies?.anomalies || []).map((a, i) => (
              <div key={i} className={`anomaly-card card animate-slide-up`} style={{ animationDelay: `${i * 50}ms` }}>
                <div className={`anomaly-severity ${a.severity}`} />
                <div className="anomaly-body">
                  <div className="anomaly-top">
                    <h4>{a.title}</h4>
                    <span className={`badge ${a.severity === 'high' ? 'badge-error' : 'badge-warning'}`}>{a.severity}</span>
                  </div>
                  <p className="text-sm text-secondary">{a.description}</p>
                  <div className="anomaly-meta">
                    <span className="badge badge-neutral">{a.type}</span>
                    <span className="text-xs text-tertiary">{a.employee} — {a.department}</span>
                    <span className="anomaly-metric">{a.metric}</span>
                  </div>
                </div>
              </div>
            ))}
            {(!anomalies?.anomalies?.length) && <div className="card" style={{ padding: 'var(--space-8)', textAlign: 'center' }}><p className="text-tertiary">No anomalies detected ✅</p></div>}
          </div>
        </div>
      )}

      {activeTab === 'Attrition Risk' && (
        <div>
          <div className="attrition-summary">
            <div className="att-risk-card high"><span className="att-risk-count">{attrition?.summary?.high || 0}</span><span>High Risk</span></div>
            <div className="att-risk-card medium"><span className="att-risk-count">{attrition?.summary?.medium || 0}</span><span>Medium Risk</span></div>
            <div className="att-risk-card low"><span className="att-risk-count">{attrition?.summary?.low || 0}</span><span>Low Risk</span></div>
            <div className="att-risk-card avg"><span className="att-risk-count">{attrition?.summary?.avgScore || 0}</span><span>Avg Score</span></div>
          </div>
          <div className="card">
            <div className="card-header"><h3 className="card-title">Employee Attrition Risk Scores</h3></div>
            <div className="table-container">
              <table className="data-table">
                <thead><tr><th>Employee</th><th>Department</th><th>Risk Score</th><th>Level</th><th>Attendance</th><th>Tenure</th><th>Key Factors</th></tr></thead>
                <tbody>
                  {(attrition?.employees || []).map(emp => (
                    <tr key={emp._id}>
                      <td className="font-medium">{emp.name}</td>
                      <td>{emp.department}</td>
                      <td>
                        <div className="risk-bar-wrapper">
                          <div className="risk-bar" style={{ width: `${emp.riskScore}%`, background: emp.riskLevel === 'High' ? 'var(--error)' : emp.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)' }} />
                          <span className="risk-score-label">{emp.riskScore}%</span>
                        </div>
                      </td>
                      <td><span className={`badge ${emp.riskLevel === 'High' ? 'badge-error' : emp.riskLevel === 'Medium' ? 'badge-warning' : 'badge-success'}`}>{emp.riskLevel}</span></td>
                      <td>{emp.attendanceRate}%</td>
                      <td>{emp.tenure} yrs</td>
                      <td className="text-xs text-secondary">{emp.factors.join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Salary Report' && (
        <div>
          <div className="cost-total card">
            <span className="text-sm text-tertiary">Total Company Payroll Cost</span>
            <span className="cost-amount">₹{(costs?.totalCompanyCost || 0).toLocaleString()}</span>
          </div>
          <div className="analytics-grid">
            <div className="card chart-card">
              <div className="card-header"><h3 className="card-title">Cost by Department</h3></div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={costs?.breakdown || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis type="number" stroke="var(--text-tertiary)" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="department" stroke="var(--text-tertiary)" fontSize={12} width={90} />
                  <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} formatter={v => `₹${v.toLocaleString()}`} />
                  <Bar dataKey="totalCost" radius={[0, 8, 8, 0]} name="Total Cost">
                    {(costs?.breakdown || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Cost Breakdown</h3></div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Department</th><th>Headcount</th><th>Total</th><th>Per Employee</th><th>%</th></tr></thead>
                  <tbody>
                    {(costs?.breakdown || []).map((d, i) => (
                      <tr key={i}>
                        <td className="font-medium">{d.department}</td>
                        <td>{d.headcount}</td>
                        <td>₹{d.totalCost.toLocaleString()}</td>
                        <td>₹{d.costPerEmployee.toLocaleString()}</td>
                        <td><span className="badge badge-neutral">{d.percentage}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Payroll Forecast' && (
        <div>
          <div className="card chart-card" style={{ marginBottom: 'var(--space-5)' }}>
            <div className="card-header"><h3 className="card-title">Payroll Trend & Forecast</h3><span className="badge badge-primary">AI Predicted</span></div>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={forecast?.combined || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                <XAxis dataKey="month" stroke="var(--text-tertiary)" fontSize={12} />
                <YAxis stroke="var(--text-tertiary)" fontSize={12} tickFormatter={v => `₹${(v / 100000).toFixed(0)}L`} />
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} formatter={v => `₹${v.toLocaleString()}`} />
                <Legend />
                <Area type="monotone" dataKey="net" stroke="#0071E3" fill="rgba(0,113,227,0.1)" strokeWidth={2} name="Net Payroll" strokeDasharray={(forecast?.combined || []).map(d => d.type === 'forecast' ? '5 5' : 'none').join(' ')} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="analytics-grid">
            <div className="card">
              <div className="card-header"><h3 className="card-title">Historical</h3></div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Month</th><th>Basic</th><th>Bonus</th><th>Deductions</th><th>Net</th><th>Count</th></tr></thead>
                  <tbody>
                    {(forecast?.history || []).map((h, i) => (
                      <tr key={i}><td className="font-medium">{h.month}</td><td>₹{h.basic.toLocaleString()}</td><td>₹{h.bonus.toLocaleString()}</td><td>₹{h.deductions.toLocaleString()}</td><td className="font-semibold">₹{h.net.toLocaleString()}</td><td>{h.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3 className="card-title">Forecast</h3><span className="badge badge-warning">Predicted</span></div>
              <div className="table-container">
                <table className="data-table">
                  <thead><tr><th>Month</th><th>Predicted Net</th><th>Employees</th></tr></thead>
                  <tbody>
                    {(forecast?.forecast || []).map((f, i) => (
                      <tr key={i}><td className="font-medium">{f.month}</td><td className="font-semibold" style={{ color: 'var(--apple-blue)' }}>₹{f.net.toLocaleString()}</td><td>{f.count}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
