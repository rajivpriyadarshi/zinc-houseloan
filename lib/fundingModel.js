import { PURCHASE_DEFAULTS } from "./purchaseBudget.js";

export function createFundingInputs(budget) {
  return {
    propertyStatus: "Ready",
    propertyPrice: budget.price,
    transactionDutyPct: budget.dutyRate,
    interiorsPct: PURCHASE_DEFAULTS.interiorsPct,
    homeLoanLtvPct: PURCHASE_DEFAULTS.homeLoanLtvPct,
    homeLoanTenureYears: 20,
    selectedHomeLoanRatePct: 0.085,
    constructionDurationYears: 3,
    drawdownSchedule: [
      { id: "drawdown-1", year: 0, percentage: 0.3 },
      { id: "drawdown-2", year: 1, percentage: 0.3 },
      { id: "drawdown-3", year: 2, percentage: 0.2 },
      { id: "drawdown-4", year: 3, percentage: 0.2 },
    ],
    zincLoanStructure: "Interest Only",
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
}

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
  const scheduledPayment = calculateEmi(
    sanitizedPrincipal,
    sanitizedRate,
    years,
  );
  const schedule = [];
  let remainingPrincipal = sanitizedPrincipal;
  let cumulativeInterest = 0;

  for (let month = 1; month <= months; month++) {
    const interestPayment =
      monthlyRate === 0 ? 0 : remainingPrincipal * monthlyRate;
    const principalPayment = Math.min(
      Math.max(scheduledPayment - interestPayment, 0),
      remainingPrincipal,
    );
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

function calculateGrossSaleRequired(
  fundingGap,
  embeddedGainPct,
  taxRate,
  exemption,
) {
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
  return (
    nonNegative(presentValue) * (1 + safeNumber(cagr)) ** nonNegative(years)
  );
}

function calculateEffectiveRsuInrCagr(usdCagr, inrDepreciation) {
  return (1 + safeNumber(usdCagr)) * (1 + safeNumber(inrDepreciation)) - 1;
}

export function deriveZincLoanRate(homeLoanRate) {
  return Math.min(nonNegative(homeLoanRate) + ZINC_RATE_SPREAD, ZINC_RATE_CAP);
}

function calculatePreEmiInterest(
  homeLoanAmount,
  annualRate,
  drawdownSchedule,
  constructionDurationYears,
) {
  const sanitizedHomeLoanAmount = nonNegative(homeLoanAmount);
  const sanitizedAnnualRate = nonNegative(annualRate);
  const sanitizedConstructionDuration = nonNegative(constructionDurationYears);

  let totalInterest = 0;
  drawdownSchedule.forEach((row) => {
    const trancheAmount = sanitizedHomeLoanAmount * safeNumber(row.percentage);
    const yearsOutstanding = Math.max(
      sanitizedConstructionDuration - safeNumber(row.year),
      0,
    );
    totalInterest += trancheAmount * sanitizedAnnualRate * yearsOutstanding;
  });
  return totalInterest;
}

export function calculateModel(inputs) {
  const analysisHorizonYears = nonNegative(inputs.zincLoanTenureYears);
  const propertyPrice = nonNegative(inputs.propertyPrice);
  const gstRate =
    inputs.propertyStatus === "Under Construction"
      ? UNDER_CONSTRUCTION_GST_RATE
      : READY_GST_RATE;

  const homeLoanAmount = propertyPrice * nonNegative(inputs.homeLoanLtvPct);
  const downPayment = propertyPrice * (1 - nonNegative(inputs.homeLoanLtvPct));
  const transactionDuty =
    propertyPrice * nonNegative(inputs.transactionDutyPct);
  const gst = propertyPrice * gstRate;
  const interiors = propertyPrice * nonNegative(inputs.interiorsPct);
  const fundingGap = downPayment + transactionDuty + gst + interiors;

  const homeLoanSchedule = buildAmortizationSchedule(
    homeLoanAmount,
    inputs.selectedHomeLoanRatePct,
    inputs.homeLoanTenureYears,
  );
  const monthlyEmi = calculateEmi(
    homeLoanAmount,
    inputs.selectedHomeLoanRatePct,
    inputs.homeLoanTenureYears,
  );
  const interestPaidByTenYears = getInterestPaidByYear(
    homeLoanSchedule,
    analysisHorizonYears,
  );

  const preEmiInterest =
    inputs.propertyStatus === "Under Construction"
      ? calculatePreEmiInterest(
          homeLoanAmount,
          inputs.selectedHomeLoanRatePct,
          inputs.drawdownSchedule,
          inputs.constructionDurationYears,
        )
      : 0;

  const effectiveRsuInrCagr = calculateEffectiveRsuInrCagr(
    inputs.assets.foreignRsu.usdCagrPct,
    inputs.assets.foreignRsu.inrDepreciationPct,
  );

  const strategies = [];

  const cashFutureValue = calculateFutureValue(
    fundingGap,
    inputs.assets.cash.cagrPct,
    analysisHorizonYears,
  );
  strategies.push({
    strategyId: "use-cash",
    strategyName: "Use savings",
    impact: cashFutureValue,
    rank: 0,
  });

  const landGrossSale = calculateGrossSaleRequired(
    fundingGap,
    inputs.assets.land.embeddedGainPct,
    inputs.assets.land.ltcgTaxRatePct,
    inputs.assets.land.exemptionAmount,
  );
  const landFutureValue = calculateFutureValue(
    landGrossSale,
    inputs.assets.land.cagrPct,
    analysisHorizonYears,
  );
  strategies.push({
    strategyId: "sell-land",
    strategyName: "Sell land",
    impact: landFutureValue,
    rank: 0,
  });

  const equityGrossSale = calculateGrossSaleRequired(
    fundingGap,
    inputs.assets.indianEquity.embeddedGainPct,
    inputs.assets.indianEquity.ltcgTaxRatePct,
    inputs.assets.indianEquity.exemptionAmount,
  );
  const equityFutureValue = calculateFutureValue(
    equityGrossSale,
    inputs.assets.indianEquity.cagrPct,
    analysisHorizonYears,
  );
  strategies.push({
    strategyId: "sell-indian-equity",
    strategyName: "Sell equities",
    impact: equityFutureValue,
    rank: 0,
  });

  const rsuGrossSale = calculateGrossSaleRequired(
    fundingGap,
    inputs.assets.foreignRsu.embeddedGainPct,
    inputs.assets.foreignRsu.ltcgTaxRatePct,
    inputs.assets.foreignRsu.exemptionAmount,
  );
  const rsuFutureValue = calculateFutureValue(
    rsuGrossSale,
    effectiveRsuInrCagr,
    analysisHorizonYears,
  );
  strategies.push({
    strategyId: "sell-rsus",
    strategyName: "Sell RSUs",
    impact: rsuFutureValue,
    rank: 0,
  });

  const zincRate = deriveZincLoanRate(inputs.selectedHomeLoanRatePct);
  const zincInterest = fundingGap * zincRate * analysisHorizonYears;
  const zincPaymentsFV = calculateFutureValue(
    zincInterest,
    inputs.zincPaymentReinvestmentCagrPct,
    analysisHorizonYears / 2,
  );
  const retainedRsuFV = calculateFutureValue(
    rsuGrossSale,
    effectiveRsuInrCagr,
    analysisHorizonYears,
  );
  const zincBurden = zincPaymentsFV + fundingGap;
  const zincImpact = zincBurden - retainedRsuFV;

  strategies.push({
    strategyId: "zinc-loan",
    strategyName: "Use Zinc loan",
    impact: zincImpact,
    rank: 0,
  });

  strategies.sort((a, b) => a.impact - b.impact);
  strategies.forEach((s, i) => (s.rank = i + 1));

  return {
    analysisHorizonYears,
    zincRate,
    detail: {
      "use-cash": { amount: fundingGap, futureValue: cashFutureValue, tax: 0 },
      "sell-land": {
        amount: landGrossSale,
        futureValue: landFutureValue,
        tax: landGrossSale - fundingGap,
      },
      "sell-indian-equity": {
        amount: equityGrossSale,
        futureValue: equityFutureValue,
        tax: equityGrossSale - fundingGap,
      },
      "sell-rsus": {
        amount: rsuGrossSale,
        futureValue: rsuFutureValue,
        tax: rsuGrossSale - fundingGap,
      },
      "zinc-loan": {
        amount: fundingGap,
        retainedValue: retainedRsuFV,
        interest: zincInterest,
        burden: zincBurden,
      },
    },
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
    downPayment,
  };
}
