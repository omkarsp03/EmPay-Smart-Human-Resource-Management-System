import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { payrollAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import { generatePayslipPDF } from '../utils/payslipPDF';
import { Download, CreditCard, FileText, AlertCircle } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import './Payroll.css';

const COLORS = ['#0071E3', '#34C759', '#FF3B30', '#FF9F0A', '#5AC8FA'];

function formatPayrollMonthLabel(monthKey) {
  if (!monthKey || !String(monthKey).includes('-')) return String(monthKey || '');
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' });
}

function lastNPayrollMonthKeys(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

function mergeChartSeries(apiSeries, nMonths = 6) {
  const map = new Map((apiSeries || []).map((d) => [d.month, d.value]));
  return lastNPayrollMonthKeys(nMonths).map((k) => ({
    month: k,
    name: formatPayrollMonthLabel(k),
    value: map.get(k) ?? 0,
  }));
}

function monthRangeLabel(monthKey) {
  if (!monthKey || !String(monthKey).includes('-')) return String(monthKey || '');
  const [y, m] = monthKey.split('-').map(Number);
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  return `${from.toLocaleDateString('en-GB')} to ${to.toLocaleDateString('en-GB')}`;
}

function formatInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function Payroll() {
  const { user, canManagePayroll } = useAuth();
  const toast = useToast();
  const [records, setRecords] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [processModal, setProcessModal] = useState(false);
  const [processForm, setProcessForm] = useState({ month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [payrollTab, setPayrollTab] = useState('Dashboard');
  const [dashSummary, setDashSummary] = useState(null);
  const [employerCostPeriod, setEmployerCostPeriod] = useState('monthly');
  const [employeeCountPeriod, setEmployeeCountPeriod] = useState('monthly');
  const [payrunFocusMonth, setPayrunFocusMonth] = useState(null);
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [payslipDetail, setPayslipDetail] = useState(null);
  const [payslipLoading, setPayslipLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      const [myPayroll, allPayroll, dashRes] = await Promise.all([
        payrollAPI.getByUser(user._id),
        canManagePayroll ? payrollAPI.getAll({}) : Promise.resolve({ data: { records: [], summary: {} } }),
        canManagePayroll ? payrollAPI.getDashboardSummary().catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setRecords(myPayroll.data.records || []);
      setAllRecords(allPayroll.data.records || []);
      setSummary(allPayroll.data.summary || {});
      setDashSummary(dashRes?.data || null);
    } catch {}
    setLoading(false);
  }, [user?._id, canManagePayroll]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canManagePayroll || payrollTab !== 'Dashboard') return;
    const id = setInterval(() => loadData(), 45000);
    return () => clearInterval(id);
  }, [canManagePayroll, payrollTab, loadData]);

  const employerBars = useMemo(() => {
    const series = mergeChartSeries(dashSummary?.employerCostChart);
    return series.map((d) => ({
      ...d,
      value: employerCostPeriod === 'annual' ? Math.round(d.value * 12) : d.value,
    }));
  }, [dashSummary?.employerCostChart, employerCostPeriod]);

  const employeeBars = useMemo(() => {
    const series = mergeChartSeries(dashSummary?.employeeCountChart);
    return series.map((d) => ({
      ...d,
      value: employeeCountPeriod === 'annual' ? Math.round(d.value * 12) : d.value,
    }));
  }, [dashSummary?.employeeCountChart, employeeCountPeriod]);

  const handleProcess = async () => {
    try {
      await payrollAPI.process(processForm);
      toast.success('Payroll processed successfully!');
      setProcessModal(false);
      loadData();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const openPayslipDetail = async (record) => {
    if (!record?.userId || !record?.month) return;
    setPayslipModalOpen(true);
    setPayslipLoading(true);
    setPayslipDetail(null);
    try {
      const res = await payrollAPI.getPayslipDetail(record.userId, record.month);
      setPayslipDetail(res.data?.payslip || null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load payslip');
      setPayslipModalOpen(false);
    }
    setPayslipLoading(false);
  };

  const downloadPayslip = async (record) => {
    try {
      const res = await payrollAPI.getPayslipDetail(record.userId, record.month);
      generatePayslipPDF(res.data.payslip);
      toast.success('Payslip PDF downloaded!');
    } catch {
      toast.error('Failed to generate payslip');
    }
  };

  const displayRecords = records.length > 0 ? records : (canManagePayroll ? allRecords : records);
  const displayRecordsFiltered = payrunFocusMonth
    ? displayRecords.filter((r) => r.month === payrunFocusMonth)
    : displayRecords;
  const latestPayslip = records[0] || (canManagePayroll ? allRecords[0] : null);

  const breakdownData = latestPayslip ? [
    { name: 'Basic', value: latestPayslip.basicSalary || 0 },
    { name: 'HRA', value: latestPayslip.hra || 0 },
    { name: 'Special', value: latestPayslip.specialAllowance || 0 },
    { name: 'Bonus', value: latestPayslip.bonus || 0 },
  ].filter(item => item.value > 0) : [];

  const taxData = latestPayslip ? [
    { name: 'PF (12%)', amount: latestPayslip.pf || 0 },
    { name: 'TDS', amount: latestPayslip.tds || 0 },
    { name: 'Professional Tax', amount: latestPayslip.pt || 0 },
  ].filter(item => item.amount > 0) : [];

  const employerCostData = summary && Object.keys(summary).length > 0 ? [
    { name: 'Net Pay', value: summary.totalNet },
    { name: 'TDS (Paid to Govt)', value: summary.totalTDS },
    { name: 'PF (Employer/Employee)', value: summary.totalPF * 2 }, // Roughly illustrating cost
  ] : [];

  const isBankMissing = !user?.bankDetails?.accountNo || !user?.bankDetails?.ifsc;
  const payslipGross = payslipDetail
    ? Number((payslipDetail.basicSalary || 0) + (payslipDetail.hra || 0) + (payslipDetail.specialAllowance || 0) + (payslipDetail.bonus || 0))
    : 0;
  const payslipDeductions = payslipDetail
    ? Number((payslipDetail.pf || 0) + (payslipDetail.tds || 0) + (payslipDetail.pt || 0))
    : 0;
  const workedDays = Number(payslipDetail?.workedDays ?? 22);
  const totalDays = Number(payslipDetail?.totalDays ?? 22);
  const paidLeaves = Number(payslipDetail?.paidLeaves ?? 0);

  return (
    <div className="payroll animate-fade-in">
      <div className="page-header">
        <div><h1>Payroll</h1><p className="text-secondary">Salary, taxes & payslips</p></div>
        <div className="page-actions">
          {canManagePayroll && payrollTab === 'Payrun' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={() => toast.info('Validation: review totals and attendance linkage before marking Done.')}>Validate</button>
              <button type="button" className="btn btn-primary" onClick={() => setProcessModal(true)}><CreditCard size={16} /> Payrun</button>
            </>
          )}
        </div>
      </div>

      {canManagePayroll && (
        <div className="att-tabs" style={{ marginBottom: 'var(--space-4)' }}>
          {['Dashboard', 'Payrun', 'Payslips', 'Configuration'].map((t) => (
            <button key={t} type="button" className={`analytics-tab ${payrollTab === t ? 'active' : ''}`} onClick={() => setPayrollTab(t)}>{t}</button>
          ))}
        </div>
      )}

      {canManagePayroll && payrollTab === 'Configuration' && (
        <div className="card" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ marginTop: 0 }}>Configuration</h2>
          <p className="text-secondary">Salary structures, statutory rates (PF, PT), and pay schedules are managed here. Defaults: PF 12% of basic, professional tax slabs, TDS on annualized income.</p>
          <p className="text-secondary">Updates apply to the next payrun. Contact engineering to extend rule engines.</p>
        </div>
      )}

      {isBankMissing && !canManagePayroll && (
        <div className="card" style={{ background: 'var(--warning-10)', borderLeft: '4px solid var(--warning)', padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
          <AlertCircle className="text-warning" size={24} />
          <div>
            <h4 style={{ margin: 0, color: 'var(--warning-700)' }}>Action Required: Missing Bank Details</h4>
            <p className="text-sm text-secondary" style={{ margin: 0 }}>Please update your bank account number and IFSC code in your profile to receive salary payouts.</p>
          </div>
        </div>
      )}

      {canManagePayroll && payrollTab === 'Dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Warnings</h3>
            <p className="text-secondary text-sm" style={{ margin: '0 0 12px' }}>Driven from employee profiles (bank account &amp; manager). Fix in My Profile or Team Directory.</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {(dashSummary?.warnings?.noBank?.length > 0) && (
                <li style={{ marginBottom: 8 }}>
                  <Link to="/employees">{dashSummary.warnings.noBank.length} employee{dashSummary.warnings.noBank.length === 1 ? '' : 's'} without bank A/c</Link>
                  <span className="text-tertiary text-xs" style={{ display: 'block', marginTop: 4 }}>Staff can add details under My Profile → Private info; HR can verify in Team Directory.</span>
                </li>
              )}
              {(dashSummary?.warnings?.noManager?.length > 0) && (
                <li style={{ marginBottom: 8 }}>
                  <Link to="/employees">{dashSummary.warnings.noManager.length} employee{dashSummary.warnings.noManager.length === 1 ? '' : 's'} without manager</Link>
                  <span className="text-tertiary text-xs" style={{ display: 'block', marginTop: 4 }}>Assign a manager in Team Directory.</span>
                </li>
              )}
              {!(dashSummary?.warnings?.noBank?.length) && !(dashSummary?.warnings?.noManager?.length) && (
                <li className="text-tertiary" style={{ listStyle: 'none', marginLeft: -18 }}>No payroll data issues detected.</li>
              )}
            </ul>
          </div>
          <div className="card" style={{ padding: 'var(--space-4)' }}>
            <h3 className="card-title" style={{ marginBottom: 12 }}>Payrun</h3>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
              {(dashSummary?.payruns || []).length === 0 && (
                <li className="text-tertiary">No payruns yet. Process payroll under the Payrun tab.</li>
              )}
              {(dashSummary?.payruns || []).slice(0, 8).map((p) => (
                <li key={p.month} style={{ marginBottom: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', height: 'auto', padding: '6px 8px', fontWeight: 500 }}
                    onClick={() => {
                      setPayrollTab('Payrun');
                      setPayrunFocusMonth(p.month);
                    }}
                  >
                    {p.label}
                    <span className="badge badge-success" style={{ marginLeft: 8 }}>{p.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {canManagePayroll && payrollTab === 'Dashboard' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 className="card-title">Employer cost</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={`btn btn-sm ${employerCostPeriod === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEmployerCostPeriod('monthly')}>Monthly</button>
                <button type="button" className={`btn btn-sm ${employerCostPeriod === 'annual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEmployerCostPeriod('annual')}>Annually</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={employerBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(1)}L`} />
                <Tooltip formatter={(v) => [`₹${Number(v).toLocaleString()}`, employerCostPeriod === 'annual' ? 'Annualized (×12)' : 'Monthly']} />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <h3 className="card-title">Employee count</h3>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={`btn btn-sm ${employeeCountPeriod === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEmployeeCountPeriod('monthly')}>Monthly</button>
                <button type="button" className={`btn btn-sm ${employeeCountPeriod === 'annual' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setEmployeeCountPeriod('annual')}>Annually</button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={employeeBars}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <Tooltip formatter={(v) => [v, employeeCountPeriod === 'annual' ? 'Employee-months (×12)' : 'Headcount']} />
                <Bar dataKey="value" fill="#34C759" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {canManagePayroll && payrollTab === 'Dashboard' && summary.count > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
          <div className="card" style={{ padding: 'var(--space-4)' }}><span className="text-sm text-secondary">Employees Processed</span><h3 style={{ margin: 0 }}>{summary.count}</h3></div>
          <div className="card" style={{ padding: 'var(--space-4)' }}><span className="text-sm text-secondary">Total Net Payout</span><h3 style={{ margin: 0 }}>₹{summary.totalNet?.toLocaleString()}</h3></div>
          <div className="card" style={{ padding: 'var(--space-4)' }}><span className="text-sm text-secondary">Total TDS Deducted</span><h3 style={{ margin: 0 }}>₹{summary.totalTDS?.toLocaleString()}</h3></div>
          <div className="card" style={{ padding: 'var(--space-4)' }}><span className="text-sm text-secondary">Total PF Contributions</span><h3 style={{ margin: 0 }}>₹{summary.totalPF?.toLocaleString()}</h3></div>
        </div>
      )}

      {latestPayslip && (!canManagePayroll || payrollTab === 'Payrun') && (
        <div className="payslip-card card">
          <div className="payslip-header">
            <div><h3>Latest Payslip</h3><span className="text-secondary text-sm">{latestPayslip.month}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => downloadPayslip(latestPayslip)}><Download size={14} /> Download PDF</button>
              <button className="btn btn-ghost btn-sm" onClick={() => openPayslipDetail(latestPayslip)}><FileText size={14} /> View</button>
              <div className="payslip-net">
                <span className="text-sm text-tertiary">Net Salary</span>
                <span className="payslip-amount">₹{latestPayslip.netSalary?.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="payslip-grid">
            <div className="payslip-item"><span className="payslip-label">Basic Salary</span><span className="payslip-value">₹{latestPayslip.basicSalary?.toLocaleString()}</span></div>
            <div className="payslip-item"><span className="payslip-label">Bonus</span><span className="payslip-value" style={{ color: 'var(--success)' }}>+₹{latestPayslip.bonus?.toLocaleString()}</span></div>
            <div className="payslip-item"><span className="payslip-label">PF (12%)</span><span className="payslip-value" style={{ color: 'var(--error)' }}>-₹{(latestPayslip.pf || Math.round(latestPayslip.basicSalary * 0.12)).toLocaleString()}</span></div>
            <div className="payslip-item"><span className="payslip-label">TDS</span><span className="payslip-value" style={{ color: 'var(--error)' }}>-₹{(latestPayslip.tds || 0).toLocaleString()}</span></div>
            <div className="payslip-item"><span className="payslip-label">Prof. Tax</span><span className="payslip-value" style={{ color: 'var(--error)' }}>-₹{(latestPayslip.pt || 200).toLocaleString()}</span></div>
            <div className="payslip-item"><span className="payslip-label">Pay Date</span><span className="payslip-value">{new Date(latestPayslip.payDate).toLocaleDateString()}</span></div>
          </div>
        </div>
      )}

      {/* Tax Summary */}
      {taxData.length > 0 && (!canManagePayroll || payrollTab === 'Payrun') && (
        <div className="tax-summary card">
          <div className="card-header"><h3 className="card-title">Tax Deductions Summary</h3></div>
          <div className="tax-grid">
            {taxData.map((t, i) => (
              <div key={i} className="tax-item">
                <span className="tax-name">{t.name}</span>
                <span className="tax-amount">₹{t.amount.toLocaleString()}</span>
              </div>
            ))}
            <div className="tax-item tax-total">
              <span className="tax-name">Total Deductions</span>
              <span className="tax-amount">₹{taxData.reduce((s, t) => s + t.amount, 0).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      <div className="payroll-charts">
        {breakdownData.length > 0 && !canManagePayroll && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Salary Breakdown</h3></div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={breakdownData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="value">
                  {breakdownData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} formatter={v => `₹${v.toLocaleString()}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {employerCostData.length > 0 && canManagePayroll && payrollTab === 'Payrun' && (
          <div className="card">
            <div className="card-header"><h3 className="card-title">Employer Cost Breakdown (Overview)</h3></div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={employerCostData} layout="vertical" margin={{ top: 10, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: 8 }} formatter={v => `₹${v.toLocaleString()}`} />
                <Bar dataKey="value" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card" style={{ display: (!canManagePayroll || payrollTab === 'Payrun') ? 'block' : 'none' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <h3 className="card-title">Payroll History</h3>
            {canManagePayroll && (
              <span className="badge badge-primary">{payrunFocusMonth ? `${displayRecordsFiltered.length} in ${payrunFocusMonth}` : `${displayRecords.length} records`}</span>
            )}
            {canManagePayroll && payrunFocusMonth && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPayrunFocusMonth(null)}>Show all</button>
            )}
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr>{canManagePayroll && <th>Employee</th>}<th>Month</th><th>Basic</th><th>PF</th><th>TDS</th><th>Net</th><th></th></tr></thead>
              <tbody>
                {loading ? Array(3).fill(0).map((_, i) => (
                  <tr key={i}>{Array(canManagePayroll ? 7 : 6).fill(0).map((_, j) => <td key={j}><div className="skeleton skeleton-text" /></td>)}</tr>
                )) : displayRecordsFiltered.length === 0 ? (
                  <tr><td colSpan={canManagePayroll ? 7 : 6} className="table-empty">No payroll records</td></tr>
                ) : displayRecordsFiltered.slice(0, 40).map(r => (
                  <tr key={r._id}>
                    {canManagePayroll && <td className="font-medium">{r.userName || '—'}</td>}
                    <td className="font-medium">{r.month}</td>
                    <td>₹{r.basicSalary?.toLocaleString()}</td>
                    <td className="text-xs" style={{ color: 'var(--error)' }}>₹{(r.pf || 0).toLocaleString()}</td>
                    <td className="text-xs" style={{ color: 'var(--error)' }}>₹{(r.tds || 0).toLocaleString()}</td>
                    <td className="font-semibold">₹{r.netSalary?.toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openPayslipDetail(r)} title="View payslip"><FileText size={14} /></button>
                        <button className="btn btn-ghost btn-icon btn-sm" onClick={() => downloadPayslip(r)} title="Download PDF"><Download size={14} /></button>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {canManagePayroll && payrollTab === 'Payslips' && (
        <div className="card" style={{ marginTop: 'var(--space-4)' }}>
          <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ minWidth: 220 }}>
              <h3 className="card-title">Payslip list view</h3>
              <p className="text-secondary text-sm" style={{ margin: '4px 0 0' }}>Click a row to view a payslip; download PDF anytime.</p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {payrunFocusMonth && <span className="badge badge-primary">Filtered: {payrunFocusMonth}</span>}
              {payrunFocusMonth && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPayrunFocusMonth(null)}>Clear filter</button>}
            </div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Payrun</th>
                  <th>Basic</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array(4).fill(0).map((_, i) => (
                    <tr key={i}>
                      {Array(7).fill(0).map((__, j) => (
                        <td key={j}><div className="skeleton skeleton-text" /></td>
                      ))}
                    </tr>
                  ))
                ) : displayRecordsFiltered.length === 0 ? (
                  <tr><td colSpan={7} className="table-empty">No payslips found</td></tr>
                ) : (
                  displayRecordsFiltered.slice(0, 60).map((r) => {
                    const gross = (r.basicSalary || 0) + (r.hra || 0) + (r.specialAllowance || 0) + (r.bonus || 0);
                    const ded = (r.pf || 0) + (r.tds || 0) + (r.pt || 0);
                    return (
                      <tr key={r._id} style={{ cursor: 'pointer' }} onClick={() => openPayslipDetail(r)} title="Open payslip">
                        <td className="font-medium">{r.userName || '—'}</td>
                        <td>{r.month}</td>
                        <td>₹{(r.basicSalary || 0).toLocaleString()}</td>
                        <td>₹{gross.toLocaleString()}</td>
                        <td className="text-xs" style={{ color: 'var(--error)' }}>₹{ded.toLocaleString()}</td>
                        <td className="font-semibold">₹{(r.netSalary || 0).toLocaleString()}</td>
                        <td><span className="badge badge-success">Done</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={processModal} onClose={() => setProcessModal(false)} title="Process Payroll (Bulk)" size="sm" footer={
        <><button className="btn btn-secondary" onClick={() => setProcessModal(false)}>Cancel</button><button className="btn btn-primary" onClick={handleProcess}>Process All</button></>
      }>
        <div className="modal-form">
          <p className="text-sm text-secondary" style={{ marginBottom: 'var(--space-3)' }}>This will calculate salaries with automated TDS, PF (12%), and Professional Tax for <strong>all employees</strong>.</p>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Month</label><select className="input" value={processForm.month} onChange={e => setProcessForm(p => ({ ...p, month: +e.target.value }))}>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(0, i).toLocaleString('en', { month: 'long' })}</option>)}</select></div>
            <div className="form-group"><label className="form-label">Year</label><input className="input" type="number" value={processForm.year} onChange={e => setProcessForm(p => ({ ...p, year: +e.target.value }))} /></div>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={payslipModalOpen}
        onClose={() => { setPayslipModalOpen(false); setPayslipDetail(null); }}
        title="Payslip"
        size="lg"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setPayslipModalOpen(false)}>Close</button>
            {payslipDetail && (
              <button type="button" className="btn btn-primary" onClick={() => generatePayslipPDF(payslipDetail)}>
                <Download size={16} /> Download PDF
              </button>
            )}
          </>
        }
      >
        {payslipLoading ? (
          <div className="modal-form">
            <div className="skeleton skeleton-text" style={{ height: 18, width: '40%', marginBottom: 12 }} />
            <div className="skeleton skeleton-text" style={{ height: 18, width: '60%', marginBottom: 12 }} />
            <div className="skeleton skeleton-text" style={{ height: 220, width: '100%', marginBottom: 12 }} />
          </div>
        ) : !payslipDetail ? (
          <div className="text-secondary">No payslip details available.</div>
        ) : (
          <div className="payslip-preview">
            <div className="payslip-preview-header">
              <div className="payslip-preview-logo">[Company Logo]</div>
              <h3>Salary slip for month of {formatPayrollMonthLabel(payslipDetail.month)}</h3>
            </div>

            <div className="payslip-preview-employee">
              <div className="payslip-kv-grid">
                <div><span>Employee name</span><strong>{payslipDetail.employee?.name || '—'}</strong></div>
                <div><span>Emp id</span><strong>{payslipDetail.employee?._id?.slice(-6)?.toUpperCase() || '—'}</strong></div>
                <div><span>Employee code</span><strong>{payslipDetail.employee?.employeeCode || '—'}</strong></div>
                <div><span>PAN</span><strong>{payslipDetail.employee?.bankDetails?.pan || '—'}</strong></div>
                <div><span>Department</span><strong>{payslipDetail.employee?.department || '—'}</strong></div>
                <div><span>UAN</span><strong>{payslipDetail.employee?.bankDetails?.uan || '—'}</strong></div>
                <div><span>Location</span><strong>{payslipDetail.employee?.location || '—'}</strong></div>
                <div><span>Bank A/c no.</span><strong>{payslipDetail.employee?.bankDetails?.accountNo || '—'}</strong></div>
                <div><span>Date of joining</span><strong>{payslipDetail.employee?.joiningDate ? new Date(payslipDetail.employee.joiningDate).toLocaleDateString('en-GB') : '—'}</strong></div>
                <div><span>Pay period</span><strong>{monthRangeLabel(payslipDetail.month)}</strong></div>
                <div><span>Pay date</span><strong>{payslipDetail.payDate ? new Date(payslipDetail.payDate).toLocaleDateString('en-GB') : '—'}</strong></div>
              </div>
            </div>

            <div className="payslip-preview-worked-days">
              <div><span>Worked days</span><strong>{workedDays}</strong></div>
              <div><span>Paid leaves</span><strong>{paidLeaves}</strong></div>
              <div><span>Total days</span><strong>{totalDays}</strong></div>
            </div>

            <div className="payslip-preview-table">
              <div className="payslip-table-head">
                <span>Earnings</span>
                <span>Amount</span>
                <span>Deductions</span>
                <span>Amount</span>
              </div>
              <div className="payslip-table-body">
                {(payslipDetail.earnings || []).map((earning, index) => {
                  const deduction = payslipDetail.deductionsList?.[index];
                  return (
                    <div className="payslip-row" key={`${earning.label}-${index}`}>
                      <span>{earning.label}</span>
                      <span>{formatInr(earning.amount)}</span>
                      <span>{deduction?.label || '—'}</span>
                      <span>{deduction ? formatInr(deduction.amount) : formatInr(0)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="payslip-table-total">
                <span>Gross</span>
                <span>{formatInr(payslipGross)}</span>
                <span>Total deductions</span>
                <span>{formatInr(payslipDeductions)}</span>
              </div>
            </div>

            <div className="payslip-preview-net">
              <div>
                <strong>Total Net Payable</strong>
                <small>(Gross earning - Total deductions)</small>
              </div>
              <span>{formatInr(payslipDetail.netSalary || 0)}</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
