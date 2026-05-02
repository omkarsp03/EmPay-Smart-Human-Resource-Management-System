const round2 = (n) => Math.round(Number(n) * 100) / 100;

const DEFAULTS = {
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
};

function normalizeSalaryStructure(raw = {}) {
  const n = (v, d) => {
    const x = Number(v);
    return Number.isFinite(x) ? x : d;
  };
  const clampPct = (v) => Math.min(100, Math.max(0, n(v, 0)));
  return {
    monthWage: Math.max(0, n(raw.monthWage, DEFAULTS.monthWage)),
    workingDaysPerWeek: Math.min(7, Math.max(1, Math.round(n(raw.workingDaysPerWeek, DEFAULTS.workingDaysPerWeek)))),
    breakTimeHours: Math.max(0, n(raw.breakTimeHours, DEFAULTS.breakTimeHours)),
    basicPctOfWage: clampPct(raw.basicPctOfWage ?? DEFAULTS.basicPctOfWage),
    hraPctOfBasic: clampPct(raw.hraPctOfBasic ?? DEFAULTS.hraPctOfBasic),
    standardAllowanceMonthly: Math.max(0, n(raw.standardAllowanceMonthly, DEFAULTS.standardAllowanceMonthly)),
    performanceBonusPctOfBasic: clampPct(raw.performanceBonusPctOfBasic ?? DEFAULTS.performanceBonusPctOfBasic),
    ltaPctOfBasic: clampPct(raw.ltaPctOfBasic ?? DEFAULTS.ltaPctOfBasic),
    pfEmployeePctOfBasic: clampPct(raw.pfEmployeePctOfBasic ?? DEFAULTS.pfEmployeePctOfBasic),
    pfEmployerPctOfBasic: clampPct(raw.pfEmployerPctOfBasic ?? DEFAULTS.pfEmployerPctOfBasic),
    professionalTax: Math.max(0, n(raw.professionalTax, DEFAULTS.professionalTax)),
  };
}

function computeSalaryAmounts(config) {
  const c = normalizeSalaryStructure(config);
  const M = c.monthWage;
  const basic = round2((M * c.basicPctOfWage) / 100);
  const hra = round2((basic * c.hraPctOfBasic) / 100);
  const standard = round2(c.standardAllowanceMonthly);
  const performanceBonus = round2((basic * c.performanceBonusPctOfBasic) / 100);
  const lta = round2((basic * c.ltaPctOfBasic) / 100);
  const explicitSum = round2(basic + hra + standard + performanceBonus + lta);
  const fixedAllowance = round2(M - explicitSum);
  const pfEmployee = round2((basic * c.pfEmployeePctOfBasic) / 100);
  const pfEmployer = round2((basic * c.pfEmployerPctOfBasic) / 100);
  const professionalTax = round2(c.professionalTax);
  const yearlyWage = round2(M * 12);

  const pctOfWage = (amt) => (M > 0 ? round2((amt / M) * 100) : 0);

  return {
    ...c,
    yearlyWage,
    amounts: {
      basic,
      hra,
      standardAllowance: standard,
      performanceBonus,
      lta,
      fixedAllowance,
      explicitSum,
      pfEmployee,
      pfEmployer,
      professionalTax,
    },
    displayPct: {
      basicOfWage: pctOfWage(basic),
      hraOfWage: pctOfWage(hra),
      standardOfWage: pctOfWage(standard),
      performanceOfWage: pctOfWage(performanceBonus),
      ltaOfWage: pctOfWage(lta),
      fixedOfWage: pctOfWage(fixedAllowance),
      pfEmployeeOfBasic: c.pfEmployeePctOfBasic,
      pfEmployerOfBasic: c.pfEmployerPctOfBasic,
    },
    valid: fixedAllowance >= -0.02,
  };
}

function defaultSalaryStructure() {
  return { ...DEFAULTS };
}

module.exports = {
  DEFAULTS,
  defaultSalaryStructure,
  normalizeSalaryStructure,
  computeSalaryAmounts,
};
