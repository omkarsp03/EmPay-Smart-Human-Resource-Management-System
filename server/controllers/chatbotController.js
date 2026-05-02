const { db, findById, findByQuery, insertOne } = require('../config/db');

// POST /api/chatbot/ask
const askChatbot = (req, res, next) => {
  try {
    const { question } = req.body;
    const userId = req.user.id;
    const user = findById('users', userId);
    const q = (question || '').toLowerCase().trim();

    let answer = '';
    let data = null;

    // Leave balance queries
    if (q.includes('leave') && (q.includes('how many') || q.includes('balance') || q.includes('remaining') || q.includes('left'))) {
      const approved = db.leaves.filter(l => l.userId === userId && l.status === 'Approved');
      const totalUsed = approved.reduce((sum, l) => {
        const start = new Date(l.startDate);
        const end = new Date(l.endDate);
        return sum + Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
      }, 0);
      const sickUsed = approved.filter(l => l.type === 'Sick').length;
      const casualUsed = approved.filter(l => l.type === 'Casual').length;
      const paidUsed = approved.filter(l => l.type === 'Paid').length;
      const sickLeft = Math.max(0, 12 - sickUsed);
      const casualLeft = Math.max(0, 12 - casualUsed);
      const paidLeft = Math.max(0, 15 - paidUsed);
      answer = `Here's your leave balance:\n• Sick Leave: ${sickLeft}/12 remaining (${sickUsed} used)\n• Casual Leave: ${casualLeft}/12 remaining (${casualUsed} used)\n• Paid Leave: ${paidLeft}/15 remaining (${paidUsed} used)\n• Total days used this year: ${totalUsed}`;
      data = { sickLeft, casualLeft, paidLeft, totalUsed };
    }
    // Salary queries
    else if (q.includes('salary') || q.includes('payslip') || q.includes('pay') || q.includes('ctc') || q.includes('compensation')) {
      const payroll = db.payroll.filter(p => p.userId === userId).sort((a, b) => new Date(b.payDate) - new Date(a.payDate));
      if (payroll.length > 0) {
        const latest = payroll[0];
        answer = `Your latest payslip (${latest.month}):\n• Basic Salary: ₹${latest.basicSalary.toLocaleString()}\n• Bonus: ₹${latest.bonus.toLocaleString()}\n• Deductions: ₹${latest.deductions.toLocaleString()}\n• TDS: ₹${(latest.tds || 0).toLocaleString()}\n• PF: ₹${(latest.pf || 0).toLocaleString()}\n• Net Salary: ₹${latest.netSalary.toLocaleString()}`;
        data = latest;
      } else {
        answer = 'No payroll records found for your account yet. Please contact HR if this seems incorrect.';
      }
    }
    // Attendance queries
    else if (q.includes('attendance') || q.includes('present') || q.includes('absent')) {
      const records = db.attendance.filter(a => a.userId === userId);
      const present = records.filter(r => r.status === 'Present').length;
      const wfh = records.filter(r => r.status === 'WFH').length;
      const absent = records.filter(r => r.status === 'Absent').length;
      const total = records.length;
      const rate = total > 0 ? ((present + wfh) / total * 100).toFixed(1) : 0;
      answer = `Your attendance summary:\n• Present: ${present} days\n• WFH: ${wfh} days\n• Absent: ${absent} days\n• Attendance Rate: ${rate}%\n• Total recorded days: ${total}`;
      data = { present, wfh, absent, rate, total };
    }
    // Holiday queries
    else if (q.includes('holiday') || q.includes('vacation') || q.includes('off day')) {
      answer = 'Upcoming holidays:\n• May 12 — Mother\'s Day\n• Jun 17 — Eid ul-Adha\n• Aug 15 — Independence Day\n• Oct 2 — Gandhi Jayanti\n• Oct 24 — Diwali\n• Dec 25 — Christmas\n\nPlease check with HR for the complete company holiday calendar.';
    }
    // Policy queries
    else if (q.includes('policy') || q.includes('policies') || q.includes('rule') || q.includes('guideline')) {
      answer = 'Company Policies:\n• Work hours: 9 AM - 6 PM (flexible ±1 hour)\n• Leave policy: 12 Sick + 12 Casual + 15 Paid leaves/year\n• WFH: Up to 2 days/week with manager approval\n• Dress code: Business casual\n• Notice period: 30 days for employees, 60 days for managers\n\nFor detailed policy documents, please visit the HR portal.';
    }
    // Who/team queries
    else if (q.includes('team') || q.includes('department') || q.includes('who') || q.includes('manager')) {
      const dept = user?.department || 'General';
      const teammates = db.users.filter(u => u.department === dept && u.status === 'Active');
      answer = `Your ${dept} team has ${teammates.length} members:\n${teammates.map(t => `• ${t.name} (${t.role})`).join('\n')}`;
      data = { department: dept, count: teammates.length };
    }
    // Profile queries
    else if (q.includes('profile') || q.includes('my detail') || q.includes('my info') || q.includes('about me')) {
      answer = `Your profile:\n• Name: ${user?.name}\n• Email: ${user?.email}\n• Department: ${user?.department}\n• Role: ${user?.role}\n• Status: ${user?.status}\n• Join Date: ${user?.joinDate ? new Date(user.joinDate).toLocaleDateString() : 'N/A'}`;
    }
    // Help
    else if (q.includes('help') || q.includes('what can you')) {
      answer = 'I can help you with:\n• 📋 Leave balance — "How many leaves do I have left?"\n• 💰 Salary info — "Show my latest payslip"\n• 📊 Attendance — "What\'s my attendance rate?"\n• 🏖️ Holidays — "When are the upcoming holidays?"\n• 📜 Policies — "What are the company policies?"\n• 👥 Team info — "Who is in my department?"\n• 👤 Profile — "Show my profile details"\n\nJust ask in natural language!';
    }
    // Default
    else {
      answer = `I'm not sure how to answer "${question}". Try asking about:\n• Leave balance\n• Salary/payslip\n• Attendance\n• Holidays\n• Company policies\n• Team information\n\nOr type "help" to see all available commands.`;
    }

    // Log the interaction
    insertOne('activityLogs', {
      userId, action: 'Chatbot Query',
      details: `Asked: "${question.substring(0, 100)}"`,
      timestamp: new Date().toISOString(),
    });

    res.json({ answer, data, timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
};

module.exports = { askChatbot };
