import { getTransactionDutyRate } from './lib/stateDuty.js';

// Get stored values
const propertyPrice = parseInt(localStorage.getItem('houseValue')) || 10000000;
const selectedCity = localStorage.getItem('selectedCity') || 'Bangalore';
const transactionDutyPct = getTransactionDutyRate(selectedCity);

// Calculate values
const homeLoanLtvPct = 0.8;
const interiorsPct = 0.3;

const homeLoanAmount = propertyPrice * homeLoanLtvPct;
const downPayment = propertyPrice * (1 - homeLoanLtvPct);
const transactionDuty = propertyPrice * transactionDutyPct;
const interiors = propertyPrice * interiorsPct;
const fundingGap = downPayment + transactionDuty + interiors;

// Format currency
function formatLacs(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) {
    return (lacs / 100).toFixed(1) + ' Cr';
  }
  return Math.round(lacs) + ' L';
}

function formatCr(amount) {
  const cr = amount / 10000000;
  if (cr >= 1) {
    return cr.toFixed(2) + ' Cr';
  }
  return Math.round(amount / 100000) + ' Lacs';
}

// Update labels with actual values
document.getElementById('loan-amount').textContent = formatLacs(homeLoanAmount);
document.getElementById('downpayment-amount').textContent = formatLacs(downPayment);
document.getElementById('interior-amount').textContent = formatLacs(interiors);
document.getElementById('stamp-amount').textContent = formatLacs(transactionDuty);
document.getElementById('amount-value').textContent = formatCr(fundingGap);

// Hide all blocks initially
document.querySelectorAll('.block').forEach(block => {
  block.classList.add('hidden');
});

// Animation timeline
const timeline = [
  // Step 1: Green block grows + label
  { delay: 800, action: () => {
    document.getElementById('green-block').classList.add('animate-in');
  }},
  { delay: 1600, action: () => {
    document.getElementById('loan-label').classList.add('animate-in');
  }},

  // Step 2: Down payment block grows + label
  { delay: 3000, action: () => {
    document.getElementById('downpayment-block').classList.add('animate-in');
  }},
  { delay: 3800, action: () => {
    document.getElementById('downpayment-label').classList.add('animate-in');
  }},

  // Step 3: Interior block grows + label
  { delay: 5200, action: () => {
    document.getElementById('interior-block').classList.add('animate-in');
  }},
  { delay: 6000, action: () => {
    document.getElementById('interior-label').classList.add('animate-in');
  }},

  // Step 4: Stamp duty block grows + label
  { delay: 7400, action: () => {
    document.getElementById('stamp-block').classList.add('animate-in');
  }},
  { delay: 8200, action: () => {
    document.getElementById('stamp-label').classList.add('animate-in');
  }},

  // Step 5: Show result section
  { delay: 9600, action: () => {
    document.getElementById('result-section').classList.add('animate-in');
  }},

  // Step 6: Show proceed button
  { delay: 10800, action: () => {
    document.getElementById('proceed-btn').classList.add('visible');
  }}
];

// Run timeline
let timeoutIds = [];

function runTimeline() {
  timeline.forEach(step => {
    const id = setTimeout(step.action, step.delay);
    timeoutIds.push(id);
  });
}

function clearTimeline() {
  timeoutIds.forEach(id => clearTimeout(id));
  timeoutIds = [];
}

function showAll() {
  document.getElementById('green-block').classList.add('animate-in');
  document.getElementById('downpayment-block').classList.add('animate-in');
  document.getElementById('interior-block').classList.add('animate-in');
  document.getElementById('stamp-block').classList.add('animate-in');
  document.getElementById('loan-label').classList.add('animate-in');
  document.getElementById('downpayment-label').classList.add('animate-in');
  document.getElementById('interior-label').classList.add('animate-in');
  document.getElementById('stamp-label').classList.add('animate-in');
  document.getElementById('result-section').classList.add('animate-in');
  document.getElementById('proceed-btn').classList.add('visible');
}

function navigateToResults() {
  document.body.classList.add('page-exit');
  setTimeout(() => {
    window.location.href = 'results.html';
  }, 400);
}

// Skip button
document.getElementById('skip-btn').addEventListener('click', () => {
  clearTimeline();
  showAll();
});

// Proceed button
document.getElementById('proceed-btn').addEventListener('click', () => {
  navigateToResults();
});

// Start
runTimeline();
