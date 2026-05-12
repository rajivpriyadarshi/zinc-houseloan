import { getTransactionDutyRate } from './lib/stateDuty.js';

// Get stored values
const propertyPrice = parseInt(localStorage.getItem('houseValue')) || 10000000;
const selectedCity = localStorage.getItem('selectedCity') || 'Bangalore';
const transactionDutyPct = getTransactionDutyRate(selectedCity);

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

function formatLacs(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) {
    return (lacs / 100).toFixed(2) + ' Cr';
  }
  return lacs.toFixed(2) + ' lacs';
}

function formatCr(amount) {
  const cr = amount / 10000000;
  if (cr >= 1) {
    return cr.toFixed(2) + ' Cr';
  }
  return (amount / 100000).toFixed(0) + ' Lacs';
}

function getHouseLevel(value) {
  const MIN_VALUE = 100000;
  const MAX_VALUE = 100000000;
  const range = MAX_VALUE - MIN_VALUE;
  const step = range / 6;

  if (value < MIN_VALUE + step) return 1;
  if (value < MIN_VALUE + step * 2) return 2;
  if (value < MIN_VALUE + step * 3) return 3;
  if (value < MIN_VALUE + step * 4) return 4;
  if (value < MIN_VALUE + step * 5) return 5;
  return 6;
}

function updateUI() {
  const results = calculateModel(modelInputs);

  document.getElementById('funding-amount').textContent = formatLacs(results.fundingGap);
  document.getElementById('city-name').textContent = selectedCity;
  document.getElementById('house-value').textContent = formatCr(modelInputs.propertyPrice);
  document.getElementById('options-title').textContent = `Options to fund ${formatCurrency(results.fundingGap)}`;

  const houseLevel = getHouseLevel(modelInputs.propertyPrice);
  document.getElementById('house-image').src = `/houses/level${houseLevel}.png`;

  const ratePercent = (modelInputs.selectedHomeLoanRatePct * 100).toFixed(1);
  const ltvPercent = (modelInputs.homeLoanLtvPct * 100).toFixed(0);
  document.getElementById('loan-settings-value').textContent = `${ratePercent}%, ${modelInputs.homeLoanTenureYears} year, ${ltvPercent}%`;
  document.getElementById('construction-value').textContent = modelInputs.propertyStatus === 'Ready' ? 'No' : 'Yes';

  const bestOption = results.strategies.find(s => s.rank === 1);
  const otherOptions = results.strategies.filter(s => s.rank !== 1);

  const analysisYears = modelInputs.zincLoanTenureYears;

  function getImpactLabel(strategyId, impact) {
    if (strategyId === 'zinc-loan') {
      return impact < 0 ? `You'll be richer after ${analysisYears} years` : `Net cost after ${analysisYears} years`;
    }
    return `Opportunity cost over ${analysisYears} years`;
  }

  function getStrategyDisplayName(strategyId) {
    if (strategyId === 'use-cash') return 'Use cash';
    if (strategyId === 'sell-land') return 'Sell land';
    if (strategyId === 'sell-indian-equity') return 'Sell Indian equity';
    if (strategyId === 'sell-rsus') return 'Sell foreign RSUs';
    if (strategyId === 'zinc-loan') return 'Take Zinc loan against RSUs';
    return strategyId;
  }

  function getComparisonPhrase(strategyId) {
    if (strategyId === 'use-cash') return 'Use cash';
    if (strategyId === 'sell-land') return 'Sell land';
    if (strategyId === 'sell-indian-equity') return 'Sell Indian equity';
    if (strategyId === 'sell-rsus') return 'Sell foreign RSUs';
    if (strategyId === 'zinc-loan') return 'Take Zinc loan against RSUs';
    return 'this option';
  }

  function getStrategyIcon(strategyId) {
    const icons = {
      'zinc-loan': '/icons/zinc-loan.jpg',
      'use-cash': '/icons/cash.jpg',
      'sell-land': '/icons/land.jpg',
      'sell-indian-equity': '/icons/loan.jpg',
      'sell-rsus': '/icons/RSU.jpg'
    };
    return icons[strategyId] || '/icons/cash.jpg';
  }

  const comparisonCards = otherOptions.map(opt => {
    const savings = opt.impact - bestOption.impact;
    return `<div class="carousel-card">You'll be <strong>${formatCurrency(savings)}</strong> richer than if you were to ${getComparisonPhrase(opt.strategyId)}</div>`;
  }).join('');

  document.getElementById('best-option').innerHTML = `
    <div class="best-option-header">
      <div class="option-left">
        <img class="option-icon" src="${getStrategyIcon(bestOption.strategyId)}" alt="">
        <div class="option-name">${getStrategyDisplayName(bestOption.strategyId)}</div>
      </div>
      <svg class="option-expand" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
    </div>
    <div class="carousel-container">
      <div class="carousel-track" id="carousel-track">
        ${comparisonCards}
      </div>
    </div>
  `;
  document.getElementById('best-option').dataset.strategyId = bestOption.strategyId;

  initCarousel();

  const otherOptionsHtml = otherOptions.map(opt => `
    <div class="option-card" data-strategy-id="${opt.strategyId}">
      <div class="option-left">
        <img class="option-icon" src="${getStrategyIcon(opt.strategyId)}" alt="">
        <div class="option-name">${getStrategyDisplayName(opt.strategyId)}</div>
      </div>
      <div class="option-right">
        <div class="option-impact">
          <div class="option-amount">${formatCurrency(opt.impact)}</div>
          <div class="option-label">${getImpactLabel(opt.strategyId, opt.impact)}</div>
        </div>
        <svg class="option-expand" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  `).join('');
  document.getElementById('other-options').innerHTML = otherOptionsHtml;

  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => showOptionDetails(card.dataset.strategyId, results));
  });
}

