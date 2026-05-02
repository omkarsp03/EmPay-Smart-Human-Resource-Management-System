const bcrypt = require('bcryptjs');
const { db, insertOne } = require('../config/db');

const seedData = async () => {
  if (db.users.length > 0) return; // Already seeded

  console.log('🌱 Seeding demo data...');
  const hash = (pw) => bcrypt.hashSync(pw, 10);

  // Users
  const departments = ['Engineering', 'Design', 'Marketing', 'Sales', 'HR', 'Finance', 'Operations'];
  const names = [
    'John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Williams', 'David Brown',
    'Emily Davis', 'Chris Wilson', 'Anna Taylor', 'James Anderson', 'Lisa Thomas',
    'Robert Martinez', 'Maria Garcia', 'William Lee', 'Jennifer White', 'Daniel Harris',
    'Amanda Clark', 'Matthew Lewis', 'Jessica Walker', 'Andrew Hall', 'Stephanie Allen',
  ];

  // Admin
  const admin = insertOne('users', {
    name: 'Admin User', email: 'admin@empay.com', loginId: 'EMPADMIN20240001', companyName: 'EmPay', password: hash('admin123'),
    role: 'Admin', department: 'Operations', phone: '+1-555-0100', avatar: '', status: 'Active',
    joinDate: '2024-01-15T00:00:00.000Z', skills: [], certifications: [], interests: [],
    managerId: null,
    designation: 'Administrator',
    location: 'Pune',
    leaveBalances: { 'Paid Time Off': 30, 'Sick Leave': 10, 'Unpaid Leave': 0 },
    bankDetails: { bankName: 'HDFC', accountNo: '501000123456', ifsc: 'HDFC0001234', pan: 'AAAAA0000A', uan: '101234567890' },
  });

  // HR
  const hr1 = insertOne('users', {
    name: 'Priya Sharma', email: 'hr@empay.com', loginId: 'EMPPS20240002', companyName: 'EmPay', password: hash('hr123'),
    role: 'HR Officer', department: 'HR', phone: '+1-555-0101', avatar: '', status: 'Active',
    joinDate: '2024-02-01T00:00:00.000Z', skills: [], certifications: [], interests: [],
    managerId: admin._id,
    designation: 'HR Manager',
    location: 'Pune',
    leaveBalances: { 'Paid Time Off': 24, 'Sick Leave': 7, 'Unpaid Leave': 0 },
    bankDetails: { bankName: 'ICICI', accountNo: '602000998877', ifsc: 'ICIC0006020', pan: 'BBBBB1111B', uan: '101234567891' },
  });
  const hr2 = insertOne('users', {
    name: 'Rachel Green', email: 'rachel@empay.com', loginId: 'EMPRG20240003', companyName: 'EmPay', password: hash('hr123'),
    role: 'HR Officer', department: 'HR', phone: '+1-555-0102', avatar: '', status: 'Active',
    joinDate: '2024-03-10T00:00:00.000Z', skills: [], certifications: [], interests: [],
    managerId: admin._id,
    designation: 'HR Officer',
    location: 'Mumbai',
    leaveBalances: { 'Paid Time Off': 24, 'Sick Leave': 7, 'Unpaid Leave': 0 },
    bankDetails: { bankName: 'SBI', accountNo: '30100234567', ifsc: 'SBIN0003010', pan: 'CCCCC2222C', uan: '101234567892' },
  });

  // Payroll
  const payrollOfficer = insertOne('users', {
    name: 'Kevin Adams', email: 'payroll@empay.com', loginId: 'EMPKA20240004', companyName: 'EmPay', password: hash('pay123'),
    role: 'Payroll Officer', department: 'Finance', phone: '+1-555-0103', avatar: '', status: 'Active',
    joinDate: '2024-01-20T00:00:00.000Z', skills: [], certifications: [], interests: [],
    managerId: admin._id,
    designation: 'Payroll Lead',
    location: 'Pune',
    leaveBalances: { 'Paid Time Off': 24, 'Sick Leave': 7, 'Unpaid Leave': 0 },
    bankDetails: { bankName: 'Axis', accountNo: '910020012345678', ifsc: 'UTIB0009100', pan: 'DDDDD3333D', uan: '101234567893' },
  });

  // Employees
  const employees = [];
  names.forEach((name, i) => {
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
    const isJohn = i === 0;
    const emp = insertOne('users', {
      name, email: isJohn ? 'john@empay.com' : `${name.split(' ')[0].toLowerCase()}${i}@empay.com`,
      loginId: `EMP${initials}2024${String(i + 5).padStart(4, '0')}`,
      companyName: 'EmPay',
      password: hash('emp123'),
      role: 'Employee', department: departments[i % departments.length],
      phone: `+1-555-0${110 + i}`, avatar: '', status: i < 18 ? 'Active' : 'Inactive',
      joinDate: new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString(),
      skills: [], certifications: [], interests: [],
      managerId: i === 1 ? null : hr1._id,
      designation: ['Engineer', 'Designer', 'Analyst', 'Executive'][i % 4],
      location: i % 2 === 0 ? 'Pune' : 'Bangalore',
      leaveBalances: { 'Paid Time Off': 24, 'Sick Leave': 7, 'Unpaid Leave': 0 },
      bankDetails: isJohn
        ? { bankName: '', accountNo: '', ifsc: '', pan: 'EEEEE4444E', uan: '' }
        : { bankName: 'HDFC', accountNo: `5${String(100000 + i).slice(0, 6)}`, ifsc: 'HDFC0001234', pan: 'ABCDE1234F', uan: `1012345678${String(90 + i).slice(-2)}` },
      ...(isJohn
        ? {
            salaryStructure: {
              monthWage: 50000,
              workingDaysPerWeek: 5,
              breakTimeHours: 1,
              basicPctOfWage: 50,
              hraPctOfBasic: 50,
              standardAllowanceMonthly: 4167,
              performanceBonusPctOfBasic: 8.33,
              ltaPctOfBasic: 8.33,
              pfEmployeePctOfBasic: 12,
              pfEmployerPctOfBasic: 12,
              professionalTax: 200,
            },
          }
        : {}),
    });
    employees.push(emp);
  });

  const allUsers = [admin, hr1, hr2, payrollOfficer, ...employees];

  // Attendance (last 30 days)
  const statuses = ['Present', 'Present', 'Present', 'Present', 'WFH', 'Absent'];
  for (let day = 30; day >= 0; day--) {
    const d = new Date(); d.setDate(d.getDate() - day);
    if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends
    const dateStr = d.toISOString().split('T')[0];

    allUsers.filter(u => u.status === 'Active').forEach(user => {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      if (status !== 'Absent') {
        const checkInH = 8 + Math.floor(Math.random() * 2);
        const checkInM = Math.floor(Math.random() * 60);
        const checkIn = new Date(d); checkIn.setHours(checkInH, checkInM, 0);
        const checkOut = new Date(d); checkOut.setHours(checkInH + 8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0);
        const checkInIso = checkIn.toISOString();
        const checkOutIso = day === 0 ? null : checkOut.toISOString();
        const totalHours =
          checkOutIso != null
            ? String(
                Math.max(
                  0,
                  +((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
                )
              )
            : null;

        insertOne('attendance', {
          userId: user._id, date: dateStr, status,
          checkIn: checkInIso,
          checkOut: checkOutIso,
          totalHours,
        });
      }
    });
  }

  // Leaves
  const leaveTypes = ['Sick Leave', 'Unpaid Leave', 'Paid Time Off'];
  const leaveStatuses = ['Pending', 'Approved', 'Approved', 'Rejected'];
  employees.slice(0, 12).forEach((emp, i) => {
    const startDay = Math.floor(Math.random() * 20) + 1;
    const duration = Math.floor(Math.random() * 3) + 1;
    const start = new Date(2026, 4, startDay);
    const end = new Date(2026, 4, startDay + duration);
    insertOne('leaves', {
      userId: emp._id,
      type: leaveTypes[i % leaveTypes.length],
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      reason: ['Feeling unwell', 'Family function', 'Personal work', 'Medical appointment', 'Vacation'][i % 5],
      status: leaveStatuses[i % leaveStatuses.length],
      approvedBy: i % 4 !== 0 ? hr1._id : null,
    });
  });

  // Payroll (last 3 months) — with tax calculations
  const baseSalaries = { Engineering: 85000, Design: 75000, Marketing: 70000, Sales: 72000, HR: 68000, Finance: 78000, Operations: 65000 };
  const calcTDS = (annual) => { if (annual <= 300000) return 0; if (annual <= 600000) return Math.round((annual - 300000) * 0.05 / 12); if (annual <= 900000) return Math.round((15000 + (annual - 600000) * 0.10) / 12); return Math.round((45000 + (annual - 900000) * 0.15) / 12); };
  ['2026-02', '2026-03', '2026-04'].forEach(month => {
    allUsers.filter(u => u.status === 'Active' && u.role !== 'Admin').forEach(user => {
      const basic = baseSalaries[user.department] || 60000;
      const bonus = Math.floor(Math.random() * 10000);
      const pf = Math.round(basic * 0.12);
      const tds = calcTDS(basic * 12);
      const pt = basic + bonus > 10000 ? 200 : (basic + bonus > 7500 ? 175 : 0);
      const deductions = pf + tds + pt;
      insertOne('payroll', {
        userId: user._id, userName: user.name, basicSalary: basic, bonus,
        deductions, pf, tds, pt,
        hra: Math.round(basic * 0.4), da: Math.round(basic * 0.1),
        specialAllowance: Math.round(basic * 0.15),
        netSalary: basic + bonus - deductions,
        payDate: `${month}-28T00:00:00.000Z`, month,
      });
    });
  });

  // Notifications
  [admin, hr1, hr2].forEach(user => {
    insertOne('notifications', { userId: user._id, message: '3 new leave requests pending approval', type: 'leave', readStatus: false });
    insertOne('notifications', { userId: user._id, message: 'April payroll has been processed successfully', type: 'payroll', readStatus: true });
    insertOne('notifications', { userId: user._id, message: 'New employee Sarah Williams has joined', type: 'info', readStatus: true });
  });

  employees.slice(0, 5).forEach(emp => {
    insertOne('notifications', { userId: emp._id, message: 'Your leave request has been approved', type: 'success', readStatus: false });
    insertOne('notifications', { userId: emp._id, message: 'April payslip is ready for download', type: 'payroll', readStatus: false });
  });

  // Activity logs
  insertOne('activityLogs', { userId: admin._id, action: 'System Initialized', details: 'EmPay HRMS system started', timestamp: new Date().toISOString() });
  insertOne('activityLogs', { userId: hr1._id, action: 'Leave Approved', details: 'Approved leave for John Doe', timestamp: new Date(Date.now() - 3600000).toISOString() });
  insertOne('activityLogs', { userId: hr1._id, action: 'Employee Created', details: 'Added new employee Lisa Thomas', timestamp: new Date(Date.now() - 7200000).toISOString() });
  insertOne('activityLogs', { userId: payrollOfficer._id, action: 'Payroll Processed', details: 'Processed payroll for April 2026', timestamp: new Date(Date.now() - 86400000).toISOString() });

  console.log(`✅ Seeded: ${db.users.length} users, ${db.attendance.length} attendance records, ${db.leaves.length} leaves, ${db.payroll.length} payroll records`);
};

module.exports = seedData;
