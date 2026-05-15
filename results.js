import { getTransactionDutyRate } from './lib/stateDuty.js';
import { trackButtonClick, trackPageView, trackValueSubmit } from './firebaseAnalytics.js';

// Get stored values
const propertyPrice = parseInt(localStorage.getItem('houseValue')) || 10000000;
const selectedCity = localStorage.getItem('selectedCity') || 'Bangalore';
const transactionDutyPct = getTransactionDutyRate(selectedCity);
trackPageView('results');

// Default model inputs
let modelInputs = {
  propertyStatus: 'Ready',
  propertyPrice: propertyPrice,
  transactionDutyPct: transactionDutyPct,
  interiorsPct: 0.2,
  homeLoanLtvPct: 0.8,
  homeLoanTenureYears: 20,
  selectedHomeLoanRatePct: 0.085,
  constructionDurationYears: 3,
  drawdownSchedule: [
    { id: 'drawdown-1', year: 0, percentage: 0.3 },
    { id: 'drawdown-2', year: 1, percentage: 0.3 },
    { id: 'drawdown-3', year: 2, percentage: 0.2 },
    { id: 'drawdown-4', year: 3, percentage: 0.2 },
  ],
  zincLoanStructure: 'Interest Only',
  zincLoanTenureYears: 10,
  zincPaymentReinvestmentCagrPct: 0.06,
  assets: {
    cash: { cagrPct: 0.06 },
    land: {
      embeddedGainPct: 0.6,
      ltcgTaxRatePct: 0.125,
      exemptionAmount: 0,
      cagrPct: 0.08,
    },
    indianEquity: {
      embeddedGainPct: 0.5,
      ltcgTaxRatePct: 0.125,
      exemptionAmount: 125000,
      cagrPct: 0.12,
    },
    foreignRsu: {
      embeddedGainPct: 0.4,
      ltcgTaxRatePct: 0.125,
      exemptionAmount: 0,
      usdCagrPct: 0.12,
      inrDepreciationPct: 0.025,
    },
  },
};

// Calculation functions
const READY_GST_RATE = 0;
const UNDER_CONSTRUCTION_GST_RATE = 0.05;
const ZINC_RATE_SPREAD = 0.02;
const ZINC_RATE_CAP = 0.125;

function nonNegative(value) {
  return Math.max(Number.isFinite(value) ? value : 0, 0);
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function monthsFromYears(years) {
  return Math.max(Math.round(nonNegative(years) * 12), 0);
}

function calculateEmi(principal, annualRate, years) {
  const sanitizedPrincipal = nonNegative(principal);
  const months = monthsFromYears(years);
  if (sanitizedPrincipal === 0 || months === 0) return 0;
  const monthlyRate = nonNegative(annualRate) / 12;
  if (monthlyRate === 0) return sanitizedPrincipal / months;
  const growthFactor = (1 + monthlyRate) ** months;
  return (sanitizedPrincipal * monthlyRate * growthFactor) / (growthFactor - 1);
}

function buildAmortizationSchedule(principal, annualRate, years) {
  const sanitizedPrincipal = nonNegative(principal);
  const sanitizedRate = nonNegative(annualRate);
  const months = monthsFromYears(years);
  if (sanitizedPrincipal === 0 || months === 0) return [];

  const monthlyRate = sanitizedRate / 12;
  const scheduledPayment = calculateEmi(sanitizedPrincipal, sanitizedRate, years);
  const schedule = [];
  let remainingPrincipal = sanitizedPrincipal;
  let cumulativeInterest = 0;

  for (let month = 1; month <= months; month++) {
    const interestPayment = monthlyRate === 0 ? 0 : remainingPrincipal * monthlyRate;
    const principalPayment = Math.min(Math.max(scheduledPayment - interestPayment, 0), remainingPrincipal);
    remainingPrincipal = Math.max(remainingPrincipal - principalPayment, 0);
    cumulativeInterest += interestPayment;
    schedule.push({ month, cumulativeInterest, remainingPrincipal });
  }
  return schedule;
}

function getInterestPaidByYear(schedule, year) {
  if (schedule.length === 0) return 0;
  const months = Math.min(schedule.length, monthsFromYears(year));
  if (months === 0) return 0;
  return schedule[months - 1].cumulativeInterest;
}

function calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption) {
  const netFundingGap = nonNegative(fundingGap);
  const gainRate = nonNegative(embeddedGainPct);
  const effectiveTaxRate = nonNegative(taxRate);
  const exemptAmount = nonNegative(exemption);
  if (netFundingGap === 0) return 0;
  if (netFundingGap * gainRate <= exemptAmount) return netFundingGap;
  const denominator = 1 - gainRate * effectiveTaxRate;
  if (denominator <= 0) return netFundingGap;
  return (netFundingGap - exemptAmount * effectiveTaxRate) / denominator;
}

