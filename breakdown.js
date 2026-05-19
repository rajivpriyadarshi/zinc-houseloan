import { getTransactionDutyRate } from './lib/stateDuty.js';
import { trackButtonClick, trackPageView } from './firebaseAnalytics.js';
import { navigateTo } from './router.js';

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

const scene = document.querySelector('.hero-breakdown-scene');
const continueBtn = document.getElementById('continue-btn');

const baseTall = document.querySelector('.stack-base-tall');
const baseSmall = document.querySelector('.stack-base');
const lower = document.querySelector('.stack-lower');
const middle = document.querySelector('.stack-middle');
const top = document.querySelector('.stack-top');
const rows = document.querySelectorAll('.stack-row');
const heroSummary = document.querySelector('.hero-summary');
const sideLabel = document.querySelector('.stack-side-label');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function animateGreenToDotted(duration) {
  // Animate the solid strokes disappearing (traveling from left to right)
  const ids = ['gt-top-s', 'gt-left-edge-d', 'gt-right-edge-d', 'gt-center-edge-d', 'gt-left-edge-s', 'gt-right-edge-s', 'gt-center-edge-s', 'gt-bottom'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = '0';
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
    el.style.strokeDashoffset = `${length}`;
  });
  // Show the dotted path underneath
  const dottedTravel = document.getElementById('gt-dotted-travel');
  dottedTravel.setAttribute('opacity', '1');
}

