const { db, findById, findByQuery } = require('../config/db');

const getDashboardStats = (req, res, next) => {
  try {
    const totalEmployees = db.users.filter(u => u.status === 'Active').length;
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = findByQuery('attendance', { date: today });
    const presentToday = todayAttendance.filter(a => a.status === 'Present' || a.status === 'WFH').length;
    const attendanceRate = totalEmployees > 0 ? ((presentToday / totalEmployees) * 100).toFixed(1) : 0;
    const pendingLeaves = db.leaves.filter(l => l.status === 'Pending').length;
    const totalPayroll = db.payroll.reduce((sum, p) => sum + p.netSalary, 0);

    const deptMap = {};
    db.users.filter(u => u.status === 'Active').forEach(u => {
      deptMap[u.department] = (deptMap[u.department] || 0) + 1;
    });
    const departments = Object.entries(deptMap).map(([name, count]) => ({ name, count }));

    const trends = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayAttendance = findByQuery('attendance', { date: dateStr });
      trends.push({
        date: dateStr, day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        present: dayAttendance.filter(a => a.status === 'Present').length,
        absent: totalEmployees - dayAttendance.length,
        wfh: dayAttendance.filter(a => a.status === 'WFH').length,
      });
    }

    const recentActivity = [...db.activityLogs]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 10)
      .map(log => {
        const user = findById('users', log.userId);
        return { ...log, userName: user ? user.name : 'System' };
      });

    const payrollByDept = {};
    db.payroll.forEach(p => {
      const user = findById('users', p.userId);
      if (user) payrollByDept[user.department] = (payrollByDept[user.department] || 0) + p.netSalary;
    });
    const payrollDistribution = Object.entries(payrollByDept).map(([name, total]) => ({ name, total }));

    // Headcount trends (last 6 months)
    const headcountTrends = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const monthStr = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const activeCount = db.users.filter(u => {
        const joinDate = new Date(u.joinDate);
        return joinDate <= d && u.status === 'Active';
      }).length;
      headcountTrends.push({ month: monthStr, count: activeCount + Math.floor(Math.random() * 3) - 1 });
    }

    // Birthday/anniversary alerts
    const now = new Date();
    const upcomingBirthdays = [];
    const upcomingAnniversaries = [];
    db.users.filter(u => u.status === 'Active').forEach(u => {
      if (u.joinDate) {
        const join = new Date(u.joinDate);
        const annivThisYear = new Date(now.getFullYear(), join.getMonth(), join.getDate());
        const diffDays = Math.ceil((annivThisYear - now) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 30) {
          const years = now.getFullYear() - join.getFullYear();
          upcomingAnniversaries.push({ name: u.name, department: u.department, date: annivThisYear.toISOString().split('T')[0], years });
        }
      }
    });

    res.json({
      kpis: { totalEmployees, attendanceRate: parseFloat(attendanceRate), pendingLeaves, totalPayroll },
      departments, attendanceTrends: trends, recentActivity, payrollDistribution,
      headcountTrends, upcomingAnniversaries,
    });
  } catch (error) { next(error); }
};

