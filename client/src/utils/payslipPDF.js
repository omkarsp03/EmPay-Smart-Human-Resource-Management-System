import { jsPDF } from 'jspdf';

export const generatePayslipPDF = (payslip) => {
  const doc = new jsPDF();
  const { employee, company, earnings, deductionsList, month, netSalary, payDate } = payslip;

  const headerColor = [58, 45, 86];
  const accentColor = [24, 160, 190];
  const dark = [25, 31, 56];
  const muted = [98, 107, 131];
  const line = [229, 233, 247];
  const safeCompany = company || {};
  const safeEmployee = employee || {};
  const safeEarnings = earnings || [];
  const safeDeductions = deductionsList || [];

  const formatInr = (value) => `₹ ${Number(value || 0).toLocaleString('en-IN')}`;
  const periodLabel = month || '-';

  doc.setFillColor(246, 248, 255);
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(10, 10, 190, 277, 3, 3, 'F');

  doc.setDrawColor(...line);
  doc.roundedRect(12, 12, 186, 273, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.setFontSize(10);
  doc.text(safeCompany.name || 'Company', 16, 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.text(safeCompany.address || '-', 16, 25);
  doc.text(`CIN: ${safeCompany.cin || '-'}`, 16, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...dark);
  doc.text(`Salary slip for ${periodLabel}`, 16, 38);

  doc.setDrawColor(...line);
  doc.line(14, 42, 196, 42);

  doc.setFillColor(249, 250, 255);
  doc.roundedRect(16, 46, 178, 44, 2, 2, 'F');
  doc.setDrawColor(...line);
  doc.roundedRect(16, 46, 178, 44, 2, 2, 'S');

  const details = [
    ['Employee name', safeEmployee.name || '-'],
    ['Emp id', (safeEmployee._id || '').slice(-6).toUpperCase() || '-'],
    ['Employee code', safeEmployee.employeeCode || '-'],
    ['PAN', safeEmployee.bankDetails?.pan || '-'],
    ['Department', safeEmployee.department || '-'],
    ['UAN', safeEmployee.bankDetails?.uan || '-'],
    ['Location', safeEmployee.location || '-'],
    ['Bank A/c', safeEmployee.bankDetails?.accountNo || '-'],
    ['Pay period', periodLabel],
    ['Pay date', payDate ? new Date(payDate).toLocaleDateString('en-GB') : '-'],
  ];

  let dY = 52;
  details.forEach((detail, idx) => {
    const x = idx % 2 === 0 ? 20 : 108;
    if (idx % 2 === 0 && idx > 0) dY += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...muted);
    doc.text(detail[0], x, dY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(String(detail[1]), x + 30, dY);
  });

  doc.setFillColor(...headerColor);
  doc.roundedRect(16, 96, 178, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('Earnings', 20, 101.5);
  doc.text('Amount', 90, 101.5, { align: 'right' });
  doc.text('Deductions', 108, 101.5);
  doc.text('Amount', 188, 101.5, { align: 'right' });

  const rowCount = Math.max(safeEarnings.length, safeDeductions.length, 4);
  let tableY = 104;
  let totalEarnings = 0;
  let totalDeductions = 0;
  for (let i = 0; i < rowCount; i += 1) {
    const earning = safeEarnings[i];
    const deduction = safeDeductions[i];
    if (i % 2 === 0) {
      doc.setFillColor(251, 252, 255);
      doc.rect(16, tableY, 178, 7, 'F');
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...dark);
    doc.text(earning?.label || '-', 20, tableY + 4.8);
    doc.text(formatInr(earning?.amount || 0), 90, tableY + 4.8, { align: 'right' });
    doc.text(deduction?.label || '-', 108, tableY + 4.8);
    doc.text(formatInr(deduction?.amount || 0), 188, tableY + 4.8, { align: 'right' });

    totalEarnings += Number(earning?.amount || 0);
    totalDeductions += Number(deduction?.amount || 0);
    tableY += 7;
  }

  doc.setDrawColor(...line);
  doc.line(16, tableY, 194, tableY);
  tableY += 7;

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...dark);
  doc.text('Gross', 20, tableY);
  doc.text(formatInr(totalEarnings), 90, tableY, { align: 'right' });
  doc.text('Total deductions', 108, tableY);
  doc.text(formatInr(totalDeductions), 188, tableY, { align: 'right' });

  const netY = tableY + 8;
  doc.setFillColor(...headerColor);
  doc.roundedRect(16, netY, 130, 15, 2, 2, 'F');
  doc.setFillColor(...accentColor);
  doc.roundedRect(148, netY, 46, 15, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Total Net Payable', 20, netY + 9.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('(Gross earning - Total deductions)', 20, netY + 13);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(formatInr(netSalary || 0), 190, netY + 10, { align: 'right' });

  doc.setTextColor(...muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text('This is a computer-generated payslip and does not require signature.', 105, 280, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleDateString('en-GB')}`, 105, 284, { align: 'center' });

  const fileName = `EmPay_Payslip_${(safeEmployee.name || 'Employee').replace(/\s/g, '_')}_${month || 'Month'}.pdf`;
  doc.save(fileName);
};
