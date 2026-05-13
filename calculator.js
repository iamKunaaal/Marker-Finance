/* ===================================================================
 * Marker Finance — Comprehensive Mortgage Calculator Suite
 * Tabs: EMI · DBR · Balance Transfer · Transaction · ROI · Tenor · Ref
 * =================================================================== */

// ---------- Currency / formatting ----------
const CURRENCY_SYMBOL = { AED: 'AED', USD: 'USD', EUR: 'EUR' };
const CURRENCY_RATE = { AED: 1, USD: 0.272, EUR: 0.252 }; // approx
let currentCurrency = 'AED';

const fmt = (n) => {
  if (!isFinite(n) || isNaN(n)) n = 0;
  return new Intl.NumberFormat('en-AE', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n);
};
const fmtInt = (n) => new Intl.NumberFormat('en-AE').format(Math.round(n || 0));
const fmtCur = (n) => `${CURRENCY_SYMBOL[currentCurrency]} ${fmtInt((n || 0) * CURRENCY_RATE[currentCurrency])}`;
const fmtCur2 = (n) => `${CURRENCY_SYMBOL[currentCurrency]} ${fmt((n || 0) * CURRENCY_RATE[currentCurrency])}`;

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const v = (id, def = 0) => +(document.getElementById(id)?.value || def);
const setText = (id, t) => { const el = document.getElementById(id); if (el) el.textContent = t; };
const setHide = (id, h) => { const el = document.getElementById(id); if (el) el.hidden = h; };

// ---------- Math ----------
const emi = (P, annualRate, months) => {
  if (P <= 0 || months <= 0) return 0;
  const r = (annualRate / 100) / 12;
  if (r === 0) return P / months;
  const f = Math.pow(1 + r, months);
  return (P * r * f) / (f - 1);
};
const remainingBalance = (P, annualRate, months, k) => {
  const r = (annualRate / 100) / 12;
  if (r === 0) return Math.max(0, P - (P / months) * k);
  const pmt = emi(P, annualRate, months);
  const f = Math.pow(1 + r, k);
  return P * f - pmt * ((f - 1) / r);
};
const maxLoanFromEMI = (maxEMI, annualRate, months) => {
  if (maxEMI <= 0) return 0;
  const r = (annualRate / 100) / 12;
  if (r === 0) return maxEMI * months;
  const f = Math.pow(1 + r, months);
  return maxEMI * (f - 1) / (r * f);
};

// =====================================================================
// EMI CALCULATOR STATE
// =====================================================================
const emiState = { mode: 'property', rateType: 'fixed', tenorUnit: 'months', extraTab: 'insurance', bottomTab: 'breakdown', scheduleView: 'yearly', incomeRows: [], liabRows: [] };

const incomeTypes = ['Salary', 'Housing Allowance', 'Car Allowance', 'Transport Allowance', 'Bonus', 'Commission (Annual)', 'Monthly Commission', 'Rental Income', 'Other Income'];
const liabTypes = ['Car Loan', 'Personal Loan', 'Credit Card', 'Mortgage Loan', 'Over Draft', 'Company Loan', 'Other Liability'];

