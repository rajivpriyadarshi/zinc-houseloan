import { getTransactionDutyRate } from './lib/stateDuty.js';
import { trackButtonClick, trackPageView } from './firebaseAnalytics.js';
import { navigateTo } from './router.js';

trackPageView('funding_breakdown');

const propertyPrice = parseInt(localStorage.getItem('houseValue') || '10000000', 10);
const selectedCity = localStorage.getItem('selectedCity') || 'Bangalore';

// These values should match the logic layer in results.js
const homeLoanLtvPct = 0.8;
const interiorsPct = 0.3; // 30% of property price
const transactionDutyPct = getTransactionDutyRate(selectedCity);

const homeLoanAmount = propertyPrice * homeLoanLtvPct;
const downPayment = propertyPrice * (1 - homeLoanLtvPct);
const transactionDuty = propertyPrice * transactionDutyPct;
const interiors = propertyPrice * interiorsPct;
const fundingGap = downPayment + transactionDuty + interiors;

function formatCr(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) {
    const cr = lacs / 100;
    return `₹${cr.toFixed(2)} Cr`;
  }
  return `₹${lacs.toFixed(2)} L`;
}

function formatLacs(amount) {
  const lacs = amount / 100000;
  if (lacs >= 100) return `₹${(lacs / 100).toFixed(2)} Cr`;
  return `₹${lacs.toFixed(2)} L`;
}

const totalCost = propertyPrice + transactionDuty + interiors;

document.getElementById('hero-amount').textContent = formatCr(fundingGap);
document.getElementById('breakdown-loan').textContent = formatCr(propertyPrice);
document.getElementById('breakdown-interior').textContent = formatLacs(interiors);
document.getElementById('breakdown-stamp').textContent = formatLacs(transactionDuty);

const scene = document.querySelector('.hero-breakdown-scene');
const continueBtn = document.getElementById('continue-btn');

const baseTall = document.querySelector('.stack-base-tall');
const baseSmall = document.querySelector('.stack-base');
const lower = document.querySelector('.stack-lower');
const middle = document.querySelector('.stack-middle');
const top = document.querySelector('.stack-top');
const heroSummary = document.querySelector('.hero-summary');
const sideLabel = document.querySelector('.stack-side-label');

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

function animateGreenFillUp(duration) {
  return new Promise(resolve => {
    const clipPoly = document.getElementById('green-80-clip-poly');
    const startEdgeY = 860;
    const endEdgeY = 403;
    const vOffset = 69;
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const t = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const curEdgeY = Math.round(lerp(startEdgeY, endEdgeY, ease));
      const curCenterY = curEdgeY + vOffset;
      clipPoly.setAttribute('points', `0,${curEdgeY} 120,${curCenterY} 240,${curEdgeY} 240,1800 0,1800`);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

function animateDottedLineLeftToRight(duration) {
  return new Promise(resolve => {
    const dottedClip = document.getElementById('dotted-20-clip-rect');
    const solidClip = document.getElementById('solid-20-clip-rect');
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const t = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      const curX = Math.round(240 * ease);
      dottedClip.setAttribute('width', curX);
      solidClip.setAttribute('x', curX);
      solidClip.setAttribute('width', 240 - curX);
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

function animateRedFillLeftToRight(duration) {
  return new Promise(resolve => {
    const clipRect = document.getElementById('red-20-clip-rect');
    let startTime = null;

    function tick(timestamp) {
      if (!startTime) startTime = timestamp;
      const t = Math.min((timestamp - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      clipRect.setAttribute('width', Math.round(240 * ease));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        resolve();
      }
    }

    requestAnimationFrame(tick);
  });
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function resetAnimation() {
  scene.classList.remove('animating');

  // Reset green tall block
  document.getElementById('gt-top').setAttribute('fill', 'none');
  document.getElementById('gt-left').setAttribute('fill', 'none');
  document.getElementById('gt-right').setAttribute('fill', 'none');
  document.getElementById('green-80-clip-poly').setAttribute('points', '0,860 120,930 240,860 240,1800 0,1800');
  baseTall.style.display = '';

  // Re-trigger slide-in-from-bottom animation
  baseTall.style.animation = 'none';
  baseTall.style.opacity = '0';
  baseTall.style.transform = 'translateY(100vh)';
  baseTall.offsetHeight;
  baseTall.style.animation = 'slideInUp 800ms ease-in-out forwards';

  // Reset solid clip
  document.getElementById('solid-20-clip-rect').setAttribute('x', '0');
  document.getElementById('solid-20-clip-rect').setAttribute('width', '240');

  // Reset 20% overlay
  document.getElementById('red-20-clip-rect').setAttribute('width', '0');
  document.getElementById('dotted-20-clip-rect').setAttribute('width', '0');
  document.getElementById('gt-20-bottom-solid').setAttribute('opacity', '0');
  document.getElementById('gt-20-stroke').setAttribute('opacity', '1');
  document.getElementById('gt-top-overlay').setAttribute('opacity', '0');

  // Reset right labels
  document.querySelectorAll('.stack-right-row').forEach(row => row.classList.remove('show'));

  // Reset red blocks
  [middle, top].forEach(block => {
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


  // Reset hero summary
  heroSummary.classList.remove('show');

  // Reset cluster position
  document.querySelector('.stack-cluster').classList.remove('shifted');

  // Reset label
  document.querySelector('.stack-side-text').textContent = 'Property cost';
}

async function runAnimation() {
  scene.classList.add('animating');
  document.getElementById('breakdown-loan').textContent = formatCr(propertyPrice);

  // Wait for intro animations: block(800ms) + gap(300ms) + line(800ms) + gap(300ms) + pill(800ms)
  await wait(3300);

  // Step 2: Fill bottom 80% with green from bottom to top
  await animateGreenFillUp(1000);

  // Step 3: Solid to dotted transition left-to-right
  await animateDottedLineLeftToRight(800);
  await wait(400);

  // Show "Home loan" label
  document.getElementById('breakdown-homeloan').textContent = formatCr(homeLoanAmount);
  document.getElementById('breakdown-loan').textContent = formatCr(propertyPrice);
  document.querySelector('.stack-right-row-loan').classList.add('show');
  await wait(800);

  // Step 4: Fill 20% section with red (left to right reveal)
  // Remove dotted wireframe, show solid top surface with dark fill and white border on top
  document.getElementById('gt-20-stroke').setAttribute('opacity', '0');
  document.getElementById('gt-top-overlay').setAttribute('opacity', '1');
  await animateRedFillLeftToRight(800);
  await wait(400);
  document.getElementById('breakdown-downpayment').textContent = formatLacs(downPayment);
  document.querySelector('.stack-right-row-dp').classList.add('show');
  await wait(800);

  // Step 5: Middle red block (interior - 30%) appears
  middle.classList.add('show-dotted');
  await wait(700);
  animateStrokeToSolid(middle, 800);
  middle.classList.remove('show-dotted');
  middle.classList.add('show-solid');
  await wait(900);
  document.querySelector('.stack-right-row-interior').classList.add('show');
  await wait(500);

  // Step 6: Top red block (stamp duty - ~6-8%) appears
  top.classList.add('show-dotted');
  await wait(700);
  animateStrokeToSolid(top, 800);
  top.classList.remove('show-dotted');
  top.classList.add('show-solid');
  await wait(900);
  document.querySelector('.stack-right-row-stamp').classList.add('show');
  await wait(500);

  // Step 7: Shift everything left and show hero summary
  document.querySelector('.stack-cluster').classList.add('shifted');
  await wait(800);
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