function getStrategyDescription(strategyId, results) {
  const descriptions = {
    'zinc-loan': `Instead of selling your investments, you can take a loan against your RSUs from Zinc. This lets you keep your stocks growing while using them as collateral.`,
    'use-cash': `Using your savings means no debt, but you lose out on potential investment returns if that money was invested instead.`,
    'sell-land': `Selling land involves capital gains tax on your profits, plus you miss out on future appreciation.`,
    'sell-indian-equity': `Selling stocks means paying capital gains tax and missing future growth. There's a ₹1.25 lakh exemption on LTCG.`,
    'sell-rsus': `Selling foreign RSUs triggers capital gains tax with no exemption, plus you miss stock growth and rupee depreciation benefits.`
  };
  return descriptions[strategyId] || 'Here\'s a breakdown of this funding option.';
}

function getStrategyCalculation(strategyId, results, inputs) {
  const fundingGap = results.fundingGap;

  if (strategyId === 'use-cash') {
    const rate = (inputs.assets.cash.cagrPct * 100).toFixed(0);
    const years = inputs.zincLoanTenureYears;
    return `
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">Cash needed today</span>
          <span class="detail-value">${formatCurrency(fundingGap)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">If invested at ${rate}% for ${years} years
            <span class="info-icon-wrapper">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span class="info-tooltip">This is the opportunity cost - what your money could have grown to.</span>
            </span>
          </span>
          <span class="detail-value detail-value-red">${formatCurrency(results.strategies.find(s => s.strategyId === 'use-cash').impact)}</span>
        </div>
      </div>
    `;
  }

  if (strategyId === 'sell-land') {
    const taxRate = (inputs.assets.land.ltcgTaxRatePct * 100).toFixed(1);
    const growthRate = (inputs.assets.land.cagrPct * 100).toFixed(0);
    const years = inputs.zincLoanTenureYears;
    const grossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.land.embeddedGainPct, inputs.assets.land.ltcgTaxRatePct, inputs.assets.land.exemptionAmount);
    const taxPaid = grossSale - fundingGap;
    return `
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">Land you need to sell</span>
          <span class="detail-value">${formatCurrency(grossSale)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">If land grew at ${growthRate}% for ${years} years
            <span class="info-icon-wrapper">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span class="info-tooltip">This is the opportunity cost - what your land could have been worth.</span>
            </span>
          </span>
          <span class="detail-value detail-value-red">${formatCurrency(results.strategies.find(s => s.strategyId === 'sell-land').impact)}</span>
        </div>
      </div>
    `;
  }

  if (strategyId === 'sell-indian-equity') {
    const taxRate = (inputs.assets.indianEquity.ltcgTaxRatePct * 100).toFixed(1);
    const growthRate = (inputs.assets.indianEquity.cagrPct * 100).toFixed(0);
    const years = inputs.zincLoanTenureYears;
    const grossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.indianEquity.embeddedGainPct, inputs.assets.indianEquity.ltcgTaxRatePct, inputs.assets.indianEquity.exemptionAmount);
    const taxPaid = grossSale - fundingGap;
    return `
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">Stocks you need to sell</span>
          <span class="detail-value">${formatCurrency(grossSale)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">If stocks grew at ${growthRate}% for ${years} years
            <span class="info-icon-wrapper">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span class="info-tooltip">This is the opportunity cost - what your stocks could have been worth.</span>
            </span>
          </span>
          <span class="detail-value detail-value-red">${formatCurrency(results.strategies.find(s => s.strategyId === 'sell-indian-equity').impact)}</span>
        </div>
      </div>
    `;
  }

  if (strategyId === 'sell-rsus') {
    const taxRate = (inputs.assets.foreignRsu.ltcgTaxRatePct * 100).toFixed(1);
    const growthRate = (inputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0);
    const years = inputs.zincLoanTenureYears;
    const grossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.foreignRsu.embeddedGainPct, inputs.assets.foreignRsu.ltcgTaxRatePct, inputs.assets.foreignRsu.exemptionAmount);
    const taxPaid = grossSale - fundingGap;
    return `
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">RSUs you need to sell</span>
          <span class="detail-value">${formatCurrency(grossSale)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">If RSUs grew at ${growthRate}% for ${years} years
            <span class="info-icon-wrapper">
              <svg class="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 16v-4"/>
                <path d="M12 8h.01"/>
              </svg>
              <span class="info-tooltip">This is the opportunity cost - what your RSUs could have been worth.</span>
            </span>
          </span>
          <span class="detail-value detail-value-red">${formatCurrency(results.strategies.find(s => s.strategyId === 'sell-rsus').impact)}</span>
        </div>
      </div>
    `;
  }

  if (strategyId === 'zinc-loan') {
    const zincRate = Math.min(inputs.selectedHomeLoanRatePct + 0.02, 0.125);
    const zincRatePct = (zincRate * 100).toFixed(1);
    const years = inputs.zincLoanTenureYears;
    const strategy = results.strategies.find(s => s.strategyId === 'zinc-loan');
    return `
      <div class="detail-rows">
        <div class="detail-row">
          <span class="detail-label">Loan against RSUs</span>
          <span class="detail-value">${formatCurrency(fundingGap)}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Zinc interest rate</span>
          <span class="detail-value">${zincRatePct}%</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Your RSUs keep growing</span>
          <span class="detail-value">Yes</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Net benefit after ${years} years</span>
          <span class="detail-value">${formatCurrency(Math.abs(strategy.impact))}</span>
        </div>
      </div>
    `;
  }

  return '';
}