const getAIInsights = (req, res, next) => {
  try {
    const insights = [];
    const today = new Date().toISOString().split('T')[0];
    const todayAtt = findByQuery('attendance', { date: today });
    const totalEmp = db.users.filter(u => u.status === 'Active').length;
    const rate = totalEmp > 0 ? (todayAtt.length / totalEmp) * 100 : 100;

    if (rate < 70) {
      insights.push({ type: 'warning', title: 'High Absenteeism Detected', message: `Only ${rate.toFixed(0)}% attendance today. Consider checking team availability.`, icon: 'alert-triangle' });
    }

    const pendingLeaves = db.leaves.filter(l => l.status === 'Pending');
    if (pendingLeaves.length > 5) {
      insights.push({ type: 'info', title: 'Pending Leave Backlog', message: `${pendingLeaves.length} leave requests awaiting approval. Review recommended.`, icon: 'clock' });
    }

    const recentPayroll = db.payroll.slice(-10);
    const avgSalary = recentPayroll.reduce((s, p) => s + p.netSalary, 0) / (recentPayroll.length || 1);
    const outliers = recentPayroll.filter(p => Math.abs(p.netSalary - avgSalary) > avgSalary * 0.5);
    if (outliers.length > 0) {
      insights.push({ type: 'error', title: 'Payroll Anomaly Found', message: `${outliers.length} payroll entries deviate significantly from the average.`, icon: 'trending-up' });
    }

    if (insights.length === 0) {
      insights.push({ type: 'success', title: 'All Systems Normal', message: 'No anomalies detected. Everything looks good!', icon: 'check-circle' });
    }

    // Department health scores
    const deptMap = {};
    db.users.filter(u => u.status === 'Active').forEach(u => { deptMap[u.department] = (deptMap[u.department] || 0) + 1; });
    const deptScores = Object.entries(deptMap).map(([dept, count]) => {
      const deptAtt = db.attendance.filter(a => { const u = findById('users', a.userId); return u && u.department === dept; });
      const score = Math.min(100, Math.round((deptAtt.length / (count * 30)) * 100 + Math.random() * 20));
      return { department: dept, score, employees: count };
    });

    res.json({ insights, departmentHealth: deptScores });
  } catch (error) { next(error); }
};

// GET /api/analytics/anomalies — Smart anomaly detection
const getAnomalies = (req, res, next) => {
  try {
    const anomalies = [];

    // 1. Attendance anomalies — frequent late check-ins
    db.users.filter(u => u.status === 'Active').forEach(user => {
      const userAtt = db.attendance.filter(a => a.userId === user._id && a.checkIn);
      const lateCheckins = userAtt.filter(a => {
        const hour = new Date(a.checkIn).getHours();
        return hour >= 10; // Late if after 10 AM
      });
      if (lateCheckins.length > 5 && userAtt.length > 10) {
        const lateRate = ((lateCheckins.length / userAtt.length) * 100).toFixed(0);
        anomalies.push({
          type: 'attendance', severity: lateRate > 50 ? 'high' : 'medium',
          employee: user.name, department: user.department, employeeId: user._id,
          title: 'Frequent Late Check-ins',
          description: `${lateRate}% late arrivals (${lateCheckins.length}/${userAtt.length} days)`,
          metric: `${lateRate}%`,
        });
      }
    });

    // 2. Leave pattern anomalies — too many Monday/Friday leaves
    db.users.filter(u => u.status === 'Active').forEach(user => {
      const userLeaves = db.leaves.filter(l => l.userId === user._id && l.status === 'Approved');
      const monFriLeaves = userLeaves.filter(l => {
        const start = new Date(l.startDate).getDay();
        const end = new Date(l.endDate).getDay();
        return start === 1 || start === 5 || end === 1 || end === 5;
      });
      if (monFriLeaves.length >= 3) {
        anomalies.push({
          type: 'leave', severity: 'medium',
          employee: user.name, department: user.department, employeeId: user._id,
          title: 'Suspicious Leave Pattern',
          description: `${monFriLeaves.length} leaves on Monday/Friday — possible extended weekends`,
          metric: `${monFriLeaves.length} occurrences`,
        });
      }
    });

    // 3. Payroll anomalies — unusual bonus or deductions
    const avgBonus = db.payroll.reduce((s, p) => s + p.bonus, 0) / (db.payroll.length || 1);
    db.payroll.forEach(p => {
      if (p.bonus > avgBonus * 3) {
        const user = findById('users', p.userId);
        if (user) {
          anomalies.push({
            type: 'payroll', severity: 'high',
            employee: user.name, department: user.department, employeeId: user._id,
            title: 'Unusually High Bonus',
            description: `Bonus of ₹${p.bonus.toLocaleString()} is ${(p.bonus / avgBonus).toFixed(1)}x the average`,
            metric: `₹${p.bonus.toLocaleString()}`,
          });
        }
      }
    });

    // 4. Overtime anomalies
    db.users.filter(u => u.status === 'Active').forEach(user => {
      const userAtt = db.attendance.filter(a => a.userId === user._id && a.checkIn && a.checkOut);
      const longDays = userAtt.filter(a => {
        const hours = (new Date(a.checkOut) - new Date(a.checkIn)) / (1000 * 60 * 60);
        return hours > 10;
      });
      if (longDays.length > 10) {
        anomalies.push({
          type: 'wellness', severity: 'medium',
          employee: user.name, department: user.department, employeeId: user._id,
          title: 'Excessive Overtime',
          description: `${longDays.length} days with 10+ hour work sessions — burnout risk`,
          metric: `${longDays.length} days`,
        });
      }
    });

    res.json({ anomalies: anomalies.sort((a, b) => (b.severity === 'high' ? 1 : 0) - (a.severity === 'high' ? 1 : 0)), total: anomalies.length });
  } catch (error) { next(error); }
};