// Add row helpers
const addRow = (target, types, defaults) => {
  const row = { id: Date.now() + Math.random(), type: types[0], amount: 0, consider: 100 };
  Object.assign(row, defaults || {});
  return row;
};
const renderRows = (containerId, rows, types) => {
  const container = $(`#${containerId}`);
  if (!container) return;
  container.innerHTML = rows.map((r, i) => `
    <div class="calc-row-card" data-row-id="${r.id}">
      <select data-bind="type">${types.map(t => `<option ${t === r.type ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <input type="number" data-bind="amount" value="${r.amount}" placeholder="Amount" min="0"/>
      <input type="number" data-bind="consider" value="${r.consider}" min="0" max="100"/>
      <button class="calc-row-remove" data-remove="${r.id}">×</button>
    </div>
  `).join('');
  container.querySelectorAll('.calc-row-card').forEach((el) => {
    const rid = +el.dataset.rowId;
    const row = rows.find(r => r.id == rid);
    el.querySelectorAll('[data-bind]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.bind;
        row[k] = k === 'type' ? inp.value : +inp.value;
        renderAll();
      });
    });
    el.querySelector('.calc-row-remove').addEventListener('click', () => {
      const idx = rows.findIndex(r => r.id == rid);
      if (idx >= 0) rows.splice(idx, 1);
      renderRows(containerId, rows, types);
      renderAll();
    });
  });
};
const sumRows = (rows) => rows.reduce((s, r) => s + r.amount * r.consider / 100, 0);

// =====================================================================
// EMI CALCULATION
// =====================================================================
const calculateEMI = () => {
  const mode = emiState.mode;

  // Determine property value, loan amount, down payment
  let propertyValue = 0, downPayment = 0, loanAmount = 0, downPercent = 0, tenor = 300;

  if (mode === 'property') {
    propertyValue = v('propertyValue');
    downPercent = v('downPayment');
    downPayment = propertyValue * (downPercent / 100);
    loanAmount = propertyValue - downPayment;
    tenor = emiState.tenorUnit === 'years' ? v('loanTenor') * 12 : v('loanTenor');
  } else if (mode === 'offplan') {
    const sp = v('opSelling'), op = v('opOriginal'), sellerPaid = v('opSellerPaid');
    const ltv = v('opLtv');
    propertyValue = sp;
    loanAmount = sp * (ltv / 100);
    downPayment = sp - loanAmount;
    downPercent = sp ? (downPayment / sp) * 100 : 0;
    tenor = v('opTenor');
    setText('opPremium', `AED ${fmtInt(sp - op)}`);
    setText('opLoanAmount', `AED ${fmtInt(loanAmount)}`);
  } else if (mode === 'loan') {
    loanAmount = v('laLoanAmount');
    downPercent = 20;
    propertyValue = loanAmount / 0.8;
    downPayment = propertyValue * 0.2;
    tenor = v('laTenor');
    setText('laMaxProp', `AED ${fmtInt(propertyValue)}`);
    setText('laDownPay', `AED ${fmtInt(downPayment)}`);
  } else if (mode === 'eligibility') {
    const income = v('elIncome'), liab = v('elLiab');
    const ltv = v('elLtv');
    tenor = v('elTenor');
    const stressRate = v('dbrStressRate', 6.76);
    const dbrTh = v('dbrThreshold', 50);
    const maxEMI = Math.max(0, (income * (dbrTh / 100)) - liab);
    loanAmount = maxLoanFromEMI(maxEMI, stressRate, tenor);
    propertyValue = loanAmount / (ltv / 100);
    downPayment = propertyValue - loanAmount;
    downPercent = ltv ? (1 - ltv / 100) * 100 : 0;
    setText('elMaxLoan', `AED ${fmtInt(loanAmount)}`);
    setText('elMaxProp', `AED ${fmtInt(propertyValue)}`);
  }

  const fixedRate = v('fixedRate');
  const fixedYears = v('fixedPeriod');
  const fixedMonths = Math.min(fixedYears * 12, tenor);
  const variableRate = v('variableRate');

  // Determine if we use variable
  const useVariable = emiState.rateType === 'variable' && fixedMonths > 0 && fixedMonths < tenor;

  let firstEMI = 0, varEMI = 0, balanceAfterFixed = loanAmount;
  let fixedInterest = 0, varInterest = 0, totalInterest = 0, totalEMIPaid = 0;

  if (!useVariable) {
    firstEMI = emi(loanAmount, fixedRate, tenor);
    totalEMIPaid = firstEMI * tenor;
    totalInterest = totalEMIPaid - loanAmount;
    fixedInterest = totalInterest;
  } else {
    firstEMI = emi(loanAmount, fixedRate, tenor);
    balanceAfterFixed = remainingBalance(loanAmount, fixedRate, tenor, fixedMonths);
    fixedInterest = firstEMI * fixedMonths - (loanAmount - balanceAfterFixed);
    const remMonths = tenor - fixedMonths;
    varEMI = remMonths > 0 ? emi(balanceAfterFixed, variableRate, remMonths) : 0;
    varInterest = remMonths > 0 ? varEMI * remMonths - balanceAfterFixed : 0;
    totalInterest = fixedInterest + varInterest;
    totalEMIPaid = firstEMI * fixedMonths + varEMI * remMonths;
  }

  // Insurance
  const insOn = $('#insuranceToggle')?.checked || false;
  let insMonthly = 0, totalInsurance = 0, lifeMonthly = 0, propMonthly = 0;
  if (insOn) {
    if ($('#lifeInsToggle')?.checked) {
      const lifeRate = v('lifeInsRate', 0.0159);
      lifeMonthly = (lifeRate / 100) * loanAmount;
    }
    if ($('#propInsToggle')?.checked) {
      const propRate = v('propInsRate', 0.00291);
      propMonthly = (propRate / 100) * propertyValue;
    }
    insMonthly = lifeMonthly + propMonthly;
    totalInsurance = insMonthly * tenor;
  }

  // Transaction
  const transOn = $('#transToggle')?.checked || false;
  const loanType = document.querySelector('input[name="loanType"]:checked')?.value || 'resale';
  let propTrans = 0, mortTrans = 0, transTotal = 0;
  if (transOn) {
    const landDept = (v('tcLandDept') / 100) * propertyValue;
    const agent = (v('tcAgent') / 100) * propertyValue * 1.05;
    const trustee = v('tcTrustee') * 1.05;
    const knowledge = v('tcKnowledge');
    const titleDeed = v('tcTitleDeed');
    propTrans = landDept + (loanType === 'developer' ? 0 : agent) + trustee + knowledge + titleDeed;

    if (loanType !== 'equity') {
      const mortProc = (v('tcMortProc') / 100) * loanAmount * 1.05;
      const mortVal = v('tcMortVal');
      const mortReg = (v('tcMortReg') / 100) * loanAmount;
      const other = v('tcOther');
      mortTrans = mortProc + mortVal + mortReg + other;
    }
    transTotal = propTrans + mortTrans;
  }

  // DBR
  const dbrOn = $('#dbrPolicyToggle')?.checked || false;
  let dbrCurrent = 0, dbrStress = 0, totalIncome = 0, totalLiab = 0;
  if (dbrOn) {
    totalIncome = sumRows(emiState.incomeRows);
    totalLiab = sumRows(emiState.liabRows);
    const stressR = v('dbrStressRate', 6.76);
    const stressEMI = emi(loanAmount, stressR, tenor);
    dbrCurrent = totalIncome > 0 ? (totalLiab / totalIncome) * 100 : 0;
    dbrStress = totalIncome > 0 ? ((stressEMI + totalLiab) / totalIncome) * 100 : 0;
  }

  return {
    mode, propertyValue, downPayment, downPercent, loanAmount, tenor,
    fixedRate, fixedMonths, variableRate, useVariable,
    firstEMI, varEMI, balanceAfterFixed,
    fixedInterest, varInterest, totalInterest, totalEMIPaid,
    insOn, insMonthly, lifeMonthly, propMonthly, totalInsurance,
    transOn, loanType, propTrans, mortTrans, transTotal,
    dbrOn, dbrCurrent, dbrStress, totalIncome, totalLiab,
  };
};

const renderEMI = () => {
  const r = calculateEMI();

  // Loan banner (property mode)
  if ($('#loanAmountDisplay')) $('#loanAmountDisplay').textContent = fmtCur(r.loanAmount);

  // Monthly Payment
  setText('emiMonthly', fmtCur(r.firstEMI + (r.insOn ? r.insMonthly : 0)));
  setText('emiPrincipalInt', fmtInt(r.firstEMI));
  setHide('emiInsRow', !r.insOn);
  if (r.insOn) setText('emiInsAmt', fmtInt(r.insMonthly));

  // Loan Summary
  setText('sPropValue', fmtInt(r.propertyValue));
  setText('sDownPayment', fmtInt(r.downPayment));
  setText('sLoanAmount', fmtInt(r.loanAmount));
  setText('sTenor', `${(r.tenor / 12).toFixed(1)} yrs (${r.tenor} mos)`);
  setText('sRateType', r.useVariable ? 'Fixed then Variable' : 'Fixed');
  setHide('sFixedPeriodRow', !r.useVariable);
  if (r.useVariable) setText('sFixedPeriod', `${(r.fixedMonths / 12).toFixed(0)} yrs (${r.fixedMonths} mos)`);

  // Cost breakdown
  setText('sTotalInterest', fmtInt(r.totalInterest));
  setHide('sFixedInterestRow', !r.useVariable);
  setHide('sVarInterestRow', !r.useVariable);
  if (r.useVariable) {
    setText('sFixedInterest', fmtInt(r.fixedInterest));
    setText('sVarInterest', fmtInt(r.varInterest));
  }
  setHide('sInsuranceRow', !r.insOn);
  if (r.insOn) setText('sTotalIns', fmtInt(r.totalInsurance));

  setText('sTransactionCosts', fmtInt(r.transTotal));
  setText('sPropTrans', fmtInt(r.propTrans));
  setText('sMortTrans', fmtInt(r.mortTrans));
  setText('sLoanTypeBadge', { resale: 'Resale', developer: 'Off-Plan', bt: 'BT', equity: 'Equity' }[r.loanType] || 'Resale');

  setText('sDownPay2', fmtInt(r.downPayment));
  setText('sUpfront', fmtInt(r.downPayment + r.transTotal));

  const totalPaid = r.totalEMIPaid + r.totalInsurance + r.transTotal + r.downPayment;
  setText('sTotalPaid', fmtCur(totalPaid));

  // Bottom: Breakdown
  setText('bdPrincipal', fmtInt(r.loanAmount));
  setText('bdInterest', fmtInt(r.totalInterest));
  setText('bdFixedInt', r.useVariable ? fmtInt(r.fixedInterest) : fmtInt(r.totalInterest));
  setText('bdVarInt', r.useVariable ? fmtInt(r.varInterest) : '0');
  setHide('bdInsRow', !r.insOn);
  if (r.insOn) setText('bdIns', fmtInt(r.totalInsurance));
  setText('bdTotal', fmtInt(r.totalEMIPaid + r.totalInsurance));

  // Donut
  renderDonut(r);
  // Bar chart
  renderPaymentBars(r);
  // Schedule
  renderSchedule(r);
  // Tips
  renderTips(r);
  // DBR pill
  renderEmiDbr(r);

  // Update sub-tab dot indicators
  document.querySelector('.calc-extra-tab[data-extra="insurance"] .calc-dot')?.setAttribute('data-on', r.insOn);
  document.querySelector('.calc-extra-tab[data-extra="transaction"] .calc-dot')?.setAttribute('data-on', r.transOn);
  document.querySelector('.calc-extra-tab[data-extra="dbr"] .calc-dot')?.setAttribute('data-on', r.dbrOn);
};

const renderDonut = (r) => {
  const items = [
    [r.loanAmount, '#05448b', 'Principal'],
    [r.totalInterest, '#f5a623', 'Total Interest'],
    [r.transTotal, '#1c73d6', 'Transaction Costs'],
    [r.downPayment, '#10b981', 'Down Payment'],
    [r.totalInsurance, '#a855f7', 'Insurance'],
  ].filter(([val]) => val > 0);

  const total = items.reduce((s, [val]) => s + val, 0);
  if (total <= 0) return;

  let cumDeg = 0;
  const stops = items.map(([val, color]) => {
    const deg = (val / total) * 360;
    const seg = `${color} ${cumDeg}deg ${cumDeg + deg}deg`;
    cumDeg += deg;
    return seg;
  });
  const donut = $('#costDonut');
  if (donut) donut.style.background = `conic-gradient(${stops.join(', ')})`;
  setText('donutTotal', fmtCur(total));

  const legend = $('#costLegend');
  if (legend) {
    legend.innerHTML = items.map(([val, color, label]) => `
      <li><span class="calc-legend-swatch" style="background:${color}"></span><span>${label}</span><strong>${fmtCur(val)}</strong></li>
    `).join('');
  }
};

const renderPaymentBars = (r) => {
  const wrap = $('#paymentBarChart');
  if (!wrap) return;
  const years = Math.max(1, Math.ceil(r.tenor / 12));
  const bars = [];
  let bal = r.loanAmount;
  for (let y = 1; y <= Math.min(years, 25); y++) {
    let yearPrincipal = 0, yearInterest = 0;
    for (let m = 1; m <= 12 && (y - 1) * 12 + m <= r.tenor; m++) {
      const monthIdx = (y - 1) * 12 + m;
      const useFixed = !r.useVariable || monthIdx <= r.fixedMonths;
      const rate = (useFixed ? r.fixedRate : r.variableRate) / 100 / 12;
      const pmt = useFixed ? r.firstEMI : r.varEMI;
      const interest = bal * rate;
      const principal = Math.max(0, pmt - interest);
      bal = Math.max(0, bal - principal);
      yearPrincipal += principal;
      yearInterest += interest;
    }
    bars.push({ y, principal: yearPrincipal, interest: yearInterest });
  }
  const maxBar = Math.max(...bars.map(b => b.principal + b.interest)) || 1;
  wrap.innerHTML = bars.map(b => {
    const pH = (b.principal / maxBar) * 100;
    const iH = (b.interest / maxBar) * 100;
    return `<div class="calc-bar" title="Year ${b.y}">
      <span class="calc-bar-tooltip">Y${b.y}: P AED ${fmtInt(b.principal)} · I AED ${fmtInt(b.interest)}</span>
      <div class="calc-bar-interest" style="height:${iH}%"></div>
      <div class="calc-bar-principal" style="height:${pH}%"></div>
    </div>`;
  }).join('');
};

const renderSchedule = (r) => {
  const body = $('#scheduleBody');
  if (!body) return;
  const monthly = [];
  let bal = r.loanAmount;
  for (let m = 1; m <= r.tenor; m++) {
    const useFixed = !r.useVariable || m <= r.fixedMonths;
    const rate = (useFixed ? r.fixedRate : r.variableRate) / 100 / 12;
    const pmt = useFixed ? r.firstEMI : r.varEMI;
    const interest = bal * rate;
    const principal = Math.max(0, pmt - interest);
    bal = Math.max(0, bal - principal);
    const ins = r.insOn ? r.insMonthly : 0;
    monthly.push({ m, pmt, interest, principal, ins, balance: bal });
  }

  if (emiState.scheduleView === 'monthly') {
    body.innerHTML = monthly.map(m => `
      <tr><td>M${m.m}</td><td>${fmtInt(m.pmt)}</td><td>${fmtInt(m.interest)}</td><td>${fmtInt(m.principal)}</td><td>${fmtInt(m.ins)}</td><td>${fmtInt(m.balance)}</td></tr>
    `).join('');
  } else {
    const years = [];
    for (let y = 1; y <= Math.ceil(r.tenor / 12); y++) {
      const slice = monthly.slice((y - 1) * 12, y * 12);
      const principal = slice.reduce((a, b) => a + b.principal, 0);
      const interest = slice.reduce((a, b) => a + b.interest, 0);
      const ins = slice.reduce((a, b) => a + b.ins, 0);
      const pmt = slice.length ? slice.reduce((a, b) => a + b.pmt, 0) / slice.length : 0;
      const lastBal = slice.length ? slice[slice.length - 1].balance : 0;
      years.push({ y, pmt, principal, interest, ins, balance: lastBal });
    }
    body.innerHTML = years.map(yr => `
      <tr><td>Y${yr.y}</td><td>${fmtInt(yr.pmt)}</td><td>${fmtInt(yr.interest)}</td><td>${fmtInt(yr.principal)}</td><td>${fmtInt(yr.ins)}</td><td>${fmtInt(yr.balance)}</td></tr>
    `).join('');
  }
};

const renderTips = (r) => {
  const tips = [];
  if (r.downPercent < 25) tips.push({ icon: 'M12 2l9 4v6c0 5-3.5 9-9 10-5.5-1-9-5-9-10V6l9-4z', title: 'Increase your down payment', body: `Boosting from ${r.downPercent.toFixed(0)}% to 25% could save AED ${fmtInt(r.totalInterest * 0.05)} in lifetime interest.` });
  if (r.tenor > 240) tips.push({ icon: 'M12 8v4l3 2', title: 'Shorter tenor saves big', body: 'Going from 25 to 20 years typically reduces total interest by 20–30%.' });
  if (r.fixedRate >= 4) tips.push({ icon: 'M3 17l6-6 4 4 8-8', title: 'Negotiate your rate', body: 'Your rate is above UAE market average. Brokers typically shave 0.25–0.75% off advertised rates.' });
  if (r.dbrOn && r.dbrStress > 50) tips.push({ icon: 'M12 9v4M12 17h.01', title: 'DBR exceeds UAE cap', body: `Stress DBR is ${r.dbrStress.toFixed(1)}% — needs to come below 50%.` });
  if (r.dbrOn && r.dbrStress > 40 && r.dbrStress <= 50) tips.push({ icon: 'M12 2v20', title: 'Healthy DBR — but tight', body: `Stress DBR ${r.dbrStress.toFixed(1)}% is within limit but improvement is recommended.` });
  if (!tips.length) tips.push({ icon: 'M9 12l2 2 4-4', title: 'Your structure looks solid', body: 'Numbers are within healthy UAE lending norms. Talk to a Marker advisor for the sharpest rate.' });

  const el = $('#tipsList');
  if (el) el.innerHTML = tips.map(t => `
    <div class="calc-tip">
      <div class="calc-tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg></div>
      <div><strong>${t.title}</strong><span>${t.body}</span></div>
    </div>
  `).join('');
};

const renderEmiDbr = (r) => {
  setHide('emiDbrPill', !r.dbrOn || r.totalIncome <= 0);
  if (!r.dbrOn || r.totalIncome <= 0) return;
  const v = Math.min(100, Math.max(0, r.dbrStress));
  setText('emiDbrValue', `${v.toFixed(1)}%`);
  $('#emiDbrFill').style.width = `${Math.min(100, v * 2)}%`;
  const status = r.dbrStress <= 40 ? '✓ Comfortably within 50% cap'
    : r.dbrStress <= 50 ? '⚠ Within limit but tight'
    : '✕ Exceeds 50% UAE cap';
  setText('emiDbrStatus', status);
};

// =====================================================================
// DBR CALCULATOR
// =====================================================================
const dbrState = { incomeRows: [], liabRows: [] };

const calculateDBR = () => {
  const loan = v('dbrLoan');
  const stress = v('dbrStress', 6.76);
  const tenor = v('dbrTenor', 300);
  const thresh = v('dbrThresh', 50);
  const income = sumRows(dbrState.incomeRows);
  const liab = sumRows(dbrState.liabRows);
  const stressEMI = emi(loan, stress, tenor);
  const currentDBR = income > 0 ? (liab / income) * 100 : 0;
  const stressDBR = income > 0 ? ((stressEMI + liab) / income) * 100 : 0;
  const maxEMI = Math.max(0, (income * thresh / 100) - liab);
  const maxLoan = maxLoanFromEMI(maxEMI, stress, tenor);
  return { loan, stress, tenor, thresh, income, liab, stressEMI, currentDBR, stressDBR, maxEMI, maxLoan };
};

const renderDBR = () => {
  const r = calculateDBR();
  setText('dbrTotalIncome', `Total: AED ${fmtInt(r.income)}`);
  setText('dbrTotalLiab', `Total: AED ${fmtInt(r.liab)}`);
  setText('dbrThreshAmt', `AED ${fmtInt(r.income * r.thresh / 100)}`);

  setText('dbrReqAmt', fmtCur(r.loan));
  setText('dbrEligibleAmt', fmtCur(r.maxLoan));
  setText('dbrStressEmi', fmtCur(r.stressEMI));
  setText('dbrStressVal', `${r.stressDBR.toFixed(1)}%`);

  setText('dbrCurrent', `${r.currentDBR.toFixed(1)}%`);
  setText('dbrStressR', `${r.stressDBR.toFixed(1)}%`);
  setText('dbrThreshDisp', `${r.thresh}%`);
  setText('dbrDebt', fmtInt(r.liab));
  setText('dbrMaxEmi', fmtInt(r.maxEMI));
  setText('dbrMaxLoan', fmtInt(r.maxLoan));

  const card = $('#dbrStatusCard');
  const eligible = r.maxLoan >= r.loan && r.stressDBR <= r.thresh;
  if (card) card.classList.toggle('bad', !eligible);
  setText('dbrStatusTitle', eligible ? '✓ Loan Approved – Eligible' : '✕ Not Eligible');
  setText('dbrStatusBody', eligible
    ? `Your stress DBR (${r.stressDBR.toFixed(1)}%) is within the ${r.thresh}% UAE Central Bank limit.`
    : `Stress DBR ${r.stressDBR.toFixed(1)}% exceeds the ${r.thresh}% threshold. Reduce loan amount, extend tenor, or clear other debts.`);

  // Tips
  const tips = [];
  if (r.currentDBR > 30) tips.push({ icon: 'M3 17l6-6 4 4 8-8', title: 'Reduce existing liabilities', body: 'Pay off high-interest credit cards or personal loans to free up DBR headroom.' });
  if (r.stressDBR > r.thresh) tips.push({ icon: 'M12 8v4l3 2', title: 'Extend tenor or reduce loan', body: `A longer tenor or smaller loan amount will bring stress DBR below ${r.thresh}%.` });
  if (r.income < 25000) tips.push({ icon: 'M12 2v20', title: 'Boost considered income', body: 'Adding a co-applicant or proving rental/bonus income can lift your eligible loan amount.' });
  if (!tips.length) tips.push({ icon: 'M9 12l2 2 4-4', title: 'Strong eligibility profile', body: 'Your numbers comfortably support the requested loan amount.' });

  const el = $('#dbrTipsList');
  if (el) el.innerHTML = tips.map(t => `
    <div class="calc-tip">
      <div class="calc-tip-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${t.icon}"/></svg></div>
      <div><strong>${t.title}</strong><span>${t.body}</span></div>
    </div>`).join('');
};

// =====================================================================
// BALANCE TRANSFER
// =====================================================================
const renderBT = () => {
  const propValue = v('btPropValue');
  const outstanding = v('btOutstanding');
  const topup = v('btTopup');
  const btType = document.querySelector('input[name="btType"]:checked')?.value || 'bt';
  setHide('btTopupField', btType !== 'topup');
  const newAmt = outstanding + (btType === 'topup' ? topup : 0);

  const exRate = v('exRate'), exTenor = v('exTenor');
  const newRate = v('newRate'), newTenor = v('newTenor');

  const exEMI = emi(outstanding, exRate, exTenor);
  const newEMI = emi(newAmt, newRate, newTenor);
  const monthSavings = exEMI - newEMI;

  const moveCost = v('btReleaseFee') + v('btEarlyFee') + v('btNOC')
    + (v('btMortProc') / 100) * newAmt * 1.05
    + v('btMortVal')
    + (v('btMortReg') / 100) * newAmt;

  const exTotal = exEMI * exTenor;
  const newTotal = newEMI * newTenor;
  const netSavings = (exTotal - newTotal) - moveCost;
  const breakeven = monthSavings > 0 ? Math.ceil(moveCost / monthSavings) : Infinity;

  setText('btExEmi', fmtCur(exEMI));
  setText('btNewEmi', fmtCur(newEMI));
  setText('btMonthSavings', fmtCur(Math.max(0, monthSavings)));
  setText('btMoveCost', fmtCur(moveCost));
  setText('btNetSavings', fmtCur(netSavings));
  setText('btBreakeven', isFinite(breakeven) ? `${breakeven} mos` : '—');

  setText('cmpExEmi', fmtInt(exEMI));
  setText('cmpNewEmi', fmtInt(newEMI));
  setText('cmpSavings', fmtInt(Math.max(0, monthSavings)));
  setText('cmpExTotal', fmtInt(exTotal));
  setText('cmpNewTotal', fmtInt(newTotal));
  setText('cmpMove', fmtInt(moveCost));
  setText('cmpNetSave', fmtInt(netSavings));

  const card = $('#btStatusCard');
  const recommended = netSavings > 0 && breakeven <= 24;
  if (card) card.classList.toggle('bad', !recommended);
  setText('btStatusTitle', recommended ? '✓ Balance Transfer Recommended' : '✕ Balance Transfer Not Recommended');
  setText('btStatusBody', recommended
    ? `You'll save AED ${fmtInt(netSavings)} over the loan, breaking even in ${breakeven} months.`
    : `Net savings (${fmtInt(netSavings)}) don't justify the movement cost. Re-evaluate when rates drop further.`);
};

// =====================================================================
// TRANSACTION COSTS
// =====================================================================
let tcxMode = 'resale';

const renderTC = () => {
  const propValue = v('tcxPropValue');
  const loanAmt = v('tcxLoanAmt');
  const downPayment = Math.max(0, propValue - loanAmt);

  const landDept = (v('tcxLandDept') / 100) * propValue;
  const broker = (v('tcxBroker') / 100) * propValue;
  const brokerVAT = broker * 1.05;
  const trustee = v('tcxTrustee');
  const trusteeVAT = trustee * 1.05;
  const noc = v('tcxNOC');
  const knowledge = v('tcxKnow');
  const titleDeed = v('tcxTitle');

  // Visibility based on mode
  setHide('tcxBrokerRow', tcxMode === 'developer');
  setHide('tcxNOCRow', tcxMode !== 'bt');
  setHide('tcxBrokerOutRow', tcxMode === 'developer');
  setHide('tcxNOCOutRow', tcxMode !== 'bt');
  setHide('tcxMortCard', tcxMode === 'equity');
  setHide('tcxMortValRow', tcxMode === 'equity');
  setHide('tcxMortProcRow', tcxMode === 'equity');
  setHide('tcxMortRegRow', tcxMode === 'equity');
  setHide('tcxMortSubRow', tcxMode === 'equity');

  // Live calc fields
  $('#tcxLandDeptCalc').value = fmtInt(landDept);
  $('#tcxBrokerCalc').value = fmtInt(brokerVAT);
  $('#tcxTrusteeCalc').value = fmtInt(trusteeVAT);

  let propSubtotal = landDept + trustee + (tcxMode === 'developer' ? 0 : brokerVAT - broker + broker) + (tcxMode === 'bt' ? noc : 0) + knowledge + titleDeed;
  // Use VAT-inclusive broker
  propSubtotal = landDept + (tcxMode === 'developer' ? 0 : brokerVAT) + trusteeVAT + (tcxMode === 'bt' ? noc : 0) + knowledge + titleDeed;

  let mortProc = 0, mortVal = 0, mortReg = 0, mortOther = 0, mortSubtotal = 0;
  const mortOn = $('#tcxMortToggle')?.checked && tcxMode !== 'equity';
  if (mortOn) {
    mortProc = (v('tcxMortProc') / 100) * loanAmt * 1.05;
    mortVal = v('tcxMortVal');
    mortReg = (v('tcxMortReg') / 100) * loanAmt;
    mortOther = v('tcxOther');
    mortSubtotal = mortProc + mortVal + mortReg + mortOther;
    $('#tcxMortProcCalc').value = fmtInt(mortProc);
  }

  const totalCost = propSubtotal + mortSubtotal;
  const cashRequired = downPayment + totalCost;

  setText('tcxTotalCost', fmtCur(totalCost));
  setText('tcxDown', fmtInt(downPayment));
  setText('tcxRegOut', fmtInt(landDept));
  setText('tcxBrokerOut', fmtInt(brokerVAT));
  setText('tcxTrusteeOut', fmtInt(trusteeVAT));
  setText('tcxNOCOut', fmtInt(noc));
  setText('tcxKnowOut', fmtInt(knowledge));
  setText('tcxTitleOut', fmtInt(titleDeed));
  setText('tcxPropSub', fmtInt(propSubtotal));
  setText('tcxMortValOut', fmtInt(mortVal));
  setText('tcxMortProcOut', fmtInt(mortProc));
  setText('tcxMortRegOut', fmtInt(mortReg));
  setText('tcxMortSub', fmtInt(mortSubtotal));
  setText('tcxCash', fmtCur(cashRequired));
};

// =====================================================================
// ROI / INVESTMENT
// =====================================================================
const renderROI = () => {
  const price = v('roiPrice');
  const trustee = v('roiTrustee');
  const reg = (v('roiReg') / 100) * price;
  const broker = (v('roiBroker') / 100) * price * 1.05;
  const noc = v('roiNOC');
  const other = v('roiOther');
  const totalUpfront = price + reg + broker + trustee + noc + other;

  const area = v('roiArea'), maintRate = v('roiMaintRate');
  const maintTotal = area * maintRate;
  $('#roiMaintTotal').value = fmtInt(maintTotal);

  const annualRent = v('roiRent');
  const mgmt = v('roiMgmt');
  const insurance = v('roiIns');

  const mortOn = $('#roiMortToggle')?.checked || false;
  const loan = mortOn ? v('roiLoan') : 0;
  const rate = v('roiRate');
  const tenor = v('roiTenor');
  const monthlyEMI = mortOn ? emi(loan, rate, tenor) : 0;
  const annualEMI = monthlyEMI * 12;

  const netUpfront = totalUpfront - loan;

  // Monthly
  const monthlyRent = annualRent / 12;
  const monthlyMgmt = mgmt / 12;
  const monthlyMaint = maintTotal / 12;
  const monthlyIns = insurance / 12;
  const monthlyExpense = monthlyEMI + monthlyMgmt + monthlyMaint + monthlyIns;
  const monthlyCash = monthlyRent - monthlyExpense;

  // Break-even
  const annualCash = monthlyCash * 12;
  const yearsToProfit = annualCash > 0 ? (netUpfront / annualCash).toFixed(1) : '∞';

  setText('roiUPrice', fmtInt(price));
  setText('roiURegFee', fmtInt(reg));
  setText('roiUBroker', fmtInt(broker));
  setText('roiUTrustee', fmtInt(trustee));
  setText('roiUTotal', fmtInt(totalUpfront));
  setText('roiULess', fmtInt(loan));
  setText('roiUNet', fmtCur(netUpfront));
  setText('roiMRent', fmtInt(monthlyRent));
  setText('roiMEmi', fmtInt(monthlyEMI));
  setText('roiMService', fmtInt(monthlyMgmt + monthlyMaint));
  setText('roiMIns', fmtInt(monthlyIns));
  setText('roiMExp', fmtInt(monthlyExpense));
  setText('roiMCash', fmtCur(monthlyCash));
  setText('roiBI', fmtInt(netUpfront));
  setText('roiBC', fmtInt(annualCash));
  setText('roiBYears', `${yearsToProfit} yrs`);

  // 3-year projection
  const growth = v('roiGrowth') / 100;
  const inflation = v('roiInflation') / 100;
  const appreciation = v('roiAppr') / 100;
  let propValue = price;
  const projections = [];
  for (let y = 1; y <= 3; y++) {
    const rent = annualRent * Math.pow(1 + growth, y - 1);
    const expenses = (mgmt + maintTotal + insurance) * Math.pow(1 + inflation, y - 1) + annualEMI;
    const cashflow = rent - expenses;
    propValue *= (1 + appreciation);
    const annualROI = netUpfront > 0 ? (cashflow / netUpfront) * 100 : 0;
    const totalROI = netUpfront > 0 ? ((cashflow + (propValue - price)) / netUpfront) * 100 : 0;
    projections.push({ y, rent, expenses, cashflow, propValue, annualROI, totalROI });
  }

  const wrap = $('#roiProjections');
  if (wrap) wrap.innerHTML = projections.map(p => `
    <div class="calc-proj">
      <h4>Year ${p.y}</h4>
      <div class="calc-summary-row"><span>Annual Rent</span><strong>${fmtInt(p.rent)}</strong></div>
      <div class="calc-summary-row"><span>Annual Expenses</span><strong>${fmtInt(p.expenses)}</strong></div>
      <div class="calc-summary-row"><span>Net Cashflow</span><strong>${fmtInt(p.cashflow)}</strong></div>
      <div class="calc-summary-row"><span>Property Value</span><strong>${fmtInt(p.propValue)}</strong></div>
      <div class="calc-summary-row calc-summary-row--accent"><span>Annual ROI</span><strong>${p.annualROI.toFixed(2)}%</strong></div>
      <div class="calc-summary-row calc-summary-row--accent"><span>Total ROI (incl. appr.)</span><strong>${p.totalROI.toFixed(2)}%</strong></div>
    </div>
  `).join('');
};

// =====================================================================
// TENOR
// =====================================================================
const tnLimits = {
  uae: { salaried: 70, self: 70 },
  expat: { salaried: 65, self: 70 },
};

const renderTenor = () => {
  const dob = $('#tnDob')?.value;
  if (!dob) return;
  const dobDate = new Date(dob);
  const today = new Date();
  const ageMs = today - dobDate;
  const ageYears = Math.floor(ageMs / (1000 * 60 * 60 * 24 * 365.25));
  const ageMonths = Math.floor((ageMs / (1000 * 60 * 60 * 24 * 30.44)) % 12);
  const ageDays = Math.floor((today - new Date(dobDate.getFullYear() + ageYears, dobDate.getMonth() + ageMonths, dobDate.getDate())) / (1000 * 60 * 60 * 24));

  const nat = document.querySelector('input[name="tnNat"]:checked')?.value || 'uae';
  const emp = document.querySelector('input[name="tnEmp"]:checked')?.value || 'salaried';
  const maxAge = tnLimits[nat][emp];
  const maxTenor = Math.max(0, (maxAge - ageYears) * 12 - 2);

  const tenor = v('tnTenor', 300);
  const matAge = ageYears + Math.floor(tenor / 12);
  const matMonths = ageMonths + (tenor % 12);

  setText('tnCurrentAge', `${ageYears} yrs`);
  setText('tnCurrentAgeSub', `${ageMonths} months, ${ageDays} days`);
  setText('tnMaturity', `${matAge} yrs`);
  setText('tnMaturitySub', `${matMonths} months`);
  setText('tnMaxTenor', `${maxTenor} mos`);
  setText('tnCategory', `${nat === 'uae' ? 'UAE National' : 'Expat'} – ${emp === 'salaried' ? 'Salaried' : 'Self-Employed'} · Max age ${maxAge}`);
};

// =====================================================================
// REF DATA
// =====================================================================
const banksData = [
  { name: 'ADIB', type: 'fixed', emp: 'salaried,self', fixedRate: 3.99, postRate: 'EIBOR + 2.0%', eibor: 5.20, stress: 6.76, life: '0.0159%', dbr: 50 },
  { name: 'Ajman Bank', type: 'fixed', emp: 'salaried', fixedRate: 4.25, postRate: 'EIBOR + 1.95%', eibor: 5.20, stress: 6.76, life: '0.0125%', dbr: 50 },
  { name: 'CBD', type: 'variable', emp: 'salaried,self', fixedRate: 3.79, postRate: 'EIBOR + 1.75%', eibor: 5.20, stress: 6.76, life: '0.018%', dbr: 50 },
  { name: 'DIB (Dubai Islamic Bank)', type: 'fixed', emp: 'salaried,self', fixedRate: 4.10, postRate: 'EIBOR + 2.0%', eibor: 5.20, stress: 6.76, life: '0.013%', dbr: 50 },
  { name: 'Emirates NBD', type: 'variable', emp: 'salaried,self', fixedRate: 3.69, postRate: 'EIBOR + 1.5%', eibor: 5.20, stress: 6.76, life: '0.0159%', dbr: 50 },
  { name: 'Emirates Islamic', type: 'fixed', emp: 'salaried', fixedRate: 4.05, postRate: 'EIBOR + 2.0%', eibor: 5.20, stress: 6.76, life: '0.014%', dbr: 50 },
  { name: 'FAB', type: 'fixed', emp: 'salaried,self', fixedRate: 3.85, postRate: 'EIBOR + 1.85%', eibor: 5.20, stress: 6.76, life: '0.013%', dbr: 50 },
  { name: 'HSBC', type: 'fixed', emp: 'salaried', fixedRate: 4.10, postRate: 'EIBOR + 2.25%', eibor: 5.20, stress: 6.76, life: '0.014%', dbr: 50 },
  { name: 'Mashreq', type: 'variable', emp: 'salaried,self', fixedRate: 3.95, postRate: 'EIBOR + 1.85%', eibor: 5.20, stress: 6.76, life: '0.016%', dbr: 50 },
  { name: 'NBF', type: 'fixed', emp: 'salaried', fixedRate: 4.50, postRate: 'EIBOR + 2.5%', eibor: 5.20, stress: 6.76, life: '0.018%', dbr: 50 },
  { name: 'NBQ', type: 'fixed', emp: 'salaried', fixedRate: 4.45, postRate: 'EIBOR + 2.4%', eibor: 5.20, stress: 6.76, life: '0.017%', dbr: 50 },
  { name: 'RAK Bank', type: 'fixed', emp: 'salaried,self', fixedRate: 3.99, postRate: 'EIBOR + 1.95%', eibor: 5.20, stress: 6.76, life: '0.015%', dbr: 50 },
  { name: 'Sharjah Islamic', type: 'fixed', emp: 'salaried', fixedRate: 4.20, postRate: 'EIBOR + 2.1%', eibor: 5.20, stress: 6.76, life: '0.013%', dbr: 50 },
  { name: 'Standard Chartered', type: 'variable', emp: 'salaried', fixedRate: 4.00, postRate: 'EIBOR + 2.0%', eibor: 5.20, stress: 6.76, life: '0.014%', dbr: 50 },
  { name: 'United Arab Bank', type: 'fixed', emp: 'salaried', fixedRate: 4.30, postRate: 'EIBOR + 2.25%', eibor: 5.20, stress: 6.76, life: '0.016%', dbr: 50 },
  { name: 'Bank of Baroda', type: 'fixed', emp: 'salaried,self', fixedRate: 4.40, postRate: 'EIBOR + 2.3%', eibor: 5.20, stress: 6.76, life: '0.018%', dbr: 50 },
  { name: 'Arab Bank', type: 'fixed', emp: 'salaried', fixedRate: 4.25, postRate: 'EIBOR + 2.15%', eibor: 5.20, stress: 6.76, life: '0.015%', dbr: 50 },
];

const insuranceData = banksData.map(b => ({
  name: b.name,
  lifeConv: b.life,
  lifeIslamic: b.name.toLowerCase().includes('islamic') || b.name.includes('DIB') ? b.life : 'N/A',
  propConv: '0.00291%',
  propIslamic: b.name.toLowerCase().includes('islamic') || b.name.includes('DIB') ? '0.0027%' : 'N/A',
}));

const liabilitiesData = banksData.map(b => ({
  name: b.name,
  personal: '100%', mortgage: '100%', auto: '100%',
  other: '100%', overdraft: '5% of limit', creditCard: '5% of limit',
}));

const renderRefStress = (filter = 'all') => {
  const body = $('#stressBody');
  if (!body) return;
  const rows = banksData.filter(b => filter === 'all' || b.name === filter);
  setText('stressCount', `${rows.length} entries`);
  body.innerHTML = rows.map(b => `
    <tr>
      <td>${b.name}</td>
      <td><span class="calc-chip" style="background:${b.type === 'fixed' ? '#e0f2fe' : '#fef3c7'};color:${b.type === 'fixed' ? '#075985' : '#92400e'}">${b.type}</span></td>
      <td>${b.emp}</td>
      <td>${b.fixedRate}%</td>
      <td>${b.postRate}</td>
      <td>${b.eibor}%</td>
      <td>${b.stress}%</td>
      <td>${b.life}</td>
      <td>${b.dbr}%</td>
    </tr>
  `).join('');
};
const renderRefIns = () => {
  const body = $('#insBody');
  if (!body) return;
  body.innerHTML = insuranceData.map(b => `
    <tr><td>${b.name}</td><td>${b.lifeConv}</td><td>${b.lifeIslamic}</td><td>${b.propConv}</td><td>${b.propIslamic}</td></tr>
  `).join('');
};
const renderRefLiab = () => {
  const body = $('#liabBody');
  if (!body) return;
  body.innerHTML = liabilitiesData.map(b => `
    <tr><td>${b.name}</td><td>${b.personal}</td><td>${b.mortgage}</td><td>${b.auto}</td><td>${b.other}</td><td>${b.overdraft}</td><td>${b.creditCard}</td></tr>
  `).join('');
};
const renderRefByBank = () => {
  const sel = $('#bankSelect');
  if (!sel) return;
  if (!sel.options.length) {
    sel.innerHTML = banksData.map(b => `<option>${b.name}</option>`).join('');
  }
  const name = sel.value || banksData[0].name;
  const b = banksData.find(x => x.name === name);
  if (!b) return;
  $('#byBankContent').innerHTML = `
    <div class="calc-summary"><div class="calc-summary-head calc-summary-head--plain">STRESS &amp; DBR</div>
      <div class="calc-summary-row"><span>Type</span><strong>${b.type}</strong></div>
      <div class="calc-summary-row"><span>Employment</span><strong>${b.emp}</strong></div>
      <div class="calc-summary-row"><span>Fixed Rate</span><strong>${b.fixedRate}%</strong></div>
      <div class="calc-summary-row"><span>Post / Margin</span><strong>${b.postRate}</strong></div>
      <div class="calc-summary-row"><span>Stress Rate</span><strong>${b.stress}%</strong></div>
      <div class="calc-summary-row"><span>Max DBR</span><strong>${b.dbr}%</strong></div>
    </div>
  `;
};
const docState = { nat: 'expat', res: 'resident', emp: 'salaried' };
const renderDocs = () => {
  const { nat, res, emp } = docState;
  let docs = {};

  if (res === 'non' && emp === 'salaried') {
    docs = {
      Identity: [
        'Passport copy',
        'Emirates ID card (front &amp; back) or Iqama',
        'Proof of residence overseas (utility or mobile bill)',
      ],
      Income: [
        'Salary certificate (English, addressed to ADIB)',
        'Latest 6 months payslips',
      ],
      Bank: [
        '6 months bank statements (English)',
        'Credit bureau report from country of employment',
      ],
      Other: [
        'Filled and signed details sheet (provided by us)',
      ],
    };
  } else if (res === 'non' && emp === 'self') {
    docs = {
      Identity: [
        'Passport',
        'National ID card (front &amp; back)',
        'Latest proof of residence (electricity bill, dated within 30 to 60 days)',
      ],
      Income: [
        'Trade licence / Chamber of Commerce certificate',
        'Last 2 years company audited financial reports (if available)',
        'Last 2 years tax returns',
        'Memorandum and Articles of Association (MOA), if applicable',
      ],
      Bank: [
        'Personal bank statements',
        'Company bank statements',
      ],
      Business: [
        'Company website address',
        'Company profile',
        'Copy of tenancy contract for office',
      ],
      Other: [
        'Civil bureau report',
      ],
    };
  } else {
    docs = {
      Identity: ['Passport copy (all pages)', 'Emirates ID copy', 'Visa page copy'],
      Income: emp === 'salaried'
        ? ['Salary certificate (latest)', '6 months bank statements showing salary', '6 months payslips']
        : ['Trade licence copy', 'Audited financial statements (last 2 years)', '12 months business bank statements', 'VAT certificate'],
      Bank: ['6 months personal bank statements', 'Liability letter from existing banks (if applicable)'],
      Property: ['MOU / Sale agreement', 'Title deed copy', 'Property valuation report', 'Floor plan'],
      Other: ['Tenancy contract (if applicable)', 'Existing loan statements'],
    };
    if (nat === 'expat') docs.Identity.push('Residence visa copy');
  }

  let total = 0;
  let html = '';
  for (const [section, items] of Object.entries(docs)) {
    html += `<div class="calc-doc-section"><strong>${section} Documents</strong><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>`;
    total += items.length;
  }
  setText('docCount', total);
  $('#docList').innerHTML = html;
};

// =====================================================================
// MASTER RENDER
// =====================================================================
const renderAll = () => {
  renderEMI();
  renderDBR();
  renderBT();
  renderTC();
  renderROI();
  renderTenor();
};

// =====================================================================
// EVENT BINDINGS
// =====================================================================

// Top tool tabs
$$('.calc-hero .calc-tabs .calc-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.calc-hero .calc-tabs .calc-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const tool = btn.dataset.tool;
    $$('.calc-tool').forEach(s => s.hidden = s.dataset.toolPane !== tool);
    location.hash = tool;
  });
});

