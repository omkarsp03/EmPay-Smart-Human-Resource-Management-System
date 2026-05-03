import { jsPDF } from 'jspdf';

// ============================================================
// SHARED HELPERS
// ============================================================
const COMPANY = {
  name: 'EmPay Technologies Pvt. Ltd.',
  address: '123 Tech Park, Pune, Maharashtra 411001',
  cin: 'U72900MH2024PTC123456',
};

const COLORS = {
  header: [58, 45, 86],      // deep purple
  accent: [24, 160, 190],    // teal
  dark: [25, 31, 56],        // near-black
  muted: [98, 107, 131],     // grey text
  line: [229, 233, 247],     // border
  bg: [246, 248, 255],       // page bg
  white: [255, 255, 255],
  success: [52, 199, 89],    // green
};

const inr = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN')}`;

function addPageHeader(doc, title, subtitle) {
  // Background
  doc.setFillColor(...COLORS.bg);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFillColor(...COLORS.white);
  doc.roundedRect(10, 10, 190, 277, 3, 3, 'F');
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(12, 12, 186, 273, 3, 3, 'S');

  // Company header bar
  doc.setFillColor(...COLORS.header);
  doc.roundedRect(14, 14, 182, 22, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(COMPANY.name, 20, 23);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(COMPANY.address, 20, 29);
  doc.text(`CIN: ${COMPANY.cin}`, 20, 33);

  // Title section
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(title, 20, 47);
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text(subtitle, 20, 53);
  }

  // Divider
  doc.setDrawColor(...COLORS.line);
  doc.line(16, 57, 194, 57);

  return 63; // y position after header
}