function animateStrokeToSolid(svg, duration) {
  const solidPath = svg.querySelector('.red-solid');
  const dottedPath = svg.querySelector('.red-dotted');
  const length = solidPath.getTotalLength();
  solidPath.style.strokeDasharray = `${length}`;
  solidPath.style.strokeDashoffset = `${length}`;
  solidPath.getBoundingClientRect();
  solidPath.style.transition = `stroke-dashoffset ${duration}ms ease-out`;
  solidPath.style.strokeDashoffset = '0';
  setTimeout(() => {
    dottedPath.style.opacity = '0';
  }, duration * 0.4);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function animateShrink(duration) {
  return new Promise(resolve => {
    const topFill = document.getElementById('gt-top');
    const leftFill = document.getElementById('gt-left');
    const rightFill = document.getElementById('gt-right');
    const topStroke = document.getElementById('gt-top-s');
    const leftEdgeD = document.getElementById('gt-left-edge-d');
    const rightEdgeD = document.getElementById('gt-right-edge-d');
    const centerEdgeD = document.getElementById('gt-center-edge-d');
    const leftEdgeS = document.getElementById('gt-left-edge-s');
    const rightEdgeS = document.getElementById('gt-right-edge-s');
    const centerEdgeS = document.getElementById('gt-center-edge-s');

    const startTopY = 72;
    const startCenterY = 144;
    const endTopY = 307;
    const endCenterY = 379;

    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const t = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);

      const curTopY = Math.round(lerp(startTopY, endTopY, ease));
      const curCenterY = Math.round(lerp(startCenterY, endCenterY, ease));

      topFill.setAttribute('d', `M1 ${curTopY}L120 ${curCenterY}L239 ${curTopY}L120 ${curTopY - 71}Z`);
      topStroke.setAttribute('d', `M1 ${curTopY}L120 ${curCenterY}L239 ${curTopY}L120 ${curTopY - 71}Z`);

      leftFill.setAttribute('d', `M1 ${curTopY}V789L120 858V${curCenterY}L1 ${curTopY}Z`);
      rightFill.setAttribute('d', `M239 ${curTopY}V789L120 858V${curCenterY}L239 ${curTopY}Z`);

      leftEdgeD.setAttribute('d', `M1 ${curTopY}V307`);
      rightEdgeD.setAttribute('d', `M239 ${curTopY}V307`);
      centerEdgeD.setAttribute('d', `M120 ${curCenterY}V379`);

      leftEdgeS.setAttribute('d', `M1 307V789`);
      rightEdgeS.setAttribute('d', `M239 307V789`);
      centerEdgeS.setAttribute('d', `M120 379V858`);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

function resetAnimation() {
  scene.classList.remove('animating');

  // Reset green tall block
  document.getElementById('gt-top').setAttribute('d', 'M1 72L120 144L239 72L120 1Z');
  document.getElementById('gt-left').setAttribute('d', 'M1 72V789L120 858V144L1 72Z');
  document.getElementById('gt-right').setAttribute('d', 'M239 72V789L120 858V144L239 72Z');
  document.getElementById('gt-top-s').setAttribute('d', 'M1 72L120 144L239 72L120 1Z');
  document.getElementById('gt-top-s').removeAttribute('stroke-dasharray');
  document.getElementById('gt-left-edge-d').setAttribute('d', 'M1 72V307');
  document.getElementById('gt-left-edge-d').removeAttribute('stroke-dasharray');
  document.getElementById('gt-right-edge-d').setAttribute('d', 'M239 72V307');
  document.getElementById('gt-right-edge-d').removeAttribute('stroke-dasharray');
  document.getElementById('gt-center-edge-d').setAttribute('d', 'M120 144V379');
  document.getElementById('gt-center-edge-d').removeAttribute('stroke-dasharray');
  document.getElementById('gt-left-edge-s').setAttribute('d', 'M1 307V789');
  document.getElementById('gt-left-edge-s').removeAttribute('stroke-dasharray');
  document.getElementById('gt-right-edge-s').setAttribute('d', 'M239 307V789');
  document.getElementById('gt-right-edge-s').removeAttribute('stroke-dasharray');
  document.getElementById('gt-center-edge-s').setAttribute('d', 'M120 379V858');
  document.getElementById('gt-center-edge-s').removeAttribute('stroke-dasharray');
  document.getElementById('gt-bottom').removeAttribute('stroke-dasharray');
  // Reset solid strokes and hide dotted travel path
  const strokeIds = ['gt-top-s', 'gt-left-edge-d', 'gt-right-edge-d', 'gt-center-edge-d', 'gt-left-edge-s', 'gt-right-edge-s', 'gt-center-edge-s', 'gt-bottom'];
  strokeIds.forEach(id => {
    const el = document.getElementById(id);
    el.style.transition = '';
    el.style.strokeDasharray = '';
    el.style.strokeDashoffset = '';
  });
  document.getElementById('gt-dotted-travel').setAttribute('opacity', '0');
  baseTall.style.display = '';

  // Reset red blocks
  [lower, middle, top].forEach(block => {
    block.classList.remove('show-dotted', 'show-solid');
    const solidPath = block.querySelector('.red-solid');
    const dottedPath = block.querySelector('.red-dotted');
    if (solidPath) {
      solidPath.style.transition = '';
      solidPath.style.strokeDasharray = '9999';
      solidPath.style.strokeDashoffset = '9999';
    }
    if (dottedPath) {
      dottedPath.style.opacity = '';
    }
  });

  // Reset rows
  rows.forEach(row => row.classList.remove('show'));

  // Reset hero summary
  heroSummary.classList.remove('show');

  // Reset label
  document.querySelector('.stack-side-text').textContent = 'Total cost';
}

async function runAnimation() {
  scene.classList.add('animating');
  document.getElementById('breakdown-loan').textContent = formatCr(totalCost);

  // Step 1: Show tall green block (already visible via CSS)
  await wait(1000);

  // Step 2: Animate tall block shrinking (top face moves down)
  await animateShrink(1200);
  // Animate solid to dotted (travels from top-left to top-right)
  animateGreenToDotted(800);
  document.getElementById('breakdown-loan').textContent = formatCr(homeLoanAmount);
  document.querySelector('.stack-side-text').textContent = 'Loan amount';
  await wait(900);

  // Step 3: Lower red block appears dotted then stroke travels to solid
  lower.classList.add('show-dotted');
  await wait(700);
  animateStrokeToSolid(lower, 800);
  lower.classList.remove('show-dotted');
  lower.classList.add('show-solid');
  await wait(900);
  rows[2].classList.add('show');
  await wait(500);

  // Step 4: Middle red block appears dotted then stroke travels to solid
  middle.classList.add('show-dotted');
  await wait(700);
  animateStrokeToSolid(middle, 800);
  middle.classList.remove('show-dotted');
  middle.classList.add('show-solid');
  await wait(900);
  rows[1].classList.add('show');
  await wait(500);

  // Step 5: Top red block appears dotted then stroke travels to solid
  top.classList.add('show-dotted');
  await wait(700);
  animateStrokeToSolid(top, 800);
  top.classList.remove('show-dotted');
  top.classList.add('show-solid');
  await wait(900);
  rows[0].classList.add('show');
  await wait(500);

  // Step 6: Show hero summary
  heroSummary.classList.add('show');
  await wait(800);

  // Show continue button (stays visible permanently after first loop)
  if (!continueBtn.classList.contains('visible')) {
    continueBtn.classList.add('visible');
  }

  // Wait then loop
  await wait(3000);
  resetAnimation();
  await wait(500);
  runAnimation();
}

runAnimation();

continueBtn.addEventListener('click', () => {
  trackButtonClick('breakdown_continue');
  window.location.href = 'results.html';
});