// Hash routing on load
window.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#', '');
  if (hash) {
    const tab = document.querySelector(`.calc-hero .calc-tabs .calc-tab[data-tool="${hash}"]`);
    if (tab) tab.click();
  }
});

// Currency
$$('.calc-toggle--currency button').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCurrency = btn.dataset.currency;
    renderAll();
  });
});

// EMI mode buttons
document.querySelectorAll('[data-tool-pane="emi"] .calc-mode').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[data-tool-pane="emi"] .calc-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    emiState.mode = btn.dataset.mode;
    document.querySelectorAll('[data-emi-mode]').forEach(c => c.hidden = c.dataset.emiMode !== emiState.mode);
    renderEMI();
  });
});

// EMI tenor unit toggle
document.querySelectorAll('.calc-toggle--tenor button').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const newUnit = btn.dataset.unit;
    const input = $('#loanTenor');
    if (newUnit === 'years' && emiState.tenorUnit === 'months') {
      input.value = Math.round(input.value / 12);
      input.step = 1; input.max = 30;
    } else if (newUnit === 'months' && emiState.tenorUnit === 'years') {
      input.value = input.value * 12;
      input.step = 12; input.max = 360;
    }
    emiState.tenorUnit = newUnit;
    renderEMI();
  });
});

// EMI rate toggle
document.querySelectorAll('.calc-toggle--rate button').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    emiState.rateType = btn.dataset.rate;
    setHide('variableField', emiState.rateType === 'fixed');
    renderEMI();
  });
});