function calculateFutureValue(presentValue, cagr, years) {
  return nonNegative(presentValue) * (1 + safeNumber(cagr)) ** nonNegative(years);
}

function calculateEffectiveRsuInrCagr(usdCagr, inrDepreciation) {
  return (1 + safeNumber(usdCagr)) * (1 + safeNumber(inrDepreciation)) - 1;
}

function deriveZincLoanRate(homeLoanRate) {
  return Math.min(nonNegative(homeLoanRate) + ZINC_RATE_SPREAD, ZINC_RATE_CAP);
}

function calculatePreEmiInterest(homeLoanAmount, annualRate, drawdownSchedule, constructionDurationYears) {
  const sanitizedHomeLoanAmount = nonNegative(homeLoanAmount);
  const sanitizedAnnualRate = nonNegative(annualRate);
  const sanitizedConstructionDuration = nonNegative(constructionDurationYears);

  let totalInterest = 0;
  drawdownSchedule.forEach(row => {
    const trancheAmount = sanitizedHomeLoanAmount * safeNumber(row.percentage);
    const yearsOutstanding = Math.max(sanitizedConstructionDuration - safeNumber(row.year), 0);
    totalInterest += trancheAmount * sanitizedAnnualRate * yearsOutstanding;
  });
  return totalInterest;
}

function calculateModel(inputs) {
  const analysisHorizonYears = nonNegative(inputs.zincLoanTenureYears);
  const propertyPrice = nonNegative(inputs.propertyPrice);
  const gstRate = inputs.propertyStatus === 'Under Construction' ? UNDER_CONSTRUCTION_GST_RATE : READY_GST_RATE;

  const homeLoanAmount = propertyPrice * nonNegative(inputs.homeLoanLtvPct);
  const downPayment = propertyPrice * (1 - nonNegative(inputs.homeLoanLtvPct));
  const transactionDuty = propertyPrice * nonNegative(inputs.transactionDutyPct);
  const gst = propertyPrice * gstRate;
  const interiors = propertyPrice * nonNegative(inputs.interiorsPct);
  const fundingGap = downPayment + transactionDuty + gst + interiors;

  const homeLoanSchedule = buildAmortizationSchedule(homeLoanAmount, inputs.selectedHomeLoanRatePct, inputs.homeLoanTenureYears);
  const monthlyEmi = calculateEmi(homeLoanAmount, inputs.selectedHomeLoanRatePct, inputs.homeLoanTenureYears);
  const interestPaidByTenYears = getInterestPaidByYear(homeLoanSchedule, analysisHorizonYears);

  const preEmiInterest = inputs.propertyStatus === 'Under Construction'
    ? calculatePreEmiInterest(homeLoanAmount, inputs.selectedHomeLoanRatePct, inputs.drawdownSchedule, inputs.constructionDurationYears)
    : 0;

  const effectiveRsuInrCagr = calculateEffectiveRsuInrCagr(inputs.assets.foreignRsu.usdCagrPct, inputs.assets.foreignRsu.inrDepreciationPct);

  const strategies = [];

  const cashFutureValue = calculateFutureValue(fundingGap, inputs.assets.cash.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'use-cash',
    strategyName: 'Use cash',
    impact: cashFutureValue,
    rank: 0
  });

  const landGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.land.embeddedGainPct, inputs.assets.land.ltcgTaxRatePct, inputs.assets.land.exemptionAmount);
  const landFutureValue = calculateFutureValue(landGrossSale, inputs.assets.land.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-land',
    strategyName: 'Sell Land',
    impact: landFutureValue,
    rank: 0
  });

  const equityGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.indianEquity.embeddedGainPct, inputs.assets.indianEquity.ltcgTaxRatePct, inputs.assets.indianEquity.exemptionAmount);
  const equityFutureValue = calculateFutureValue(equityGrossSale, inputs.assets.indianEquity.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-indian-equity',
    strategyName: 'Sell Indian Listed Equity',
    impact: equityFutureValue,
    rank: 0
  });

  const rsuGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.foreignRsu.embeddedGainPct, inputs.assets.foreignRsu.ltcgTaxRatePct, inputs.assets.foreignRsu.exemptionAmount);
  const rsuFutureValue = calculateFutureValue(rsuGrossSale, effectiveRsuInrCagr, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-rsus',
    strategyName: 'Sell Foreign RSUs',
    impact: rsuFutureValue,
    rank: 0
  });

  const zincRate = deriveZincLoanRate(inputs.selectedHomeLoanRatePct);
  const zincInterest = fundingGap * zincRate * analysisHorizonYears;
  const zincPaymentsFV = calculateFutureValue(zincInterest, inputs.zincPaymentReinvestmentCagrPct, analysisHorizonYears / 2);
  const retainedRsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuInrCagr, analysisHorizonYears);
  const zincBurden = zincPaymentsFV + fundingGap;
  const zincImpact = zincBurden - retainedRsuFV;

  strategies.push({
    strategyId: 'zinc-loan',
    strategyName: 'Take Zinc Loan Against RSUs',
    impact: zincImpact,
    rank: 0
  });

  strategies.sort((a, b) => a.impact - b.impact);
  strategies.forEach((s, i) => s.rank = i + 1);

  return {
    fundingGap,
    homeLoanAmount,
    monthlyEmi,
    interestPaidByTenYears,
    preEmiInterest,
    strategies,
    propertyPrice,
    transactionDuty,
    gst,
    interiors,
    downPayment
  };
}