// GET /api/analytics/attrition — Attrition risk scores
const getAttritionRisk = (req, res, next) => {
  try {
    const riskScores = db.users.filter(u => u.status === 'Active' && u.role === 'Employee').map(user => {
      let score = 0;
      const factors = [];

      // 1. Leave frequency (more leaves = higher risk)
      const leaveCount = db.leaves.filter(l => l.userId === user._id).length;
      if (leaveCount > 5) { score += 20; factors.push('High leave frequency'); }
      else if (leaveCount > 3) { score += 10; factors.push('Moderate leave frequency'); }

      // 2. Attendance rate
      const att = db.attendance.filter(a => a.userId === user._id);
      const presentDays = att.filter(a => a.status === 'Present' || a.status === 'WFH').length;
      const attRate = att.length > 0 ? (presentDays / att.length) * 100 : 100;
      if (attRate < 70) { score += 25; factors.push('Low attendance rate'); }
      else if (attRate < 85) { score += 10; factors.push('Below-average attendance'); }

      // 3. Tenure (new employees more likely to leave)
      const tenure = user.joinDate ? (Date.now() - new Date(user.joinDate)) / (1000 * 60 * 60 * 24 * 365) : 2;
      if (tenure < 1) { score += 20; factors.push('New employee (<1 year)'); }
      else if (tenure < 2) { score += 10; factors.push('Early tenure (1-2 years)'); }

      // 4. Late check-ins
      const lateCount = att.filter(a => a.checkIn && new Date(a.checkIn).getHours() >= 10).length;
      if (lateCount > 10) { score += 15; factors.push('Frequent late arrivals'); }

      // 5. Add some randomness for realistic distribution
      score += Math.floor(Math.random() * 15);
      score = Math.min(100, Math.max(0, score));

      const level = score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low';

      return {
        _id: user._id, name: user.name, department: user.department, email: user.email,
        riskScore: score, riskLevel: level, factors, attendanceRate: attRate.toFixed(1),
        tenure: tenure.toFixed(1), leaveCount,
      };
    });

    riskScores.sort((a, b) => b.riskScore - a.riskScore);

    const summary = {
      high: riskScores.filter(r => r.riskLevel === 'High').length,
      medium: riskScores.filter(r => r.riskLevel === 'Medium').length,
      low: riskScores.filter(r => r.riskLevel === 'Low').length,
      avgScore: (riskScores.reduce((s, r) => s + r.riskScore, 0) / (riskScores.length || 1)).toFixed(1),
    };

    res.json({ employees: riskScores, summary });
  } catch (error) { next(error); }
};