// EMI extras tabs
$$('[data-tool-pane="emi"] .calc-extra-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const which = btn.dataset.extra;
    $$('[data-tool-pane="emi"] .calc-extra-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === which));
  });
});

// EMI insurance toggle
$('#insuranceToggle')?.addEventListener('change', (e) => {
  const on = e.target.checked;
  setHide('insuranceDetail', !on);
  e.target.parentElement.querySelector('.calc-switch-label').textContent = on ? 'Enabled' : 'Disabled';
  renderEMI();
});
$('#transToggle')?.addEventListener('change', (e) => {
  const on = e.target.checked;
  setHide('transDetail', !on);
  e.target.parentElement.querySelector('.calc-switch-label').textContent = on ? 'Enabled' : 'Disabled';
  renderEMI();
});
$('#dbrPolicyToggle')?.addEventListener('change', (e) => {
  const on = e.target.checked;
  setHide('dbrPolicyDetail', !on);
  e.target.parentElement.querySelector('.calc-switch-label').textContent = on ? 'Enabled' : 'Disabled';
  if (on && emiState.incomeRows.length === 0) {
    emiState.incomeRows.push(addRow(null, incomeTypes, { type: 'Salary', amount: 25000 }));
    renderRows('emiIncomeRows', emiState.incomeRows, incomeTypes);
  }
  renderEMI();
});

