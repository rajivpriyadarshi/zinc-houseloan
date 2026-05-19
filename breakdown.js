import { getTransactionDutyRate } from './lib/stateDuty.js';
import { trackButtonClick, trackPageView } from './firebaseAnalytics.js';

trackPageView('funding_breakdown');

const propertyPrice = parseInt(localStorage.getItem('houseValue') || '10000000', 10);
const selectedCity = localStorage.getItem('selectedCity') || 'Bangalore';

const homeLoanLtvPct = 0.8;
const interiorsPct = 0.2;
const transactionDutyPct = getTransactionDutyRate(selectedCity);

const homeLoanAmount = propertyPrice * homeLoanLtvPct;
const downPayment = propertyPrice * (1 - homeLoanLtvPct);
const transactionDuty = propertyPrice * transactionDutyPct;
const interiors = propertyPrice * interiorsPct;
const fundingGap = downPayment + transactionDuty + interiors;

function formatCr(amount) {
  const cr = amount / 10000000;
  return `${cr.toFixed(2)} Cr`;
}

function formatLacs(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) return `${(lacs / 100).toFixed(1)} Cr`;
  return `${Math.round(lacs)} L`;
}

const totalCost = propertyPrice + transactionDuty + interiors;

document.getElementById('hero-amount').textContent = formatCr(fundingGap);
document.getElementById('breakdown-loan').textContent = formatCr(totalCost);
document.getElementById('breakdown-downpayment').textContent = formatLacs(downPayment);
document.getElementById('breakdown-interior').textContent = formatLacs(interiors);
document.getElementById('breakdown-stamp').textContent = formatLacs(transactionDuty);

// Change label from total to loan amount after initial display
setTimeout(() => {
  document.getElementById('breakdown-loan').textContent = formatCr(homeLoanAmount);
}, 900);

const heroSummary = document.querySelector('.hero-summary');
heroSummary.addEventListener('animationend', () => {
  trackButtonClick('breakdown_continue');
  setTimeout(() => {
    window.location.href = 'results.html';
  }, 1500);
});