function addFooter(doc, pageNum = 1) {
  doc.setTextColor(...COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('This is a computer-generated document and does not require a signature.', 105, 280, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')} | EmPay HRMS | Page ${pageNum}`, 105, 284, { align: 'center' });
}

function addSectionHeader(doc, text, y) {
  doc.setFillColor(...COLORS.header);
  doc.roundedRect(16, y, 178, 7, 1, 1, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(text, 20, y + 4.8);
  return y + 7;
}

function addInfoRow(doc, label, value, x, y) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.dark);
  doc.text(String(value || '—'), x + 35, y);
}

// ============================================================
// 1. SALARY STATEMENT PDF
// ============================================================
export function generateSalaryStatementPDF(stmtData, employeeName, year) {
  if (!stmtData) return;
  const doc = new jsPDF();
  let y = addPageHeader(doc, 'Salary Statement Report', `Employee: ${employeeName || '—'} | Year: ${year || new Date().getFullYear()}`);

  // Employee info box
  doc.setFillColor(249, 250, 255);
  doc.roundedRect(16, y, 178, 22, 2, 2, 'F');
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(16, y, 178, 22, 2, 2, 'S');

  const emp = stmtData.employee || {};
  addInfoRow(doc, 'Employee Name', emp.name, 20, y + 7);
  addInfoRow(doc, 'Designation', emp.designation, 20, y + 14);
  addInfoRow(doc, 'Date of Joining', emp.dateOfJoining ? new Date(emp.dateOfJoining).toLocaleDateString('en-GB') : '—', 110, y + 7);
  addInfoRow(doc, 'Company', emp.companyName || COMPANY.name, 110, y + 14);

  y += 28;

  // ---- EARNINGS TABLE ----
  y = addSectionHeader(doc, 'Earnings', y);

  // Table header
  doc.setFillColor(240, 242, 255);
  doc.rect(16, y, 178, 6, 'F');
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Component', 20, y + 4.2);
  doc.text('Monthly Amount', 115, y + 4.2, { align: 'right' });
  doc.text('Yearly Amount', 192, y + 4.2, { align: 'right' });
  y += 6;

  let totalMonthlyEarnings = 0;
  let totalYearlyEarnings = 0;
  (stmtData.earnings || []).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(251, 252, 255);
      doc.rect(16, y, 178, 6.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    doc.text(row.name || '—', 20, y + 4.5);
    doc.text(inr(row.monthly), 115, y + 4.5, { align: 'right' });
    doc.text(inr(row.yearly), 192, y + 4.5, { align: 'right' });
    totalMonthlyEarnings += Number(row.monthly || 0);
    totalYearlyEarnings += Number(row.yearly || 0);
    y += 6.5;
  });

  // Earnings total row
  doc.setDrawColor(...COLORS.line);
  doc.line(16, y, 194, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.dark);
  doc.text('Total Earnings (Gross)', 20, y + 4);
  doc.text(inr(totalMonthlyEarnings), 115, y + 4, { align: 'right' });
  doc.text(inr(totalYearlyEarnings), 192, y + 4, { align: 'right' });
  y += 10;

  // ---- DEDUCTIONS TABLE ----
  y = addSectionHeader(doc, 'Deductions', y);

  doc.setFillColor(240, 242, 255);
  doc.rect(16, y, 178, 6, 'F');
  doc.setTextColor(...COLORS.dark);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Component', 20, y + 4.2);
  doc.text('Monthly Amount', 115, y + 4.2, { align: 'right' });
  doc.text('Yearly Amount', 192, y + 4.2, { align: 'right' });
  y += 6;

  let totalMonthlyDed = 0;
  let totalYearlyDed = 0;
  (stmtData.deductions || []).forEach((row, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(255, 250, 250);
      doc.rect(16, y, 178, 6.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...COLORS.dark);
    doc.text(row.name || '—', 20, y + 4.5);
    doc.text(inr(row.monthly), 115, y + 4.5, { align: 'right' });
    doc.text(inr(row.yearly), 192, y + 4.5, { align: 'right' });
    totalMonthlyDed += Number(row.monthly || 0);
    totalYearlyDed += Number(row.yearly || 0);
    y += 6.5;
  });

  doc.setDrawColor(...COLORS.line);
  doc.line(16, y, 194, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.dark);
  doc.text('Total Deductions', 20, y + 4);
  doc.text(inr(totalMonthlyDed), 115, y + 4, { align: 'right' });
  doc.text(inr(totalYearlyDed), 192, y + 4, { align: 'right' });
  y += 12;

  // ---- NET SALARY BAR ----
  doc.setFillColor(...COLORS.header);
  doc.roundedRect(16, y, 110, 16, 2, 2, 'F');
  doc.setFillColor(...COLORS.accent);
  doc.roundedRect(128, y, 66, 16, 2, 2, 'F');
  doc.setTextColor(...COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Net Salary (Take-Home)', 20, y + 10);
  doc.setFontSize(11);
  doc.text(inr(stmtData.netMonthly), 192, y + 6.5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Yearly: ${inr(stmtData.netYearly)}`, 192, y + 12.5, { align: 'right' });

  addFooter(doc);
  doc.save(`EmPay_Salary_Statement_${(employeeName || 'Employee').replace(/\s/g, '_')}_${year}.pdf`);
}

// ============================================================
// 2. PAYRUN / PAYROLL SUMMARY REPORT PDF
// ============================================================
export function generatePayrunReportPDF(records, month) {
  if (!records || records.length === 0) return;
  const doc = new jsPDF();
  const periodLabel = month || 'All Months';
  let y = addPageHeader(doc, 'Payroll Run Report', `Period: ${periodLabel} | ${records.length} Employees`);

  // Summary totals
  const totalBasic = records.reduce((s, r) => s + (r.basicSalary || 0), 0);
  const totalBonus = records.reduce((s, r) => s + (r.bonus || 0), 0);
  const totalDeductions = records.reduce((s, r) => s + (r.deductions || 0), 0);
  const totalNet = records.reduce((s, r) => s + (r.netSalary || 0), 0);

  // Summary boxes
  const boxes = [
    { label: 'Total Basic', value: inr(totalBasic), color: COLORS.header },
    { label: 'Total Bonus', value: inr(totalBonus), color: COLORS.accent },
    { label: 'Total Deductions', value: inr(totalDeductions), color: [220, 60, 60] },
    { label: 'Net Payable', value: inr(totalNet), color: COLORS.success },
  ];
  boxes.forEach((box, i) => {
    const bx = 16 + (i % 2) * 91;
    const by = y + Math.floor(i / 2) * 18;
    doc.setFillColor(...box.color);
    doc.roundedRect(bx, by, 88, 15, 2, 2, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(box.label, bx + 5, by + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(box.value, bx + 5, by + 11.5);
  });
  y += 42;

  // Table header
  y = addSectionHeader(doc, `Employee Payroll Details — ${periodLabel}`, y);
  doc.setFillColor(240, 242, 255);
  doc.rect(16, y, 178, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.dark);
  const cols = [20, 65, 92, 112, 132, 152, 172];
  const headers = ['Employee', 'Basic', 'Bonus', 'PF', 'TDS', 'Deductions', 'Net'];
  headers.forEach((h, i) => doc.text(h, cols[i], y + 4.2));
  y += 6;

  records.slice(0, 30).forEach((r, i) => { // cap at 30 rows on one page
    if (i % 2 === 0) {
      doc.setFillColor(251, 252, 255);
      doc.rect(16, y, 178, 6.5, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.dark);
    doc.text((r.userName || r.name || '—').substring(0, 18), cols[0], y + 4.5);
    doc.text(inr(r.basicSalary), cols[1], y + 4.5);
    doc.text(inr(r.bonus), cols[2], y + 4.5);
    doc.text(inr(r.pf), cols[3], y + 4.5);
    doc.text(inr(r.tds), cols[4], y + 4.5);
    doc.text(inr(r.deductions), cols[5], y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(inr(r.netSalary), cols[6], y + 4.5);
    y += 6.5;
  });

  // Total row
  doc.setDrawColor(...COLORS.line);
  doc.line(16, y, 194, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.dark);
  doc.text('TOTALS', cols[0], y + 4);
  doc.text(inr(totalBasic), cols[1], y + 4);
  doc.text(inr(totalBonus), cols[2], y + 4);
  doc.text(inr(records.reduce((s, r) => s + (r.pf || 0), 0)), cols[3], y + 4);
  doc.text(inr(records.reduce((s, r) => s + (r.tds || 0), 0)), cols[4], y + 4);
  doc.text(inr(totalDeductions), cols[5], y + 4);
  doc.text(inr(totalNet), cols[6], y + 4);

  addFooter(doc);
  doc.save(`EmPay_Payrun_Report_${periodLabel.replace(/[^a-z0-9]/gi, '_')}.pdf`);
}