// Add buttons
document.querySelectorAll('.calc-add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.add;
    if (target === 'emiIncome') { emiState.incomeRows.push(addRow(null, incomeTypes)); renderRows('emiIncomeRows', emiState.incomeRows, incomeTypes); }
    else if (target === 'emiLiab') { emiState.liabRows.push(addRow(null, liabTypes)); renderRows('emiLiabRows', emiState.liabRows, liabTypes); }
    else if (target === 'dbrIncome') { dbrState.incomeRows.push(addRow(null, incomeTypes)); renderRows('dbrIncomeRows', dbrState.incomeRows, incomeTypes); }
    else if (target === 'dbrLiab') { dbrState.liabRows.push(addRow(null, liabTypes)); renderRows('dbrLiabRows', dbrState.liabRows, liabTypes); }
    renderAll();
  });
});

// Bottom tabs
$$('.calc-bottom-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const which = btn.dataset.bottom;
    $$('[data-tool-pane="emi"] .calc-bottom-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === which));
  });
});

// Schedule toggle
$$('.calc-toggle--schedule button').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    emiState.scheduleView = btn.dataset.schedule;
    renderEMI();
  });
});

// Transaction loan type radios
document.querySelectorAll('input[name="loanType"]').forEach(r => r.addEventListener('change', renderEMI));

