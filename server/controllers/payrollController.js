const { db, findById, findByQuery, insertOne } = require('../config/db');

// Tax calculation helpers
const calculateTDS = (annualSalary) => {
  // Indian TDS slabs (simplified)
  if (annualSalary <= 300000) return 0;
  if (annualSalary <= 600000) return Math.round((annualSalary - 300000) * 0.05 / 12);
  if (annualSalary <= 900000) return Math.round((15000 + (annualSalary - 600000) * 0.10) / 12);
  if (annualSalary <= 1200000) return Math.round((45000 + (annualSalary - 900000) * 0.15) / 12);
  if (annualSalary <= 1500000) return Math.round((90000 + (annualSalary - 1200000) * 0.20) / 12);
  return Math.round((150000 + (annualSalary - 1500000) * 0.30) / 12);
};

const calculatePF = (basic) => Math.round(basic * 0.12); // 12% of basic
const calculatePT = (gross) => {
  // Professional Tax (Maharashtra slab)
  if (gross <= 7500) return 0;
  if (gross <= 10000) return 175;
  return 200; // Max ₹200/month (₹300 in Feb)
};

// GET /api/payroll/:userId
const getPayroll = (req, res, next) => {
  try {
    const { userId } = req.params;
    if (req.user.role === 'Employee' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const records = findByQuery('payroll', { userId });
    records.sort((a, b) => new Date(b.payDate) - new Date(a.payDate));
    const user = findById('users', userId);
    res.json({
      records,
      employee: user ? { name: user.name, department: user.department, role: user.role } : null,
    });
  } catch (error) { next(error); }
};

// GET /api/payroll
const getAllPayroll = (req, res, next) => {
  try {
    const { month, department } = req.query;
    let records = [...db.payroll];
    if (month) records = records.filter(r => r.month === month);
    if (department) {
      records = records.filter(r => {
        const user = findById('users', r.userId);
        return user && user.department === department;
      });
    }
    const enriched = records.map(record => {
      const user = findById('users', record.userId);
      return { ...record, userName: user ? user.name : 'Unknown', userDepartment: user ? user.department : 'Unknown', userRole: user ? user.role : 'Unknown' };
    });
    const totalBasic = records.reduce((sum, r) => sum + r.basicSalary, 0);
    const totalBonus = records.reduce((sum, r) => sum + r.bonus, 0);
    const totalDeductions = records.reduce((sum, r) => sum + r.deductions, 0);
    const totalNet = records.reduce((sum, r) => sum + r.netSalary, 0);
    const totalTDS = records.reduce((sum, r) => sum + (r.tds || 0), 0);
    const totalPF = records.reduce((sum, r) => sum + (r.pf || 0), 0);
    const totalPT = records.reduce((sum, r) => sum + (r.pt || 0), 0);
    res.json({
      records: enriched,
      summary: { totalBasic, totalBonus, totalDeductions, totalNet, totalTDS, totalPF, totalPT, count: records.length },
    });
  } catch (error) { next(error); }
};

// POST /api/payroll/process
const processPayroll = (req, res, next) => {
  try {
    const { month, year } = req.body;
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    const existing = db.payroll.filter(p => p.month === monthStr);
    if (existing.length > 0) {
      return res.status(400).json({ message: `Payroll already processed for ${monthStr}.` });
    }

    const employees = db.users.filter(u => u.status === 'Active' && u.role !== 'Admin');
    const payrollRecords = [];
    const baseSalaries = { Engineering: 85000, Design: 75000, Marketing: 70000, Sales: 72000, HR: 68000, Finance: 78000, Operations: 65000, General: 60000 };

    employees.forEach(emp => {
      const gross = baseSalaries[emp.department] || 60000;
      const bonus = Math.floor(Math.random() * 10000);
      const totalGross = gross + bonus;

      // Salary Components
      const basicSalary = Math.round(gross * 0.50);
      const hra = Math.round(basicSalary * 0.40);
      const specialAllowance = gross - basicSalary - hra;
      const da = 0; // Not used in this structure

      // Tax calculations
      const annualSalary = totalGross * 12;
      const tds = calculateTDS(annualSalary);
      const pf = calculatePF(basicSalary);
      const pt = calculatePT(gross);
      const totalDeductions = tds + pf + pt;
      const netSalary = totalGross - totalDeductions;

      const record = insertOne('payroll', {
        userId: emp._id, basicSalary, bonus,
        deductions: totalDeductions, tds, pf, pt,
        hra, da, specialAllowance,
        netSalary, payDate: new Date().toISOString(), month: monthStr,
      });
      payrollRecords.push(record);

      insertOne('notifications', {
        userId: emp._id,
        message: `Your payslip for ${monthStr} is ready. Net salary: ₹${netSalary.toLocaleString()}`,
        type: 'payroll', readStatus: false,
      });
    });

    insertOne('activityLogs', {
      userId: req.user.id, action: 'Payroll Processed',
      details: `Processed payroll for ${monthStr} - ${payrollRecords.length} employees. Total: ₹${payrollRecords.reduce((s, r) => s + r.netSalary, 0).toLocaleString()}`,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({ message: `Payroll processed for ${payrollRecords.length} employees.`, records: payrollRecords });
  } catch (error) { next(error); }
};

// GET /api/payroll/:userId/payslip/:month — Get detailed payslip data for PDF
const getPayslipDetail = (req, res, next) => {
  try {
    const { userId, month } = req.params;
    if (req.user.role === 'Employee' && req.user.id !== userId) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    const record = db.payroll.find(p => p.userId === userId && p.month === month);
    if (!record) return res.status(404).json({ message: 'Payslip not found.' });
    const user = findById('users', userId);

    res.json({
      payslip: {
        ...record,
        employee: {
          name: user?.name, email: user?.email, department: user?.department,
          role: user?.role, phone: user?.phone, joinDate: user?.joinDate,
          bankDetails: user?.bankDetails,
        },
        company: {
          name: 'EmPay Technologies Pvt. Ltd.',
          address: '123 Tech Park, Pune, Maharashtra 411001',
          cin: 'U72900MH2024PTC123456',
        },
        earnings: [
          { label: 'Basic Salary', amount: record.basicSalary },
          { label: 'House Rent Allowance (HRA)', amount: record.hra },
          { label: 'Standard/Special Allowance', amount: record.specialAllowance },
          { label: 'Bonus', amount: record.bonus },
        ],
        deductionsList: [
          { label: 'Provident Fund (PF)', amount: record.pf },
          { label: 'TDS (Income Tax)', amount: record.tds },
          { label: 'Professional Tax', amount: record.pt },
        ],
      },
    });
  } catch (error) { next(error); }
};

// GET /api/payroll/dashboard/summary — warnings + payruns + chart series
const getPayrollDashboardSummary = (req, res, next) => {
  try {
    const active = db.users.filter((u) => u.status === 'Active' && u.role !== 'Admin');
    const noBank = active
      .filter((u) => !(u.bankDetails && String(u.bankDetails.accountNo || '').trim()))
      .map((u) => ({ _id: u._id, name: u.name, email: u.email }));
    const noManager = active.filter((u) => !u.managerId).map((u) => ({ _id: u._id, name: u.name, email: u.email }));

    const months = [...new Set(db.payroll.map((p) => p.month))].filter(Boolean).sort().reverse();
    const payruns = months.slice(0, 8).map((m) => {
      const rows = db.payroll.filter((p) => p.month === m);
      const [y, mo] = m.split('-');
      const labelMonth = new Date(parseInt(y, 10), parseInt(mo, 10) - 1, 1).toLocaleString('en', { month: 'short', year: 'numeric' });
      return {
        month: m,
        label: `Payrun for ${labelMonth} (${rows.length} Payslip)`,
        count: rows.length,
        employerCost: rows.reduce(
          (s, r) => s + (r.basicSalary || 0) + (r.hra || 0) + (r.bonus || 0) + (r.specialAllowance || 0) + (r.pf || 0),
          0
        ),
        gross: rows.reduce(
          (s, r) => s + (r.basicSalary || 0) + (r.hra || 0) + (r.bonus || 0) + (r.specialAllowance || 0),
          0
        ),
        net: rows.reduce((s, r) => s + (r.netSalary || 0), 0),
        status: 'Done',
      };
    });

    const monthlyEmployer = {};
    const headcountByMonth = {};
    db.payroll.forEach((p) => {
      const m = p.month;
      if (!m) return;
      monthlyEmployer[m] =
        (monthlyEmployer[m] || 0) + (p.netSalary || 0) + (p.pf || 0) * 2;
    });
    months.forEach((m) => {
      const ids = new Set(db.payroll.filter((p) => p.month === m).map((p) => p.userId));
      headcountByMonth[m] = ids.size;
    });
    const chartKeys = [...new Set(db.payroll.map((p) => p.month))].filter(Boolean).sort().slice(-6);
    const employerCostChart = chartKeys.map((k) => ({ month: k, value: monthlyEmployer[k] || 0 }));
    const employeeCountChart = chartKeys.map((k) => ({ month: k, value: headcountByMonth[k] || 0 }));

    res.json({
      warnings: { noBank, noManager },
      payruns,
      employerCostChart,
      employeeCountChart,
    });
  } catch (e) {
    next(e);
  }
};

function buildStatementPayloadFromRecords(records, user) {
  const latest = [...records].sort((a, b) => String(b.month).localeCompare(String(a.month)))[0];
  const sum = (field) => records.reduce((s, r) => s + (r[field] || 0), 0);
  const grossMonthly =
    (latest.basicSalary || 0) +
    (latest.hra || 0) +
    (latest.specialAllowance || 0) +
    (latest.bonus || 0);
  const earnings = [
    { name: 'Basic', monthly: latest.basicSalary || 0, yearly: sum('basicSalary') },
    { name: 'HRA', monthly: latest.hra || 0, yearly: records.reduce((s, r) => s + (r.hra || 0), 0) },
    {
      name: 'Standard Allowance',
      monthly: latest.specialAllowance || 0,
      yearly: records.reduce((s, r) => s + (r.specialAllowance || 0), 0),
    },
    { name: 'Performance Bonus', monthly: latest.bonus || 0, yearly: sum('bonus') },
  ].filter((e) => e.monthly > 0 || e.yearly > 0);
  const deductions = [
    { name: 'PF (Employee)', monthly: latest.pf || 0, yearly: records.reduce((s, r) => s + (r.pf || 0), 0) },
    { name: 'TDS', monthly: latest.tds || 0, yearly: sum('tds') },
    { name: 'Professional Tax', monthly: latest.pt || 0, yearly: sum('pt') },
  ];
  const netMonthly = grossMonthly - ((latest.pf || 0) + (latest.tds || 0) + (latest.pt || 0));
  const netYearly = records.reduce((s, r) => s + (r.netSalary || 0), 0);
  return {
    employee: {
      name: user.name,
      designation: user.designation || user.role,
      dateOfJoining: user.joinDate,
      salaryEffectiveFrom: user.salaryEffectiveFrom || user.joinDate,
      companyName: user.companyName || 'Company',
    },
    earnings,
    deductions,
    netMonthly,
    netYearly,
  };
}

/** When user has no payslip rows — same department defaults as payroll processing */
function buildSyntheticSalaryStatement(user) {
  const baseSalaries = {
    Engineering: 85000,
    Design: 75000,
    Marketing: 70000,
    Sales: 72000,
    HR: 68000,
    Finance: 78000,
    Operations: 65000,
    General: 60000,
  };
  const gross = baseSalaries[user.department] || 60000;
  const bonus = Math.round(gross * 0.05);
  const totalMonthlyGross = gross + bonus;
  const basicSalary = Math.round(gross * 0.5);
  const hra = Math.round(basicSalary * 0.4);
  const specialAllowance = Math.max(0, gross - basicSalary - hra);
  const pf = calculatePF(basicSalary);
  const annualSalary = totalMonthlyGross * 12;
  const tds = calculateTDS(annualSalary);
  const pt = calculatePT(gross);
  const netMonthly = totalMonthlyGross - pf - tds - pt;
  const earnings = [
    { name: 'Basic', monthly: basicSalary, yearly: basicSalary * 12 },
    { name: 'HRA', monthly: hra, yearly: hra * 12 },
    { name: 'Standard Allowance', monthly: specialAllowance, yearly: specialAllowance * 12 },
    { name: 'Performance Bonus', monthly: bonus, yearly: bonus * 12 },
  ].filter((e) => e.monthly > 0 || e.yearly > 0);
  const deductions = [
    { name: 'PF (Employee)', monthly: pf, yearly: pf * 12 },
    { name: 'TDS', monthly: tds, yearly: tds * 12 },
    { name: 'Professional Tax', monthly: pt, yearly: pt * 12 },
  ];
  return {
    employee: {
      name: user.name,
      designation: user.designation || user.role,
      dateOfJoining: user.joinDate,
      salaryEffectiveFrom: user.salaryEffectiveFrom || user.joinDate,
      companyName: user.companyName || 'Company',
    },
    earnings,
    deductions,
    netMonthly,
    netYearly: netMonthly * 12,
  };
}

// GET /api/payroll/report/salary-statement/:userId?year=
const getSalaryStatement = (req, res, next) => {
  try {
    const { userId } = req.params;
    const requestedYear = String(req.query.year || new Date().getFullYear());
    const user = findById('users', userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    const allForUser = db.payroll
      .filter((p) => p.userId === userId && p.month)
      .sort((a, b) => String(b.month).localeCompare(String(a.month)));

    let records = allForUser.filter((p) => p.month.startsWith(requestedYear));
    const meta = {
      requestedYear,
      appliedYear: requestedYear,
      yearNote: null,
      generated: false,
    };

    if (!records.length && allForUser.length) {
      const latestYear = allForUser[0].month.substring(0, 4);
      records = allForUser.filter((p) => p.month.startsWith(latestYear));
      meta.appliedYear = latestYear;
      if (latestYear !== requestedYear) {
        meta.yearNote = `No payroll for ${requestedYear}; showing ${latestYear} (latest available in system).`;
      }
    }

    if (!records.length) {
      const synthetic = buildSyntheticSalaryStatement(user);
      return res.json({
        ...synthetic,
        meta: {
          ...meta,
          appliedYear: null,
          yearNote:
            'No payslip history for this employee; amounts are projected from the standard salary structure for their department.',
          generated: true,
        },
      });
    }

    const payload = buildStatementPayloadFromRecords(records, user);
    res.json({ ...payload, meta });
  } catch (e) {
    next(e);
  }
};

module.exports = {
  getPayroll,
  getAllPayroll,
  processPayroll,
  getPayslipDetail,
  getPayrollDashboardSummary,
  getSalaryStatement,
};