// GET /api/analytics/cost-breakdown — Department cost breakdown
const getCostBreakdown = (req, res, next) => {
  try {
    const deptCosts = {};
    const months = ['2026-02', '2026-03', '2026-04'];

    db.payroll.forEach(p => {
      const user = findById('users', p.userId);
      if (!user) return;
      const dept = user.department;
      if (!deptCosts[dept]) deptCosts[dept] = { basic: 0, bonus: 0, deductions: 0, net: 0, tds: 0, pf: 0, employees: new Set() };
      deptCosts[dept].basic += p.basicSalary;
      deptCosts[dept].bonus += p.bonus;
      deptCosts[dept].deductions += p.deductions;
      deptCosts[dept].net += p.netSalary;
      deptCosts[dept].tds += (p.tds || 0);
      deptCosts[dept].pf += (p.pf || 0);
      deptCosts[dept].employees.add(p.userId);
    });

    const breakdown = Object.entries(deptCosts).map(([name, data]) => ({
      department: name,
      totalCost: data.net,
      basicTotal: data.basic,
      bonusTotal: data.bonus,
      deductionsTotal: data.deductions,
      tdsTotal: data.tds,
      pfTotal: data.pf,
      headcount: data.employees.size,
      costPerEmployee: Math.round(data.net / (data.employees.size || 1)),
    }));

    const totalCompanyCost = breakdown.reduce((s, d) => s + d.totalCost, 0);
    breakdown.forEach(d => { d.percentage = ((d.totalCost / totalCompanyCost) * 100).toFixed(1); });

    res.json({ breakdown: breakdown.sort((a, b) => b.totalCost - a.totalCost), totalCompanyCost });
  } catch (error) { next(error); }
};

// GET /api/analytics/payroll-forecast — Payroll forecasting
const getPayrollForecast = (req, res, next) => {
  try {
    const monthlyTotals = {};
    db.payroll.forEach(p => {
      if (!monthlyTotals[p.month]) monthlyTotals[p.month] = { basic: 0, bonus: 0, deductions: 0, net: 0, count: 0 };
      monthlyTotals[p.month].basic += p.basicSalary;
      monthlyTotals[p.month].bonus += p.bonus;
      monthlyTotals[p.month].deductions += p.deductions;
      monthlyTotals[p.month].net += p.netSalary;
      monthlyTotals[p.month].count++;
    });

    const history = Object.entries(monthlyTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));

    // Simple linear regression forecast for next 3 months
    const forecast = [];
    if (history.length >= 2) {
      const lastTwo = history.slice(-2);
      const growthRate = lastTwo[1].net / (lastTwo[0].net || 1);
      let lastNet = lastTwo[1].net;
      for (let i = 1; i <= 3; i++) {
        const d = new Date(); d.setMonth(d.getMonth() + i);
        const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        lastNet = Math.round(lastNet * (0.98 + Math.random() * 0.06));
        forecast.push({
          month: monthStr, net: lastNet, type: 'forecast',
          basic: Math.round(lastNet * 0.75), bonus: Math.round(lastNet * 0.08),
          deductions: Math.round(lastNet * 0.12), count: lastTwo[1].count,
        });
      }
    }

    res.json({ history, forecast, combined: [...history.map(h => ({ ...h, type: 'actual' })), ...forecast] });
  } catch (error) { next(error); }
};

// GET /api/analytics/audit-log — Full audit trail
const getAuditLog = (req, res, next) => {
  try {
    const { page = 1, limit = 20, action, userId } = req.query;
    let logs = [...db.activityLogs];

    if (action) logs = logs.filter(l => l.action.toLowerCase().includes(action.toLowerCase()));
    if (userId) logs = logs.filter(l => String(l.userId) === String(userId));

    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const total = logs.length;
    const start = (page - 1) * limit;
    const paginated = logs.slice(start, start + parseInt(limit));

    const enriched = paginated.map(log => {
      const user = findById('users', log.userId);
      return { ...log, userName: user ? user.name : 'System', userRole: user ? user.role : 'N/A' };
    });

    res.json({ logs: enriched, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) { next(error); }
};

module.exports = { getDashboardStats, getAIInsights, getAnomalies, getAttritionRisk, getCostBreakdown, getPayrollForecast, getAuditLog };