// BT type
document.querySelectorAll('input[name="btType"]').forEach(r => r.addEventListener('change', renderBT));

// TC mode
document.querySelectorAll('[data-tc]').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('.calc-mode').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    tcxMode = btn.dataset.tc;
    renderTC();
  });
});
$('#tcxMortToggle')?.addEventListener('change', renderTC);

// ROI mortgage toggle
$('#roiMortToggle')?.addEventListener('change', renderROI);

// Tenor radios
document.querySelectorAll('input[name="tnNat"], input[name="tnEmp"]').forEach(r => r.addEventListener('change', renderTenor));

// Ref data sub-tabs
$$('[data-tool-pane="ref"] .calc-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const which = btn.dataset.ref;
    $$('.calc-ref-pane').forEach(p => {
      const match = p.dataset.refpane === which;
      p.classList.toggle('active', match);
      p.hidden = !match;
    });
    if (which === 'bybank') renderRefByBank();
  });
});
$('#stressFilter')?.addEventListener('change', (e) => renderRefStress(e.target.value));
$('#bankSelect')?.addEventListener('change', renderRefByBank);

// Doc filters
document.querySelectorAll('[data-doc]').forEach(btn => {
  btn.addEventListener('click', () => {
    const k = btn.dataset.doc;
    btn.parentElement.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    docState[k] = btn.dataset.val;
    renderDocs();
  });
});