function formatCurrency(amount) {
  const absAmount = Math.abs(amount);
  if (absAmount >= 10000000) {
    return '₹' + (amount / 10000000).toFixed(2) + ' Cr';
  } else if (absAmount >= 100000) {
    return '₹' + (amount / 100000).toFixed(2) + ' Lacs';
  } else {
    return '₹' + amount.toLocaleString('en-IN');
  }
}

function formatCr(amount) {
  const cr = amount / 10000000;
  if (cr >= 1) {
    return cr.toFixed(2) + ' Cr';
  }
  return (amount / 100000).toFixed(0) + ' Lacs';
}

function formatCrSigned(amount) {
  const cr = Math.abs(amount) / 10000000;
  const sign = amount >= 0 ? '+' : '-';
  if (cr >= 1) {
    return sign + cr.toFixed(1) + ' Cr';
  }
  const lacs = Math.abs(amount) / 100000;
  return sign + lacs.toFixed(0) + ' L';
}

function formatLacs(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) {
    return (lacs / 100).toFixed(1) + ' Cr';
  }
  return Math.round(lacs) + ' L';
}

function updateUI() {
  const results = calculateModel(modelInputs);

  // Update hero section
  document.getElementById('hero-amount').textContent = formatCr(results.fundingGap);

  // Update breakdown pills
  document.getElementById('breakdown-downpayment').textContent = formatLacs(results.downPayment);
  document.getElementById('breakdown-interior').textContent = formatLacs(results.interiors);
  document.getElementById('breakdown-stamp').textContent = formatLacs(results.transactionDuty);

  // Get strategies
  const zincStrategy = results.strategies.find(s => s.strategyId === 'zinc-loan');
  const cashStrategy = results.strategies.find(s => s.strategyId === 'use-cash');
  const landStrategy = results.strategies.find(s => s.strategyId === 'sell-land');
  const equityStrategy = results.strategies.find(s => s.strategyId === 'sell-indian-equity');
  const rsuStrategy = results.strategies.find(s => s.strategyId === 'sell-rsus');

  // Calculate relative impacts (Zinc is best)
  const zincImpact = zincStrategy.impact;
  const zincBenefit = cashStrategy.impact - zincImpact;
  const cashCost = cashStrategy.impact - zincImpact;
  const landCost = landStrategy.impact - zincImpact;
  const equityCost = equityStrategy.impact - zincImpact;
  const rsuCost = rsuStrategy.impact - zincImpact;

  // Update amounts
  document.getElementById('zinc-amount').textContent = formatCrSigned(zincBenefit);
  document.getElementById('cash-amount').textContent = formatCrSigned(-cashCost);
  document.getElementById('land-amount').textContent = formatCrSigned(-landCost);
  document.getElementById('equity-amount').textContent = formatCrSigned(-equityCost);
  document.getElementById('rsu-amount').textContent = formatCrSigned(-rsuCost);

  // Calculate bar heights (max 150px)
  const maxBarHeight = 150;
  const allCosts = [zincBenefit, cashCost, landCost, equityCost, rsuCost];
  const maxCost = Math.max(...allCosts.map(Math.abs));

  const zincBarHeight = Math.max((zincBenefit / maxCost) * maxBarHeight, 30);
  const cashBarHeight = Math.max((cashCost / maxCost) * maxBarHeight, 30);
  const landBarHeight = Math.max((landCost / maxCost) * maxBarHeight, 30);
  const equityBarHeight = Math.max((equityCost / maxCost) * maxBarHeight, 30);
  const rsuBarHeight = Math.max((rsuCost / maxCost) * maxBarHeight, 30);

  document.getElementById('zinc-bar').style.height = zincBarHeight + 'px';
  document.getElementById('cash-bar').style.height = cashBarHeight + 'px';
  document.getElementById('land-bar').style.height = landBarHeight + 'px';
  document.getElementById('equity-bar').style.height = equityBarHeight + 'px';
  document.getElementById('rsu-bar').style.height = rsuBarHeight + 'px';
}

