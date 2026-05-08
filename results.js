import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
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
  zincLoanTenureYears: 5,
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

// Calculation functions from the logic engine
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

  // Calculate asset sale strategies
  const strategies = [];

  // Cash
  const cashFutureValue = calculateFutureValue(fundingGap, inputs.assets.cash.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'use-cash',
    strategyName: 'Use cash',
    impact: cashFutureValue,
    rank: 0
  });

  // Land
  const landGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.land.embeddedGainPct, inputs.assets.land.ltcgTaxRatePct, inputs.assets.land.exemptionAmount);
  const landFutureValue = calculateFutureValue(landGrossSale, inputs.assets.land.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-land',
    strategyName: 'Sell Land',
    impact: landFutureValue,
    rank: 0
  });

  // Indian Equity
  const equityGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.indianEquity.embeddedGainPct, inputs.assets.indianEquity.ltcgTaxRatePct, inputs.assets.indianEquity.exemptionAmount);
  const equityFutureValue = calculateFutureValue(equityGrossSale, inputs.assets.indianEquity.cagrPct, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-indian-equity',
    strategyName: 'Sell Indian Listed Equity',
    impact: equityFutureValue,
    rank: 0
  });

  // Foreign RSUs
  const rsuGrossSale = calculateGrossSaleRequired(fundingGap, inputs.assets.foreignRsu.embeddedGainPct, inputs.assets.foreignRsu.ltcgTaxRatePct, inputs.assets.foreignRsu.exemptionAmount);
  const rsuFutureValue = calculateFutureValue(rsuGrossSale, effectiveRsuInrCagr, analysisHorizonYears);
  strategies.push({
    strategyId: 'sell-rsus',
    strategyName: 'Sell Foreign RSUs',
    impact: rsuFutureValue,
    rank: 0
  });

  // Zinc Loan
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

  // Rank strategies
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

// Format currency
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
    return (lacs / 100).toFixed(1) + ' CR';
  }
  return lacs.toFixed(1) + ' LACS';
}

function formatCr(amount) {
  return (amount / 10000000).toFixed(2) + ' CR';
}

// Update UI
function updateUI() {
  const results = calculateModel(modelInputs);

  // Update funding amount
  document.getElementById('funding-amount').textContent = formatLacs(results.fundingGap);

  // Update city and house value
  document.getElementById('city-name').textContent = selectedCity;
  document.getElementById('house-value').textContent = formatCr(modelInputs.propertyPrice);

  // Update settings display
  const ratePercent = (modelInputs.selectedHomeLoanRatePct * 100).toFixed(1);
  const ltvPercent = (modelInputs.homeLoanLtvPct * 100).toFixed(0);
  document.getElementById('loan-settings-value').textContent = `${ratePercent}%, ${modelInputs.homeLoanTenureYears} year, ${ltvPercent}%`;

  document.getElementById('construction-value').textContent = modelInputs.propertyStatus === 'Ready' ? 'No' : 'Yes';

  // Update options
  const bestOption = results.strategies.find(s => s.rank === 1);
  const otherOptions = results.strategies.filter(s => s.rank !== 1);

  document.getElementById('best-option').innerHTML = `
    <div class="option-rank rank-1">1</div>
    <div class="option-info">
      <div class="option-name">${bestOption.strategyName}</div>
    </div>
    <div class="option-impact">
      <div class="option-amount">${formatCurrency(bestOption.impact)}</div>
      <div class="option-label">10 year financing impact</div>
    </div>
    <svg class="option-expand" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
  `;
  document.getElementById('best-option').dataset.strategyId = bestOption.strategyId;

  const otherOptionsHtml = otherOptions.map(opt => `
    <div class="option-card" data-strategy-id="${opt.strategyId}">
      <div class="option-rank rank-other">${opt.rank}</div>
      <div class="option-info">
        <div class="option-name">${opt.strategyName}</div>
      </div>
      <div class="option-impact">
        <div class="option-amount">${formatCurrency(opt.impact)}</div>
        <div class="option-label">10 year financing impact</div>
      </div>
      <svg class="option-expand" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
    </div>
  `).join('');
  document.getElementById('other-options').innerHTML = otherOptionsHtml;

  // Add click handlers for option cards
  document.querySelectorAll('.option-card').forEach(card => {
    card.addEventListener('click', () => showOptionDetails(card.dataset.strategyId, results));
  });
}

function showOptionDetails(strategyId, results) {
  const strategy = results.strategies.find(s => s.strategyId === strategyId);
  if (!strategy) return;

  document.getElementById('detail-modal-title').textContent = strategy.strategyName;

  let content = `
    <div class="detail-row">
      <span class="detail-label">10 Year Financing Impact</span>
      <span class="detail-value">${formatCurrency(strategy.impact)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Funding Gap</span>
      <span class="detail-value">${formatCurrency(results.fundingGap)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Home Loan Amount</span>
      <span class="detail-value">${formatCurrency(results.homeLoanAmount)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Monthly EMI</span>
      <span class="detail-value">${formatCurrency(results.monthlyEmi)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Down Payment</span>
      <span class="detail-value">${formatCurrency(results.downPayment)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Transaction Duty</span>
      <span class="detail-value">${formatCurrency(results.transactionDuty)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">Interiors</span>
      <span class="detail-value">${formatCurrency(results.interiors)}</span>
    </div>
  `;

  document.getElementById('detail-modal-content').innerHTML = content;
  document.getElementById('detail-modal').classList.add('visible');
}

// Modal handlers
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

document.getElementById('construction-btn').addEventListener('click', () => {
  document.getElementById('modal-construction').value = modelInputs.propertyStatus;
  constructionModal.classList.add('visible');
});

document.getElementById('construction-modal-cancel').addEventListener('click', () => {
  constructionModal.classList.remove('visible');
});

document.getElementById('construction-modal-save').addEventListener('click', () => {
  modelInputs.propertyStatus = document.getElementById('modal-construction').value;
  constructionModal.classList.remove('visible');
  updateUI();
});

document.getElementById('detail-modal-close').addEventListener('click', () => {
  detailModal.classList.remove('visible');
});

// Close modals on overlay click
[loanModal, constructionModal, detailModal].forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('visible');
  });
});

// Initialize UI
updateUI();

// 3D Model Setup
const container = document.getElementById('canvas-container');
const scene = new THREE.Scene();
scene.background = null;

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, 2, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = false;
controls.enablePan = false;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.5;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

const loader = new GLTFLoader();

// Determine which model to load based on property price
function getModelPath() {
  if (propertyPrice < 10000000) return '/models/house.glb';
  if (propertyPrice < 30000000) return '/models/house_rodin.glb';
  return '/models/house_large.glb';
}

loader.load(getModelPath(), (gltf) => {
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  model.position.sub(center);
  model.position.y += size.y * 0.1;

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = 3 / maxDim;
  model.scale.setScalar(scale);

  scene.add(model);
  controls.target.set(0, 0, 0);
  controls.update();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

container.addEventListener('mousedown', () => controls.autoRotate = false);
container.addEventListener('mouseup', () => setTimeout(() => controls.autoRotate = true, 3000));