// Action buttons (copy, download, reset, csv, copyDocs)
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  const r = calculateEMI();
  if (action === 'copy') {
    const text = `Marker Finance EMI: AED ${fmtInt(r.firstEMI)}/mo · Loan AED ${fmtInt(r.loanAmount)} · ${r.tenor} mos @ ${r.fixedRate}%`;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  } else if (action === 'download') {
    const text = `Marker Finance — EMI Estimate
Property: AED ${fmtInt(r.propertyValue)}
Down: AED ${fmtInt(r.downPayment)} (${r.downPercent.toFixed(1)}%)
Loan: AED ${fmtInt(r.loanAmount)}
Tenor: ${r.tenor} months
Rate: ${r.fixedRate}% ${r.useVariable ? `then ${r.variableRate}%` : ''}
Monthly EMI: AED ${fmtInt(r.firstEMI)}
Total Interest: AED ${fmtInt(r.totalInterest)}
Total Paid: AED ${fmtInt(r.totalEMIPaid + r.totalInsurance + r.transTotal + r.downPayment)}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marker-finance-emi-estimate.txt';
    a.click();
  } else if (action === 'reset') {
    document.querySelectorAll('[data-tool-pane="emi"] input[type="number"]').forEach(i => {
      const def = i.defaultValue;
      if (def) i.value = def;
    });
    renderEMI();
  } else if (action === 'csv') {
    const r = calculateEMI();
    const monthly = [];
    let bal = r.loanAmount;
    let rows = 'Period,EMI,Interest,Principal,Insurance,Balance\n';
    for (let m = 1; m <= r.tenor; m++) {
      const useFixed = !r.useVariable || m <= r.fixedMonths;
      const rate = (useFixed ? r.fixedRate : r.variableRate) / 100 / 12;
      const pmt = useFixed ? r.firstEMI : r.varEMI;
      const interest = bal * rate;
      const principal = Math.max(0, pmt - interest);
      bal = Math.max(0, bal - principal);
      const ins = r.insOn ? r.insMonthly : 0;
      rows += `M${m},${pmt.toFixed(2)},${interest.toFixed(2)},${principal.toFixed(2)},${ins.toFixed(2)},${bal.toFixed(2)}\n`;
    }
    const blob = new Blob([rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'marker-finance-amortization.csv';
    a.click();
  } else if (action === 'copyDocs') {
    navigator.clipboard.writeText($('#docList').innerText);
    alert('Document list copied');
  }
});

// Live update on any input
document.querySelectorAll('input, select').forEach(input => {
  input.addEventListener('input', renderAll);
});

// Init
window.addEventListener('DOMContentLoaded', () => {
  // Stress filter dropdown
  const sf = $('#stressFilter');
  if (sf && sf.options.length === 1) {
    banksData.forEach(b => {
      const o = document.createElement('option');
      o.value = b.name; o.textContent = b.name;
      sf.appendChild(o);
    });
  }

  // Default DBR rows
  if (dbrState.incomeRows.length === 0) {
    dbrState.incomeRows.push(addRow(null, incomeTypes, { type: 'Salary', amount: 25000 }));
    renderRows('dbrIncomeRows', dbrState.incomeRows, incomeTypes);
  }

  renderRefStress();
  renderRefIns();
  renderRefLiab();
  renderRefByBank();
  renderDocs();
  renderAll();
});