// Show option details modal
function showOptionDetails(strategyId) {
  const results = calculateModel(modelInputs);
  const strategy = results.strategies.find(s => s.strategyId === strategyId);
  if (!strategy) return;

  const years = modelInputs.zincLoanTenureYears;
  const fundingGap = results.fundingGap;
  const zincStrategy = results.strategies.find(s => s.strategyId === 'zinc-loan');
  const opportunityCostVsZinc = strategy.impact - zincStrategy.impact;

  let title = '';
  let description = '';
  let valueToday = 0;
  let valueFuture = 0;
  let growth = 0;
  let growthRate = 0;
  let problemTitle = '';
  let problemText = '';
  let isPositive = false;

  if (strategyId === 'zinc-loan') {
    title = "What if you use Zinc HomeGap loan?";
    description = "Zinc's HomeGap Loan lets you access funding against your vested RSUs without selling them upfront. You keep your assets invested while paying only interest.";
    const rsuGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
    const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    valueToday = rsuGrossSale;
    valueFuture = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
    growth = valueFuture - valueToday;
    growthRate = (effectiveRsuCagr * 100).toFixed(0);
    problemTitle = "The benefit of using Zinc";
    problemText = `By taking a Zinc loan, you keep your RSUs worth <span class="highlight">${formatCurrency(valueToday)}</span> invested. They can grow to <span class="highlight-green">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong> while you pay only interest on the loan.`;
    isPositive = true;
  } else if (strategyId === 'use-cash') {
    title = "What if you use cash to cover the funding gap?";
    description = "Using your savings means no debt, but you lose out on potential investment returns if that money was invested instead.";
    valueToday = fundingGap;
    valueFuture = calculateFutureValue(fundingGap, modelInputs.assets.cash.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.cash.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with using cash";
    problemText = `By using cash worth <span class="highlight">${formatCurrency(valueToday)}</span>, you will effectively lose the opportunity to make <span class="highlight-red">${formatCurrency(valueFuture)}</span> in future, if you were to invest that cash in a safe fund.<br><br>This means you'll be <span class="highlight-red">${formatCurrency(opportunityCostVsZinc)}</span> poorer than taking a Zinc HomeGap loan.`;
  } else if (strategyId === 'sell-land') {
    title = "What if you sell land to cover the funding gap?";
    description = "Selling land involves capital gains tax on your profits, plus you miss out on future appreciation.";
    valueToday = calculateGrossSaleRequired(fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
    valueFuture = calculateFutureValue(valueToday, modelInputs.assets.land.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.land.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with selling land";
    problemText = `By selling land worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay 12.5% LTCG tax and lose the opportunity to see it grow to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.<br><br>This means you'll be <span class="highlight-red">${formatCurrency(opportunityCostVsZinc)}</span> poorer than taking a Zinc HomeGap loan.`;
  } else if (strategyId === 'sell-indian-equity') {
    title = "What if you sell equities to cover the funding gap?";
    description = "Selling stocks means paying capital gains tax and missing future growth. There's a ₹1.25 lakh exemption on LTCG.";
    valueToday = calculateGrossSaleRequired(fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
    valueFuture = calculateFutureValue(valueToday, modelInputs.assets.indianEquity.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.indianEquity.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with selling equities";
    problemText = `By selling equities worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay LTCG tax and miss potential growth to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.<br><br>This means you'll be <span class="highlight-red">${formatCurrency(opportunityCostVsZinc)}</span> poorer than taking a Zinc HomeGap loan.`;
  } else if (strategyId === 'sell-rsus') {
    title = "What if you sell RSUs to cover the funding gap?";
    description = "Selling foreign RSUs triggers capital gains tax with no exemption, plus you miss stock growth and rupee depreciation benefits.";
    valueToday = calculateGrossSaleRequired(fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
    const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    valueFuture = calculateFutureValue(valueToday, effectiveRsuCagr, years);
    growth = valueFuture - valueToday;
    growthRate = ((modelInputs.assets.foreignRsu.usdCagrPct + modelInputs.assets.foreignRsu.inrDepreciationPct) * 100).toFixed(0);
    problemTitle = "The problem with selling RSUs";
    problemText = `By selling RSUs worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay 12.5% LTCG with no exemption and miss potential growth to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.<br><br>This means you'll be <span class="highlight-red">${formatCurrency(opportunityCostVsZinc)}</span> poorer than taking a Zinc HomeGap loan.`;
  }

  const content = `
    <div class="detail-modal-container">
      <div class="detail-header">
        <h2 class="detail-modal-title">${title}</h2>
        <p class="detail-description">${description}</p>
      </div>

      <div class="modal-chart-section">
        <div class="modal-value-comparison">
          <div class="modal-value-box">
            <span class="modal-value-amount">${formatCurrency(valueToday)}</span>
            <span class="modal-value-label">Value today</span>
          </div>
          <div class="modal-growth-badge">
            <span class="modal-growth-amount">+${formatCurrency(growth)}</span>
            <span class="modal-growth-label">growth opportunity</span>
          </div>
          <div class="modal-value-box modal-value-right">
            <span class="modal-value-amount ${isPositive ? 'text-green' : 'text-gradient'}">${formatCurrency(valueFuture)}</span>
            <span class="modal-value-label">Value after ${years} years</span>
          </div>
        </div>
        <div class="modal-growth-chart">
          <canvas id="modal-chart-canvas"></canvas>
          <div class="modal-chart-labels">
            <span>Today</span>
            <span>After ${years} years</span>
          </div>
        </div>
      </div>

      <div class="modal-problem-box ${isPositive ? 'positive' : 'negative'}">
        <span class="modal-problem-tag ${isPositive ? 'positive' : 'negative'}">${problemTitle}</span>
        <p class="modal-problem-text">${problemText}</p>
      </div>

      <div class="detail-sections">
        <div class="detail-group">
          <h3 class="group-heading">How we calculated this</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Cash needed today</span>
              <span class="detail-value">${formatCurrency(valueToday)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">If invested at ${growthRate}% for ${years} years</span>
              <span class="detail-value ${isPositive ? 'detail-value-green' : 'detail-value-red'}">${formatCurrency(valueFuture)}</span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Your home loan</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Loan amount</span>
              <span class="detail-value">${formatCurrency(results.homeLoanAmount)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Monthly EMI</span>
              <span class="detail-value">${formatCurrency(results.monthlyEmi)}</span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Cash you need upfront</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Down payment (20%)</span>
              <span class="detail-value">${formatCurrency(results.downPayment)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stamp duty & registration</span>
              <span class="detail-value">${formatCurrency(results.transactionDuty)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Interior budget</span>
              <span class="detail-value">${formatCurrency(results.interiors)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Total</strong></span>
              <span class="detail-value"><strong>${formatCurrency(fundingGap)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('detail-modal-content').innerHTML = content;
  document.getElementById('detail-modal').classList.add('visible');

  // Draw chart in modal after a small delay
  setTimeout(() => {
    drawModalGrowthCurve('modal-chart-canvas');
  }, 100);
}

const loanModal = document.getElementById('loan-modal');
const constructionModal = document.getElementById('construction-modal');
const detailModal = document.getElementById('detail-modal');

document.getElementById('loan-settings-btn').addEventListener('click', () => {
  document.getElementById('modal-loan-rate').value = modelInputs.selectedHomeLoanRatePct;
  document.getElementById('modal-loan-tenure').value = modelInputs.homeLoanTenureYears;
  document.getElementById('modal-loan-ltv').value = modelInputs.homeLoanLtvPct;
  loanModal.classList.add('visible');
});

document.getElementById('loan-modal-cancel').addEventListener('click', () => {
  loanModal.classList.remove('visible');
});

document.getElementById('loan-modal-save').addEventListener('click', () => {
  modelInputs.selectedHomeLoanRatePct = parseFloat(document.getElementById('modal-loan-rate').value);
  modelInputs.homeLoanTenureYears = parseInt(document.getElementById('modal-loan-tenure').value);
  modelInputs.homeLoanLtvPct = parseFloat(document.getElementById('modal-loan-ltv').value);
  trackValueSubmit('loan_settings_submit', JSON.stringify({
    rate: modelInputs.selectedHomeLoanRatePct,
    tenure_years: modelInputs.homeLoanTenureYears,
    ltv_pct: modelInputs.homeLoanLtvPct,
  }));
  loanModal.classList.remove('visible');
  updateUI();
});

const constructionExtraFields = document.getElementById('construction-extra-fields');
const constructionSelect = document.getElementById('modal-construction');

constructionSelect.addEventListener('change', () => {
  if (constructionSelect.value === 'Under Construction') {
    constructionExtraFields.classList.add('visible');
  } else {
    constructionExtraFields.classList.remove('visible');
  }

  // Draw gradient fill under curve
  ctx.beginPath();
  ctx.moveTo(points[0].x, height - paddingBottom);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
  ctx.closePath();

  const fillGradient = ctx.createLinearGradient(0, height, 0, 0);
  fillGradient.addColorStop(0, 'rgba(100, 140, 80, 0.0)');
  fillGradient.addColorStop(0.5, 'rgba(100, 140, 80, 0.1)');
  fillGradient.addColorStop(1, 'rgba(150, 180, 100, 0.2)');
  ctx.fillStyle = fillGradient;
  ctx.fill();

  // Draw curve line
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach(p => ctx.lineTo(p.x, p.y));

  const lineGradient = ctx.createLinearGradient(0, height, width, 0);
  lineGradient.addColorStop(0, '#6a8a50');
  lineGradient.addColorStop(0.5, '#9ab060');
  lineGradient.addColorStop(1, '#c4c870');
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw end dot
  const endPoint = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#b4c864';
  ctx.fill();
}

// Event listeners for columns
document.querySelectorAll('.chart-column').forEach(col => {
  col.addEventListener('click', () => {
    const optionId = col.dataset.option;
    showOptionDetails(optionId);
  });
  col.style.cursor = 'pointer';
});

document.getElementById('detail-modal-close').addEventListener('click', () => {
  document.getElementById('detail-modal').classList.remove('visible');
});

document.getElementById('detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'detail-modal') {
    document.getElementById('detail-modal').classList.remove('visible');
  }

  trackValueSubmit('construction_settings_submit', JSON.stringify({
    property_status: modelInputs.propertyStatus,
    construction_duration_years: modelInputs.constructionDurationYears,
  }));
  constructionModal.classList.remove('visible');
  updateUI();
});

// Learn more buttons
document.querySelectorAll('.learn-more-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const optionId = btn.dataset.option;
    showOptionDetails(optionId);
  });
});

document.getElementById('back-btn').addEventListener('click', () => {
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'location.html', 400);
});

// Assumptions modal
const assumptionsModal = document.getElementById('assumptions-modal');

document.getElementById('modify-assumptions-btn').addEventListener('click', () => {
  // Populate current values
  document.getElementById('assumption-zinc-tenure').value = modelInputs.zincLoanTenureYears;
  document.getElementById('assumption-zinc-reinvestment').value = modelInputs.zincPaymentReinvestmentCagrPct;
  document.getElementById('assumption-interiors').value = modelInputs.interiorsPct;
  document.getElementById('assumption-cash-cagr').value = modelInputs.assets.cash.cagrPct;
  document.getElementById('assumption-land-gain').value = modelInputs.assets.land.embeddedGainPct;
  document.getElementById('assumption-land-tax').value = modelInputs.assets.land.ltcgTaxRatePct;
  document.getElementById('assumption-land-cagr').value = modelInputs.assets.land.cagrPct;
  document.getElementById('assumption-equity-gain').value = modelInputs.assets.indianEquity.embeddedGainPct;
  document.getElementById('assumption-equity-tax').value = modelInputs.assets.indianEquity.ltcgTaxRatePct;
  document.getElementById('assumption-equity-exemption').value = modelInputs.assets.indianEquity.exemptionAmount;
  document.getElementById('assumption-equity-cagr').value = modelInputs.assets.indianEquity.cagrPct;
  document.getElementById('assumption-rsu-gain').value = modelInputs.assets.foreignRsu.embeddedGainPct;
  document.getElementById('assumption-rsu-tax').value = modelInputs.assets.foreignRsu.ltcgTaxRatePct;
  document.getElementById('assumption-rsu-cagr').value = modelInputs.assets.foreignRsu.usdCagrPct;
  document.getElementById('assumption-rsu-inr-dep').value = modelInputs.assets.foreignRsu.inrDepreciationPct;

  assumptionsModal.classList.add('visible');
});

document.getElementById('assumptions-modal-cancel').addEventListener('click', () => {
  assumptionsModal.classList.remove('visible');
});

document.getElementById('assumptions-modal-save').addEventListener('click', () => {
  modelInputs.zincLoanTenureYears = parseInt(document.getElementById('assumption-zinc-tenure').value);
  modelInputs.zincPaymentReinvestmentCagrPct = parseFloat(document.getElementById('assumption-zinc-reinvestment').value);
  modelInputs.interiorsPct = parseFloat(document.getElementById('assumption-interiors').value);
  modelInputs.assets.cash.cagrPct = parseFloat(document.getElementById('assumption-cash-cagr').value);
  modelInputs.assets.land.embeddedGainPct = parseFloat(document.getElementById('assumption-land-gain').value);
  modelInputs.assets.land.ltcgTaxRatePct = parseFloat(document.getElementById('assumption-land-tax').value);
  modelInputs.assets.land.cagrPct = parseFloat(document.getElementById('assumption-land-cagr').value);
  modelInputs.assets.indianEquity.embeddedGainPct = parseFloat(document.getElementById('assumption-equity-gain').value);
  modelInputs.assets.indianEquity.ltcgTaxRatePct = parseFloat(document.getElementById('assumption-equity-tax').value);
  modelInputs.assets.indianEquity.exemptionAmount = parseFloat(document.getElementById('assumption-equity-exemption').value);
  modelInputs.assets.indianEquity.cagrPct = parseFloat(document.getElementById('assumption-equity-cagr').value);
  modelInputs.assets.foreignRsu.embeddedGainPct = parseFloat(document.getElementById('assumption-rsu-gain').value);
  modelInputs.assets.foreignRsu.ltcgTaxRatePct = parseFloat(document.getElementById('assumption-rsu-tax').value);
  modelInputs.assets.foreignRsu.usdCagrPct = parseFloat(document.getElementById('assumption-rsu-cagr').value);
  modelInputs.assets.foreignRsu.inrDepreciationPct = parseFloat(document.getElementById('assumption-rsu-inr-dep').value);

  trackValueSubmit('assumptions_submit', JSON.stringify({
    zinc_loan_tenure_years: modelInputs.zincLoanTenureYears,
    interiors_pct: modelInputs.interiorsPct,
    cash_cagr_pct: modelInputs.assets.cash.cagrPct,
  }));
  assumptionsModal.classList.remove('visible');
  updateUI();
});

assumptionsModal.addEventListener('click', (e) => {
  if (e.target === assumptionsModal) assumptionsModal.classList.remove('visible');
});

// House value edit functionality
const houseValueModal = document.getElementById('house-value-modal');
const modalHouseValue = document.getElementById('modal-house-value');

function formatIndianNumber(num) {
  const str = Math.round(num).toString();
  let result = '';
  let count = 0;
  for (let i = str.length - 1; i >= 0; i--) {
    count++;
    result = str[i] + result;
    if (count === 3 && i > 0) {
      result = ',' + result;
    } else if (count > 3 && (count - 3) % 2 === 0 && i > 0) {
      result = ',' + result;
    }
  }
  return result;
}

function parseIndianNumber(str) {
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
}

// Use Intersection Observer to trigger animation when scrolled into view
const chartSection = document.querySelector('.chart-section');
const scrollContainer = document.querySelector('.scroll-container');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      setTimeout(animateBars, 300);
      observer.unobserve(entry.target);
    }
  });
}, {
  threshold: 0.3,
  root: scrollContainer
});

observer.observe(chartSection);

document.getElementById('house-value-modal-save').addEventListener('click', () => {
  const newHouseValue = parseIndianNumber(modalHouseValue.value);
  if (newHouseValue > 0) {
    modelInputs.propertyPrice = newHouseValue;
    localStorage.setItem('houseValue', newHouseValue);
    trackValueSubmit('house_value_edit_submit', newHouseValue);
  }
}, 2000);

// Update option section values
function updateOptionSections() {
  const results = calculateModel(modelInputs);
  const years = modelInputs.zincLoanTenureYears;

  // Cash section
  const cashNeeded = results.fundingGap;
  const cashFV = calculateFutureValue(cashNeeded, modelInputs.assets.cash.cagrPct, years);
  const cashGrowth = cashFV - cashNeeded;
  document.getElementById('cash-value-today').textContent = formatCurrency(cashNeeded);
  document.getElementById('cash-value-future').textContent = formatCurrency(cashFV);
  document.getElementById('cash-growth').textContent = '+' + formatCr(cashGrowth);

  // Land section
  const landGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
  const landFV = calculateFutureValue(landGrossSale, modelInputs.assets.land.cagrPct, years);
  const landGrowth = landFV - landGrossSale;
  document.getElementById('land-value-today').textContent = formatCurrency(landGrossSale);
  document.getElementById('land-value-future').textContent = formatCurrency(landFV);
  document.getElementById('land-growth').textContent = '+' + formatCr(landGrowth);

  // Equity section
  const equityGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
  const equityFV = calculateFutureValue(equityGrossSale, modelInputs.assets.indianEquity.cagrPct, years);
  const equityGrowth = equityFV - equityGrossSale;
  document.getElementById('equity-value-today').textContent = formatCurrency(equityGrossSale);
  document.getElementById('equity-value-future').textContent = formatCurrency(equityFV);
  document.getElementById('equity-growth').textContent = '+' + formatCr(equityGrowth);

  // RSU section
  const rsuGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
  const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
  const rsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  const rsuGrowth = rsuFV - rsuGrossSale;
  document.getElementById('rsu-value-today').textContent = formatCurrency(rsuGrossSale);
  document.getElementById('rsu-value-future').textContent = formatCurrency(rsuFV);
  document.getElementById('rsu-growth').textContent = '+' + formatCr(rsuGrowth);

  // Zinc section (same as RSU values but kept)
  document.getElementById('zinc-value-today').textContent = formatCurrency(rsuGrossSale);
  document.getElementById('zinc-value-future').textContent = formatCurrency(rsuFV);
  document.getElementById('zinc-growth').textContent = '+' + formatCr(rsuGrowth);
}

// Draw growth curve on canvas
function drawGrowthCurve(canvasId, startValue, endValue, color = '#c4a35a') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const paddingLeft = 0;
  const paddingRight = 40;
  const paddingBottom = 10;
  const paddingTop = 30;

  ctx.clearRect(0, 0, width, height);

  // Generate curve points
  const points = [];
  const numPoints = 100;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = paddingLeft + t * (width - paddingLeft - paddingRight);
    const y = height - paddingBottom - (Math.pow(t, 2) * (height - paddingBottom - paddingTop));
    points.push({ x, y });
  }

  // Draw gradient fill under curve
  ctx.beginPath();
  ctx.moveTo(points[0].x, height - paddingBottom);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - paddingBottom);
  ctx.closePath();

  const fillGradient = ctx.createLinearGradient(0, height, 0, 0);
  fillGradient.addColorStop(0, 'rgba(100, 140, 80, 0.0)');
  fillGradient.addColorStop(0.5, 'rgba(100, 140, 80, 0.15)');
  fillGradient.addColorStop(1, 'rgba(150, 180, 100, 0.3)');
  ctx.fillStyle = fillGradient;
  ctx.fill();

  // Draw curve line with gradient
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  points.forEach(p => ctx.lineTo(p.x, p.y));

  const lineGradient = ctx.createLinearGradient(0, height, width, 0);
  lineGradient.addColorStop(0, '#6a8a50');
  lineGradient.addColorStop(0.5, '#9ab060');
  lineGradient.addColorStop(1, '#c4c870');
  ctx.strokeStyle = lineGradient;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Draw glowing end dot
  const endPoint = points[points.length - 1];

  // Glow effect
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 16, 0, Math.PI * 2);
  const glowGradient = ctx.createRadialGradient(endPoint.x, endPoint.y, 0, endPoint.x, endPoint.y, 16);
  glowGradient.addColorStop(0, 'rgba(180, 200, 100, 0.6)');
  glowGradient.addColorStop(1, 'rgba(180, 200, 100, 0)');
  ctx.fillStyle = glowGradient;
  ctx.fill();

  // Solid dot
  ctx.beginPath();
  ctx.arc(endPoint.x, endPoint.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#b4c864';
  ctx.fill();
}

// Sticky nav scroll handling
const stickyNav = document.getElementById('sticky-nav');
const optionSections = document.querySelectorAll('.option-section');
const navPills = document.querySelectorAll('.nav-pill');

// Animate nav pills when first option section comes into view
let navPillsAnimated = false;
function animateNavPills() {
  if (navPillsAnimated) return;
  navPillsAnimated = true;
  navPills.forEach(pill => {
    pill.classList.add('animate-in');
  });
}

const navObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateNavPills();
    }
  });
}, {
  threshold: 0.1,
  root: scrollContainer
});

const firstOptionSection = document.getElementById('section-zinc-loan');
if (firstOptionSection) {
  navObserver.observe(firstOptionSection);
}

// Update active pill based on scroll position
function updateActivePill() {
  let currentSection = null;

  optionSections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top <= 150 && rect.bottom > 150) {
      currentSection = section.dataset.option;
    }
  });

  if (currentSection) {
    navPills.forEach(pill => {
      pill.classList.toggle('active', pill.dataset.option === currentSection);
    });
  }
}

updateUI();

// Page load animation - left column starts full width, then shrinks
const leftColumn = document.querySelector('.left-column');
const rightColumn = document.querySelector('.right-column');
const settingsSection = document.querySelector('.settings-section');
const fundingLabel = document.querySelector('.funding-label');
const fundingAmountRow = document.querySelector('.funding-amount-row');
const fundingSubtitle = document.querySelector('.funding-subtitle');
const houseInfo = document.querySelector('.house-info');

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const buttonName = button.id || button.textContent?.trim() || 'unknown_button';
  trackButtonClick(buttonName);
});

// Start with left column full width
leftColumn.classList.add('fullwidth');

// Staggered animation for left column content on page load
setTimeout(() => {
  fundingLabel.classList.add('visible');
}, 300);

setTimeout(() => {
  fundingAmountRow.classList.add('visible');
}, 600);

setTimeout(() => {
  fundingSubtitle.classList.add('visible');
}, 900);

setTimeout(() => {
  houseInfo.classList.add('visible');
}, 1200);

// Scroll listener
scrollContainer.addEventListener('scroll', () => {
  updateActivePill();

  // Draw charts when sections come into view
  optionSections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      const canvasId = 'chart-' + section.dataset.option;
      const canvas = document.getElementById(canvasId);
      if (canvas && !canvas.dataset.drawn) {
        drawGrowthCurve(canvasId, 0, 100);
        canvas.dataset.drawn = 'true';
      }
    }
  });
});

// Initialize
updateUI();
updateOptionSections();