function showOptionDetails(strategyId, results) {
  const strategy = results.strategies.find(s => s.strategyId === strategyId);
  if (!strategy) return;

  const description = getStrategyDescription(strategyId, results);

  const years = modelInputs.zincLoanTenureYears;

  // Build comparison section
  function getModalComparisonPhrase(strategyId) {
    if (strategyId === 'use-cash') return 'Use cash';
    if (strategyId === 'sell-land') return 'Sell land';
    if (strategyId === 'sell-indian-equity') return 'Sell Indian equity';
    if (strategyId === 'sell-rsus') return 'Sell foreign RSUs';
    if (strategyId === 'zinc-loan') return 'Take Zinc loan against RSUs';
    return 'this option';
  }

  const strategyExplanation = getStrategyCalculation(strategyId, results, modelInputs);

  let comparisonHtml;
  if (strategyId === 'zinc-loan') {
    const otherStrategies = results.strategies.filter(s => s.strategyId !== strategyId);
    const comparisonCardsHtml = otherStrategies.map(opt => {
      const diff = opt.impact - strategy.impact;
      if (diff > 0) {
        return `<div class="modal-carousel-card">You'll be <strong>${formatCurrency(diff)}</strong> richer than if you were to ${getModalComparisonPhrase(opt.strategyId)}</div>`;
      } else {
        return `<div class="modal-carousel-card">You'll be <strong>${formatCurrency(Math.abs(diff))}</strong> poorer than if you were to ${getModalComparisonPhrase(opt.strategyId)}</div>`;
      }
    }).join('');
    comparisonHtml = `
      <div class="modal-carousel-container">
        <div class="modal-carousel-track">${comparisonCardsHtml}</div>
      </div>
    `;
  } else {
    const sortedStrategies = [...results.strategies].sort((a, b) => a.impact - b.impact);
    const bestStrategy = sortedStrategies[0];
    const comparisonDiff = Math.abs(strategy.impact - bestStrategy.impact);
    const bestName = bestStrategy.strategyId === 'zinc-loan' ? 'taking a Zinc loan against RSUs' : bestStrategy.strategyName;
    const opportunityCost = strategy.impact;
    const impactText = `The opportunity cost for using this method is about <strong>${formatCurrency(opportunityCost)}</strong>. This effectively means you'll be <strong>${formatCurrency(comparisonDiff)}</strong> poorer than ${bestName}`;
    comparisonHtml = `<span class="highlight-value">${impactText}</span>`;
  }

  const highlightClass = strategyId === 'zinc-loan' ? 'detail-highlight' : 'detail-highlight negative';
  let content = `
    <div class="detail-modal-container">
      <div class="detail-header">
        <div class="detail-title-section">
          <h2 class="detail-modal-title">${strategy.strategyName}</h2>
          <p class="detail-description">${description}</p>
        </div>
        <div class="${highlightClass}">
          <span class="highlight-label">After ${years} years</span>
          ${comparisonHtml}
        </div>
      </div>
      <div class="detail-sections">
        <div class="detail-group">
          <h3 class="group-heading">How we calculated this</h3>
          ${strategyExplanation}
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
            <div class="detail-row total-row">
              <span class="detail-label">Total</span>
              <span class="detail-value">${formatCurrency(results.fundingGap)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('detail-modal-content').innerHTML = content;
  document.getElementById('detail-modal').classList.add('visible');

  if (strategyId === 'zinc-loan') {
    setTimeout(() => initModalCarousel(), 100);
  }
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
});

document.getElementById('construction-btn').addEventListener('click', () => {
  document.getElementById('modal-construction').value = modelInputs.propertyStatus;
  document.getElementById('modal-construction-duration').value = modelInputs.constructionDurationYears;

  document.getElementById('drawdown-0').value = modelInputs.drawdownSchedule[0].percentage;
  document.getElementById('drawdown-1').value = modelInputs.drawdownSchedule[1].percentage;
  document.getElementById('drawdown-2').value = modelInputs.drawdownSchedule[2].percentage;
  document.getElementById('drawdown-3').value = modelInputs.drawdownSchedule[3].percentage;

  if (modelInputs.propertyStatus === 'Under Construction') {
    constructionExtraFields.classList.add('visible');
  } else {
    constructionExtraFields.classList.remove('visible');
  }

  constructionModal.classList.add('visible');
});

document.getElementById('construction-modal-cancel').addEventListener('click', () => {
  constructionModal.classList.remove('visible');
});

document.getElementById('construction-modal-save').addEventListener('click', () => {
  modelInputs.propertyStatus = document.getElementById('modal-construction').value;

  if (modelInputs.propertyStatus === 'Under Construction') {
    modelInputs.constructionDurationYears = parseInt(document.getElementById('modal-construction-duration').value);
    modelInputs.drawdownSchedule = [
      { id: 'drawdown-1', year: 0, percentage: parseFloat(document.getElementById('drawdown-0').value) },
      { id: 'drawdown-2', year: 1, percentage: parseFloat(document.getElementById('drawdown-1').value) },
      { id: 'drawdown-3', year: 2, percentage: parseFloat(document.getElementById('drawdown-2').value) },
      { id: 'drawdown-4', year: 3, percentage: parseFloat(document.getElementById('drawdown-3').value) },
    ];
  }

  constructionModal.classList.remove('visible');
  updateUI();
});

document.getElementById('detail-modal-close').addEventListener('click', () => {
  stopModalCarousel();
  detailModal.classList.remove('visible');
});

[loanModal, constructionModal, detailModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      if (modal === detailModal) stopModalCarousel();
      modal.classList.remove('visible');
    }
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

document.getElementById('house-badge-btn').addEventListener('click', () => {
  modalHouseValue.value = formatIndianNumber(modelInputs.propertyPrice);
  houseValueModal.classList.add('visible');
  modalHouseValue.focus();
  modalHouseValue.select();
});

modalHouseValue.addEventListener('input', (e) => {
  const rawValue = e.target.value.replace(/[^0-9]/g, '');
  const numValue = parseInt(rawValue, 10) || 0;
  modalHouseValue.value = formatIndianNumber(numValue);
});

document.getElementById('house-value-modal-cancel').addEventListener('click', () => {
  houseValueModal.classList.remove('visible');
});

document.getElementById('house-value-modal-save').addEventListener('click', () => {
  const newHouseValue = parseIndianNumber(modalHouseValue.value);
  if (newHouseValue > 0) {
    modelInputs.propertyPrice = newHouseValue;
    localStorage.setItem('houseValue', newHouseValue);
  }
  houseValueModal.classList.remove('visible');
  updateUI();
});

houseValueModal.addEventListener('click', (e) => {
  if (e.target === houseValueModal) houseValueModal.classList.remove('visible');
});

// Funding gap breakdown modal
const fundingBreakdownModal = document.getElementById('funding-breakdown-modal');

document.getElementById('funding-info-btn').addEventListener('click', () => {
  const results = calculateModel(modelInputs);
  const downPaymentPct = ((1 - modelInputs.homeLoanLtvPct) * 100).toFixed(0);
  const interiorsPct = (modelInputs.interiorsPct * 100).toFixed(0);
  const transactionDutyPct = (modelInputs.transactionDutyPct * 100).toFixed(1);

  document.getElementById('funding-breakdown-content').innerHTML = `
    <div class="detail-table">
      <div class="detail-row">
        <span class="detail-label">Property Value</span>
        <span class="detail-value">${formatCurrency(results.propertyPrice)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Home Loan (${(modelInputs.homeLoanLtvPct * 100).toFixed(0)}% LTV)</span>
        <span class="detail-value">-${formatCurrency(results.homeLoanAmount)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Down Payment (${downPaymentPct}%)</span>
        <span class="detail-value">${formatCurrency(results.downPayment)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Stamp Duty & Registration (${transactionDutyPct}%)</span>
        <span class="detail-value">${formatCurrency(results.transactionDuty)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Interior Budget (${interiorsPct}%)</span>
        <span class="detail-value">${formatCurrency(results.interiors)}</span>
      </div>
      ${results.gst > 0 ? `<div class="detail-row">
        <span class="detail-label">GST (5%)</span>
        <span class="detail-value">${formatCurrency(results.gst)}</span>
      </div>` : ''}
      <div class="detail-row total-row">
        <span class="detail-label">Total Funding Gap</span>
        <span class="detail-value">${formatCurrency(results.fundingGap)}</span>
      </div>
    </div>
  `;
  fundingBreakdownModal.classList.add('visible');
});

document.getElementById('funding-breakdown-close').addEventListener('click', () => {
  fundingBreakdownModal.classList.remove('visible');
});

fundingBreakdownModal.addEventListener('click', (e) => {
  if (e.target === fundingBreakdownModal) fundingBreakdownModal.classList.remove('visible');
});

let carouselInterval = null;
let modalCarouselInterval = null;

function initCarousel() {
  const container = document.querySelector('.carousel-container');
  if (!container) return;

  const track = document.getElementById('carousel-track');
  if (!track) return;

  if (carouselInterval) clearInterval(carouselInterval);

  carouselInterval = setInterval(() => {
    const maxScroll = track.scrollWidth - container.clientWidth;
    if (container.scrollLeft >= maxScroll - 10) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: 282, behavior: 'smooth' });
    }
  }, 3000);
}

function initModalCarousel() {
  const container = document.querySelector('.modal-carousel-container');
  if (!container) return;

  const track = container.querySelector('.modal-carousel-track');
  if (!track) return;

  if (modalCarouselInterval) clearInterval(modalCarouselInterval);

  modalCarouselInterval = setInterval(() => {
    const maxScroll = track.scrollWidth - container.clientWidth;
    if (container.scrollLeft >= maxScroll - 10) {
      container.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      container.scrollBy({ left: 252, behavior: 'smooth' });
    }
  }, 3000);
}

function stopModalCarousel() {
  if (modalCarouselInterval) {
    clearInterval(modalCarouselInterval);
    modalCarouselInterval = null;
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

// After 5 seconds, shrink left column and reveal right column
setTimeout(() => {
  leftColumn.classList.remove('fullwidth');

  // After left column starts shrinking, expand right column and show settings
  setTimeout(() => {
    rightColumn.classList.add('visible');
    settingsSection.classList.add('visible');

    // After right column has fully expanded, fade in content
    setTimeout(() => {
      rightColumn.classList.add('content-visible');
    }, 1000);
  }, 400);
}, 5000);
