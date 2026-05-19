import { getTransactionDutyRate } from './lib/stateDuty.js';
import { trackButtonClick, trackPageView, trackValueSubmit } from './firebaseAnalytics.js';
import { auth } from './firebaseAuth.js';
import { app } from './firebaseAuth.js';
import { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signInWithCustomToken } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Header scroll behavior
const siteHeader = document.getElementById('site-header');
const logoutBtn = document.getElementById('logout-btn');
const scrollContainer = document.querySelector('.scroll-container');
let lastScrollY = 0;

function handleHeaderScroll() {
  const currentScrollY = scrollContainer.scrollTop;
  const chartSectionBottom = document.querySelector('.chart-section')?.offsetTop + document.querySelector('.chart-section')?.offsetHeight || 0;

  // Only show header when at or above the chart section
  if (currentScrollY > chartSectionBottom - window.innerHeight * 0.5) {
    // Below chart section - always hide header
    siteHeader.classList.add('hidden');
  } else if (currentScrollY > lastScrollY && currentScrollY > 70) {
    // Scrolling down above chart section - hide header
    siteHeader.classList.add('hidden');
  } else {
    // Scrolling up and at/above chart section - show header
    siteHeader.classList.remove('hidden');
  }

  lastScrollY = currentScrollY;
}

scrollContainer.addEventListener('scroll', handleHeaderScroll, { passive: true });

// Auth state tracking
let isLoggedIn = false;
const userEmailEl = document.getElementById('user-email');

// Logout functionality
logoutBtn.addEventListener('click', async () => {
  trackButtonClick('logout_click');
  try {
    await auth.signOut();
    sessionStorage.removeItem('zinc-flow-started');
    window.location.href = '/';
  } catch (error) {
    console.error('Logout error:', error);
  }
});

// Login modal functionality
const loginModal = document.getElementById('login-modal');
const googleSignInBtn = document.getElementById('google-signin-btn');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const editEmailBtn = document.getElementById('edit-email-btn');
const loginEmail = document.getElementById('login-email');
const loginOtp = document.getElementById('login-otp');
const loginStepEmail = document.getElementById('login-step-email');
const loginStepOtp = document.getElementById('login-step-otp');
const loginEmailChip = document.getElementById('login-email-chip');
const loginStatus = document.getElementById('login-status');
const provider = new GoogleAuthProvider();

const functions = getFunctions(app, 'asia-south1');
const sendEmailOtp = httpsCallable(functions, 'sendEmailOtp');
const verifyEmailOtp = httpsCallable(functions, 'verifyEmailOtp');
const registerCustomer = httpsCallable(functions, 'registerCustomer');

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#b00020' : 'rgba(0, 0, 0, 0.6)';
}

function showStep(step) {
  loginStepEmail.classList.toggle('active', step === 'email');
  loginStepOtp.classList.toggle('active', step === 'otp');
}

function callableErrorMessage(error, fallback) {
  const details = error?.details;
  const response = details?.response;
  if (typeof response === 'string' && response.trim()) return response;
  if (response && typeof response === 'object') return response.message || response.error || JSON.stringify(response);
  if (error?.message) return error.message;
  return fallback;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function toDisplayName(email) {
  const localPart = String(email || '').split('@')[0] || 'Customer';
  return localPart.replace(/[._-]+/g, ' ').trim() || 'Customer Name';
}

async function tryRegisterCustomer(email, name) {
  try {
    await registerCustomer({ email, name });
    return true;
  } catch (error) {
    console.warn('registerCustomer failed (non-blocking):', error);
    return false;
  }
}

function closeLoginModal() {
  loginModal.classList.remove('visible');
  showStep('email');
  setLoginStatus('');
}

// Google sign in
googleSignInBtn.addEventListener('click', async () => {
  trackButtonClick('google_signin_click');
  googleSignInBtn.disabled = true;
  setLoginStatus('Signing in with Google...');
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result?.user?.email || '';
    await tryRegisterCustomer(email, result?.user?.displayName || toDisplayName(email));
    trackButtonClick('google_signin_success');
    closeLoginModal();
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(auth, provider);
      return;
    }
    setLoginStatus(callableErrorMessage(error, 'Google sign-in failed. Try again.'), true);
  } finally {
    googleSignInBtn.disabled = false;
  }
});

// Send OTP
sendOtpBtn.addEventListener('click', async () => {
  const email = String(loginEmail.value || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    setLoginStatus('Enter a valid email address.', true);
    return;
  }
  sendOtpBtn.disabled = true;
  setLoginStatus('Sending OTP...');
  try {
    await sendEmailOtp({ email });
    setLoginStatus('OTP sent. Check your email and enter the code.');
    loginEmailChip.textContent = email;
    loginOtp.value = '';
    showStep('otp');
  } catch (error) {
    setLoginStatus(callableErrorMessage(error, 'Could not send OTP. Try again.'), true);
  } finally {
    sendOtpBtn.disabled = false;
  }
});

// Verify OTP
verifyOtpBtn.addEventListener('click', async () => {
  const email = String(loginEmail.value || '').trim().toLowerCase();
  const otp = String(loginOtp.value || '').trim();
  if (!isValidEmail(email)) {
    setLoginStatus('Enter a valid email address.', true);
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    setLoginStatus('Enter a valid 6-digit OTP.', true);
    return;
  }
  verifyOtpBtn.disabled = true;
  setLoginStatus('Verifying OTP...');
  try {
    const verifyResult = await verifyEmailOtp({ email, otp });
    const customToken = verifyResult?.data?.firebaseCustomToken;
    if (!customToken) throw new Error('Missing Firebase custom token from OTP verification.');
    await signInWithCustomToken(auth, customToken);
    await tryRegisterCustomer(email, toDisplayName(email));
    trackButtonClick('email_otp_verified');
    setLoginStatus('Login successful.');
    closeLoginModal();
  } catch (error) {
    setLoginStatus(callableErrorMessage(error, 'OTP verification failed. Try again.'), true);
  } finally {
    verifyOtpBtn.disabled = false;
  }
});

// Edit email
editEmailBtn.addEventListener('click', () => {
  showStep('email');
  setLoginStatus('');
  loginEmail.focus();
});

// Close modal on overlay click
loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) {
    closeLoginModal();
  }
});

// Handle redirect result
getRedirectResult(auth)
  .then(async (result) => {
    if (!result?.user) return;
    const email = result.user.email || '';
    await tryRegisterCustomer(email, result.user.displayName || toDisplayName(email));
    closeLoginModal();
  })
  .catch((error) => {
    setLoginStatus(callableErrorMessage(error, 'Google sign-in failed. Try again.'), true);
  });

// Block scrolling past chart section until logged in
const chartSectionEl = document.querySelector('.chart-section');

// Auth state change handler
auth.onAuthStateChanged((user) => {
  isLoggedIn = !!user;
  if (user) {
    logoutBtn.classList.add('visible');
    userEmailEl.textContent = user.email || '';
    userEmailEl.classList.add('visible');
    // Re-enable snap scroll after login
    scrollContainer.style.scrollSnapType = 'y mandatory';
  } else {
    logoutBtn.classList.remove('visible');
    userEmailEl.textContent = '';
    userEmailEl.classList.remove('visible');
  }
});

let lastScrollForDirection = 0;

function blockScrollPastChart() {
  if (isLoggedIn) return;

  const currentScroll = scrollContainer.scrollTop;
  const chartBottom = chartSectionEl.offsetTop + chartSectionEl.offsetHeight - window.innerHeight;
  const scrollingDown = currentScroll > lastScrollForDirection;

  // Near the bottom of chart section
  if (currentScroll >= chartBottom - 50) {
    if (scrollingDown) {
      // Disable snap only when scrolling down at chart section
      scrollContainer.style.scrollSnapType = 'none';
    }
  } else {
    // Re-enable snap scroll when above the threshold (scrolling up)
    scrollContainer.style.scrollSnapType = 'y mandatory';
  }

  // If trying to scroll past chart section
  if (currentScroll > chartBottom + 10) {
    // Show login modal
    loginModal.classList.add('visible');
    showStep('email');
    setLoginStatus('');

    // Force scroll back to chart section
    scrollContainer.scrollTop = chartBottom;
  }

  lastScrollForDirection = currentScroll;
}

scrollContainer.addEventListener('scroll', blockScrollPastChart, { passive: true });

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
  interiorsPct: 0.3,
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
      embeddedGainPct: 0.5,
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
      embeddedGainPct: 0.5,
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
  // Amortizing loan calculation
  const zincEmi = calculateEmi(fundingGap, zincRate, inputs.zincLoanTenureYears);
  const zincTotalPayments = zincEmi * 12 * inputs.zincLoanTenureYears;
  const zincTotalInterest = zincTotalPayments - fundingGap;
  // Future value of EMI payments (average time = half the tenure)
  const zincPaymentsFV = calculateFutureValue(zincTotalPayments, inputs.zincPaymentReinvestmentCagrPct, analysisHorizonYears / 2);
  const retainedRsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuInrCagr, analysisHorizonYears);
  const zincBurden = zincPaymentsFV;
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
    return '₹' + Math.round(amount).toLocaleString('en-IN');
  }
}

function formatCr(amount) {
  const cr = amount / 10000000;
  if (cr >= 1) {
    return cr.toFixed(2) + ' Cr';
  }
  return (amount / 100000).toFixed(2) + ' Lacs';
}

function formatCrSigned(amount) {
  const cr = Math.abs(amount) / 10000000;
  const sign = amount >= 0 ? '+' : '-';
  if (cr >= 1) {
    return sign + cr.toFixed(2) + ' Cr';
  }
  const lacs = Math.abs(amount) / 100000;
  return sign + lacs.toFixed(2) + ' L';
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
  document.getElementById('hero-ltv').textContent = (modelInputs.homeLoanLtvPct * 100).toFixed(0);

  // Update breakdown pills
  document.getElementById('breakdown-downpayment').textContent = formatLacs(results.downPayment);
  document.getElementById('breakdown-interior').textContent = formatLacs(results.interiors);
  document.getElementById('breakdown-stamp').textContent = formatLacs(results.transactionDuty);

  // Calculate absolute future values (same as shown in option sections)
  const years = modelInputs.zincLoanTenureYears;

  // Cash future value
  const cashNeeded = results.fundingGap;
  const cashFV = calculateFutureValue(cashNeeded, modelInputs.assets.cash.cagrPct, years);

  // Land future value
  const landGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
  const landFV = calculateFutureValue(landGrossSale, modelInputs.assets.land.cagrPct, years);

  // Equity future value
  const equityGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
  const equityFV = calculateFutureValue(equityGrossSale, modelInputs.assets.indianEquity.cagrPct, years);

  // RSU future value (for Sell RSU section)
  const rsuGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
  const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
  const rsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);

  // Zinc net position (RSU growth minus EMI payments) - "what you're left with"
  const zincRate = deriveZincLoanRate(modelInputs.selectedHomeLoanRatePct);
  const zincEmi = calculateEmi(results.fundingGap, zincRate, years);
  const zincTotalPayments = zincEmi * 12 * years;
  const zincPaymentsFV = calculateFutureValue(zincTotalPayments, modelInputs.zincPaymentReinvestmentCagrPct, years / 2);
  const zincNetPosition = rsuFV - zincPaymentsFV;

  // Update amounts with absolute future values
  document.getElementById('zinc-amount').textContent = formatCrSigned(zincNetPosition);
  document.getElementById('cash-amount').textContent = formatCrSigned(-cashFV);
  document.getElementById('land-amount').textContent = formatCrSigned(-landFV);
  document.getElementById('equity-amount').textContent = formatCrSigned(-equityFV);
  document.getElementById('rsu-amount').textContent = formatCrSigned(-rsuFV);

  // Calculate bar heights based on absolute values (max 130px)
  const maxBarHeight = 130;
  const allFVs = [cashFV, landFV, equityFV, rsuFV];
  const maxFV = Math.max(...allFVs);

  // Zinc bar height (positive, based on net position)
  const zincBarHeight = Math.max((zincNetPosition / maxFV) * maxBarHeight, 60);
  document.getElementById('zinc-bar').style.height = zincBarHeight + 'px';

  // Negative bars (proportional to their future value)
  const cashBarHeight = Math.max((cashFV / maxFV) * maxBarHeight, 40);
  const landBarHeight = Math.max((landFV / maxFV) * maxBarHeight, 40);
  const equityBarHeight = Math.max((equityFV / maxFV) * maxBarHeight, 40);
  const rsuBarHeight = Math.max((rsuFV / maxFV) * maxBarHeight, 40);

  document.getElementById('cash-bar').style.height = cashBarHeight + 'px';
  document.getElementById('land-bar').style.height = landBarHeight + 'px';
  document.getElementById('equity-bar').style.height = equityBarHeight + 'px';
  document.getElementById('rsu-bar').style.height = rsuBarHeight + 'px';

  // Update chart tooltips
  updateChartTooltips(results);
}

function updateChartTooltips(results) {
  const years = modelInputs.zincLoanTenureYears;
  const fundingGap = results.fundingGap;

  // Calculate Zinc loan values (amortizing)
  const rsuGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
  const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
  const zincRate = deriveZincLoanRate(modelInputs.selectedHomeLoanRatePct);
  const zincEmi = calculateEmi(fundingGap, zincRate, years);
  const zincTotalPayments = zincEmi * 12 * years;
  const zincTotalInterest = zincTotalPayments - fundingGap;
  const zincPaymentsFV = calculateFutureValue(zincTotalPayments, modelInputs.zincPaymentReinvestmentCagrPct, years / 2);
  const retainedRsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  const zincBurden = zincPaymentsFV;
  const zincNetPosition = retainedRsuFV - zincBurden;

  // Cash values
  const cashFV = calculateFutureValue(fundingGap, modelInputs.assets.cash.cagrPct, years);
  const cashBenefit = zincNetPosition - (cashFV - fundingGap);

  // Land values
  const landGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
  const landFV = calculateFutureValue(landGrossSale, modelInputs.assets.land.cagrPct, years);
  const landCost = landFV - zincNetPosition;

  // Equity values
  const equityGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
  const equityFV = calculateFutureValue(equityGrossSale, modelInputs.assets.indianEquity.cagrPct, years);
  const equityCost = equityFV - zincNetPosition;

  // RSU sell values
  const rsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  const rsuCost = rsuFV - zincNetPosition;

  // Simple tooltips - just "click to know more"
  document.getElementById('tooltip-use-cash').innerHTML = `Click to know more`;
  document.getElementById('tooltip-sell-land').innerHTML = `Click to know more`;
  document.getElementById('tooltip-sell-indian-equity').innerHTML = `Click to know more`;
  document.getElementById('tooltip-sell-rsus').innerHTML = `Click to know more`;
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
  let embeddedGainPct = 0;
  let taxRate = 0;
  let exemption = 0;

  if (strategyId === 'zinc-loan') {
    title = "What if you use Zinc loan?";
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
    description = "Using your cash means no debt, but you lose out on potential investment returns if that money was invested instead.";
    valueToday = fundingGap;
    valueFuture = calculateFutureValue(fundingGap, modelInputs.assets.cash.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.cash.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with using cash";
    problemText = `By using cash worth <span class="highlight">${formatCurrency(valueToday)}</span>, you lose the opportunity to invest it and watch it grow to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.`;
  } else if (strategyId === 'sell-land') {
    title = "What if you sell land to cover the funding gap?";
    description = "Selling land involves capital gains tax on your profits, plus you miss out on future appreciation.";
    embeddedGainPct = modelInputs.assets.land.embeddedGainPct;
    taxRate = modelInputs.assets.land.ltcgTaxRatePct;
    exemption = modelInputs.assets.land.exemptionAmount;
    valueToday = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
    valueFuture = calculateFutureValue(valueToday, modelInputs.assets.land.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.land.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with selling land";
    problemText = `By selling land worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay 12.5% LTCG tax and lose the opportunity to see it grow to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.`;
  } else if (strategyId === 'sell-indian-equity') {
    title = "What if you sell equities to cover the funding gap?";
    description = "Selling stocks means paying capital gains tax and missing future growth. There's a ₹1.25 lakh exemption on LTCG.";
    embeddedGainPct = modelInputs.assets.indianEquity.embeddedGainPct;
    taxRate = modelInputs.assets.indianEquity.ltcgTaxRatePct;
    exemption = modelInputs.assets.indianEquity.exemptionAmount;
    valueToday = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
    valueFuture = calculateFutureValue(valueToday, modelInputs.assets.indianEquity.cagrPct, years);
    growth = valueFuture - valueToday;
    growthRate = (modelInputs.assets.indianEquity.cagrPct * 100).toFixed(0);
    problemTitle = "The problem with selling equities";
    problemText = `By selling equities worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay LTCG tax and miss potential growth to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.`;
  } else if (strategyId === 'sell-rsus') {
    title = "What if you sell RSUs to cover the funding gap?";
    description = "Selling foreign RSUs triggers capital gains tax with no exemption, plus you miss stock growth and rupee depreciation benefits.";
    embeddedGainPct = modelInputs.assets.foreignRsu.embeddedGainPct;
    taxRate = modelInputs.assets.foreignRsu.ltcgTaxRatePct;
    exemption = modelInputs.assets.foreignRsu.exemptionAmount;
    valueToday = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
    const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    valueFuture = calculateFutureValue(valueToday, effectiveRsuCagr, years);
    growth = valueFuture - valueToday;
    growthRate = ((modelInputs.assets.foreignRsu.usdCagrPct + modelInputs.assets.foreignRsu.inrDepreciationPct) * 100).toFixed(0);
    problemTitle = "The problem with selling RSUs";
    problemText = `By selling RSUs worth <span class="highlight">${formatCurrency(valueToday)}</span>, you pay 12.5% LTCG with no exemption and miss potential growth to <span class="highlight-red">${formatCurrency(valueFuture)}</span> over <strong>${years} years</strong>.`;
  }

  // Calculate tax breakdown for sell strategies
  const embeddedGain = valueToday * embeddedGainPct;
  const taxableGain = Math.max(0, embeddedGain - exemption);
  const taxAmount = taxableGain * taxRate;
  const netProceeds = valueToday - taxAmount;

  // Contextual labels for "How we calculated this" section
  let assetLabelToday = 'Cash needed today';
  let investedLabel = `If invested at ${growthRate}% for ${years} years`;
  let cagrTooltip = '';

  if (strategyId === 'zinc-loan') {
    assetLabelToday = 'RSUs to pledge today';
    investedLabel = `If you let those RSUs remain invested for ${years} years`;
    cagrTooltip = `${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}% stock CAGR + ${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}% INR depreciation`;
  } else if (strategyId === 'use-cash') {
    assetLabelToday = 'Cash to use today';
    investedLabel = `If you let that cash remain invested for ${years} years`;
    cagrTooltip = `${growthRate}% CAGR in a safe debt fund`;
  } else if (strategyId === 'sell-land') {
    assetLabelToday = 'Land to sell today';
    investedLabel = `If you let that land appreciate for ${years} years`;
    cagrTooltip = `${growthRate}% annual land appreciation`;
  } else if (strategyId === 'sell-indian-equity') {
    assetLabelToday = 'Equities to sell today';
    investedLabel = `If you let those equities grow for ${years} years`;
    cagrTooltip = `${growthRate}% CAGR in Indian equities`;
  } else if (strategyId === 'sell-rsus') {
    assetLabelToday = 'RSUs to sell today';
    investedLabel = `If you let those RSUs remain invested for ${years} years`;
    cagrTooltip = `${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}% stock CAGR + ${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}% INR depreciation`;
  }

  // Get CAGR for current strategy
  let currentCagr = 0;
  let cagrKey = '';
  if (strategyId === 'zinc-loan' || strategyId === 'sell-rsus') {
    currentCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    cagrKey = 'foreignRsu';
  } else if (strategyId === 'use-cash') {
    currentCagr = modelInputs.assets.cash.cagrPct;
    cagrKey = 'cash';
  } else if (strategyId === 'sell-land') {
    currentCagr = modelInputs.assets.land.cagrPct;
    cagrKey = 'land';
  } else if (strategyId === 'sell-indian-equity') {
    currentCagr = modelInputs.assets.indianEquity.cagrPct;
    cagrKey = 'indianEquity';
  }

  const content = `
    <div class="detail-modal-container">
      <div class="detail-header">
        <h2 class="detail-modal-title">${title}</h2>
        <p class="detail-description">${description}</p>
      </div>

      <div class="detail-sections">
        <div class="detail-group">
          <h3 class="group-heading">Your home loan</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Interest rate <button class="edit-btn" data-field="homeLoanRate" data-value="${(modelInputs.selectedHomeLoanRatePct * 100).toFixed(1)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.selectedHomeLoanRatePct * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Tenure <button class="edit-btn" data-field="homeLoanTenure" data-value="${modelInputs.homeLoanTenureYears}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${modelInputs.homeLoanTenureYears} years</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">LTV <button class="edit-btn" data-field="homeLoanLtv" data-value="${(modelInputs.homeLoanLtvPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.homeLoanLtvPct * 100).toFixed(0)}%</span>
            </div>
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
          <h3 class="group-heading">Your funding gap</h3>
          <p class="group-description">Cash you need upfront to complete the purchase.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Down payment (${(100 - modelInputs.homeLoanLtvPct * 100).toFixed(0)}%)</span>
              <span class="detail-value">${formatCurrency(results.downPayment)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Stamp duty & registration</span>
              <span class="detail-value">${formatCurrency(results.transactionDuty)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Interior budget <button class="edit-btn" data-field="interiorsPct" data-value="${(modelInputs.interiorsPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${formatCurrency(results.interiors)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Total funding gap</strong></span>
              <span class="detail-value"><strong>${formatCurrency(fundingGap)}</strong></span>
            </div>
          </div>
        </div>

        ${strategyId !== 'zinc-loan' && strategyId !== 'use-cash' ? `
        <div class="detail-group">
          <h3 class="group-heading">Assets to sell</h3>
          <p class="group-description">Due to ${(embeddedGainPct * 100).toFixed(0)}% embedded gains and ${(taxRate * 100).toFixed(1)}% LTCG tax, you need to sell more than the funding gap.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Funding gap</span>
              <span class="detail-value">${formatCurrency(fundingGap)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">LTCG tax${exemption > 0 ? ` (after ₹${(exemption/100000).toFixed(2)}L exemption)` : ''}</span>
              <span class="detail-value detail-value-red">+ ${formatCurrency(taxAmount)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Gross asset to sell</strong></span>
              <span class="detail-value"><strong>${formatCurrency(valueToday)}</strong></span>
            </div>
          </div>
        </div>
        ` : ''}

        <div class="detail-group">
          <h3 class="group-heading">Financial impact</h3>
          <p class="group-description">What this ${strategyId === 'use-cash' ? 'cash' : 'asset'} could grow to if you kept it invested.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">${assetLabelToday}</span>
              <span class="detail-value">${formatCurrency(valueToday)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">${investedLabel} <span class="info-icon" title="${cagrTooltip}">i</span></span>
              <span class="detail-value ${isPositive ? 'detail-value-green' : 'detail-value-red'}">${formatCurrency(valueFuture)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value ${isPositive ? 'detail-value-green' : 'detail-value-red'}"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Other assumptions</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Analysis horizon <button class="edit-btn" data-field="analysisHorizon" data-value="${years}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${years} years</span>
            </div>
            ${strategyId === 'use-cash' ? `
            <div class="detail-row">
              <span class="detail-label">Cash investment CAGR <button class="edit-btn" data-field="cashCagr" data-value="${(modelInputs.assets.cash.cagrPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.cash.cagrPct * 100).toFixed(0)}%</span>
            </div>
            ` : ''}
            ${strategyId === 'sell-land' ? `
            <div class="detail-row">
              <span class="detail-label">Land appreciation CAGR <button class="edit-btn" data-field="landCagr" data-value="${(modelInputs.assets.land.cagrPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.land.cagrPct * 100).toFixed(0)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Embedded gain % <button class="edit-btn" data-field="landEmbeddedGain" data-value="${(modelInputs.assets.land.embeddedGainPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.land.embeddedGainPct * 100).toFixed(0)}%</span>
            </div>
            ` : ''}
            ${strategyId === 'sell-indian-equity' ? `
            <div class="detail-row">
              <span class="detail-label">Equity CAGR <button class="edit-btn" data-field="equityCagr" data-value="${(modelInputs.assets.indianEquity.cagrPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.indianEquity.cagrPct * 100).toFixed(0)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Embedded gain % <button class="edit-btn" data-field="equityEmbeddedGain" data-value="${(modelInputs.assets.indianEquity.embeddedGainPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.indianEquity.embeddedGainPct * 100).toFixed(0)}%</span>
            </div>
            ` : ''}
            ${strategyId === 'sell-rsus' || strategyId === 'zinc-loan' ? `
            <div class="detail-row">
              <span class="detail-label">RSU stock CAGR (USD) <button class="edit-btn" data-field="rsuCagr" data-value="${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">INR depreciation <button class="edit-btn" data-field="inrDepreciation" data-value="${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Embedded gain % <button class="edit-btn" data-field="rsuEmbeddedGain" data-value="${(modelInputs.assets.foreignRsu.embeddedGainPct * 100).toFixed(0)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button></span>
              <span class="detail-value">${(modelInputs.assets.foreignRsu.embeddedGainPct * 100).toFixed(0)}%</span>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('detail-modal-content').innerHTML = content;
  document.getElementById('detail-modal').classList.add('visible');
}

const detailModal = document.getElementById('detail-modal');

// Show calculation explanation popup for chart section
function showChartCalculation(strategyId) {
  const results = calculateModel(modelInputs);
  const years = modelInputs.zincLoanTenureYears;
  const fundingGap = results.fundingGap;

  const rsuGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
  const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
  const zincRate = deriveZincLoanRate(modelInputs.selectedHomeLoanRatePct);
  // Amortizing loan calculation
  const zincEmi = calculateEmi(fundingGap, zincRate, years);
  const zincTotalPayments = zincEmi * 12 * years;
  const zincTotalInterest = zincTotalPayments - fundingGap;
  const zincPaymentsFV = calculateFutureValue(zincTotalPayments, modelInputs.zincPaymentReinvestmentCagrPct, years / 2);
  const retainedRsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  const zincBurden = zincPaymentsFV;
  const zincNetBenefit = retainedRsuFV - zincBurden;

  const cashStrategy = results.strategies.find(s => s.strategyId === 'use-cash');
  const zincStrategy = results.strategies.find(s => s.strategyId === 'zinc-loan');
  const benefitVsCash = cashStrategy.impact - zincStrategy.impact;

  let content = '';

  if (strategyId === 'zinc-loan') {
    content = `
    <div class="detail-modal-container">
      <div class="detail-header">
        <h2 class="detail-modal-title">How Zinc Loan Works</h2>
        <p class="detail-description">Zinc loan lets you borrow against your vested RSUs without selling them. You pay EMIs while your RSUs continue to grow.</p>
      </div>

      <div class="detail-sections">
        <div class="detail-group">
          <h3 class="group-heading">Step 1: Your funding gap</h3>
          <p class="group-description">This is the upfront cash you need to buy your home (down payment + stamp duty + interiors).</p>
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
              <span class="detail-label"><strong>Funding gap (Zinc loan amount)</strong></span>
              <span class="detail-value"><strong>${formatCurrency(fundingGap)}</strong></span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Step 2: What you pay over ${years} years</h3>
          <p class="group-description">With Zinc, you pay monthly EMIs (principal + interest) over ${years} years.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Zinc interest rate <span class="info-icon" title="Home loan rate + 2%">i</span></span>
              <span class="detail-value">${(zincRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Monthly EMI</span>
              <span class="detail-value">${formatCurrency(zincEmi)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total interest over ${years} years</span>
              <span class="detail-value">${formatCurrency(zincTotalInterest)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total payments (EMI × ${years * 12} months)</span>
              <span class="detail-value">${formatCurrency(zincTotalPayments)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Future value of payments <span class="info-icon" title="If you invested the EMI payments at ${(modelInputs.zincPaymentReinvestmentCagrPct * 100).toFixed(0)}% for ${years/2} years (average)">i</span></span>
              <span class="detail-value">${formatCurrency(zincPaymentsFV)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Total cost (burden)</strong></span>
              <span class="detail-value"><strong>${formatCurrency(zincBurden)}</strong></span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Step 3: What you gain</h3>
          <p class="group-description">Your RSUs remain invested and grow over ${years} years with stock appreciation + INR depreciation.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">RSUs pledged today</span>
              <span class="detail-value">${formatCurrency(rsuGrossSale)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expected CAGR <span class="info-icon" title="${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}% stock growth + ${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}% INR depreciation">i</span></span>
              <span class="detail-value">${(effectiveRsuCagr * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>RSU value after ${years} years</strong></span>
              <span class="detail-value detail-value-green"><strong>${formatCurrency(retainedRsuFV)}</strong></span>
            </div>
          </div>
        </div>

        <div class="detail-group">
          <h3 class="group-heading">Net benefit calculation</h3>
          <p class="group-description">Your RSU growth minus the total cost of the Zinc loan.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">RSU value after ${years} years</span>
              <span class="detail-value detail-value-green">${formatCurrency(retainedRsuFV)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Less: Total cost (burden)</span>
              <span class="detail-value">- ${formatCurrency(zincBurden)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Net position</strong></span>
              <span class="detail-value ${zincNetBenefit >= 0 ? 'detail-value-green' : 'detail-value-red'}"><strong>${formatCurrency(zincNetBenefit)}</strong></span>
            </div>
          </div>
        </div>

        <div class="detail-group highlight-group">
          <h3 class="group-heading">How Zinc gives you +${formatCr(zincNetBenefit)} benefit</h3>
          <p class="group-description">With Zinc, you pledge RSUs instead of selling assets. Here's how it works out:</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">RSUs pledged (worth today)</span>
              <span class="detail-value">${formatCurrency(rsuGrossSale)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">RSUs grow to (in ${years} years)</span>
              <span class="detail-value detail-value-green">${formatCurrency(retainedRsuFV)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">You pay EMIs over ${years} years (FV)</span>
              <span class="detail-value">- ${formatCurrency(zincBurden)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>You're left with</strong></span>
              <span class="detail-value detail-value-green"><strong>${formatCurrency(retainedRsuFV - zincBurden)}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
    `;
  } else {
    // For other strategies, show opportunity cost calculation
    let strategyName = '';
    let assetValue = 0;
    let futureValue = 0;
    let growthRate = 0;
    let taxInfo = '';
    let embeddedGainPct = 0;
    let taxRate = 0;
    let exemption = 0;
    const strategy = results.strategies.find(s => s.strategyId === strategyId);
    const opportunityCost = strategy.impact - zincStrategy.impact;

    if (strategyId === 'use-cash') {
      strategyName = 'Using Cash';
      assetValue = fundingGap;
      growthRate = modelInputs.assets.cash.cagrPct;
      futureValue = calculateFutureValue(assetValue, growthRate, years);
      taxInfo = 'No tax implications, but you lose potential investment returns.';
      embeddedGainPct = 0;
      taxRate = 0;
      exemption = 0;
    } else if (strategyId === 'sell-land') {
      strategyName = 'Selling Land';
      embeddedGainPct = modelInputs.assets.land.embeddedGainPct;
      taxRate = modelInputs.assets.land.ltcgTaxRatePct;
      exemption = modelInputs.assets.land.exemptionAmount;
      assetValue = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
      growthRate = modelInputs.assets.land.cagrPct;
      futureValue = calculateFutureValue(assetValue, growthRate, years);
      taxInfo = '12.5% LTCG tax on gains above ₹1.25L exemption.';
    } else if (strategyId === 'sell-indian-equity') {
      strategyName = 'Selling Equities';
      embeddedGainPct = modelInputs.assets.indianEquity.embeddedGainPct;
      taxRate = modelInputs.assets.indianEquity.ltcgTaxRatePct;
      exemption = modelInputs.assets.indianEquity.exemptionAmount;
      assetValue = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
      growthRate = modelInputs.assets.indianEquity.cagrPct;
      futureValue = calculateFutureValue(assetValue, growthRate, years);
      taxInfo = '12.5% LTCG tax on gains above ₹1.25L exemption.';
    } else if (strategyId === 'sell-rsus') {
      strategyName = 'Selling RSUs';
      embeddedGainPct = modelInputs.assets.foreignRsu.embeddedGainPct;
      taxRate = modelInputs.assets.foreignRsu.ltcgTaxRatePct;
      exemption = modelInputs.assets.foreignRsu.exemptionAmount;
      assetValue = calculateGrossSaleRequired(fundingGap, embeddedGainPct, taxRate, exemption);
      growthRate = effectiveRsuCagr;
      futureValue = calculateFutureValue(assetValue, growthRate, years);
      taxInfo = '12.5% LTCG tax with NO exemption for foreign assets.';
    }

    const growth = futureValue - assetValue;
    const embeddedGain = assetValue * embeddedGainPct;
    const taxableGain = Math.max(0, embeddedGain - exemption);
    const taxAmount = taxableGain * taxRate;
    const netProceeds = assetValue - taxAmount;

    // Build tax breakdown rows - simplified to show only what adds up
    let taxBreakdownRows = '';
    if (strategyId !== 'use-cash') {
      taxBreakdownRows = `
            <div class="detail-row">
              <span class="detail-label">LTCG tax @ ${(taxRate * 100).toFixed(1)}%${exemption > 0 ? ` (after ₹${(exemption/100000).toFixed(2)}L exemption)` : ''} on ${(embeddedGainPct * 100).toFixed(0)}% embedded gain</span>
              <span class="detail-value detail-value-red">+ ${formatCurrency(taxAmount)}</span>
            </div>
      `;
    }

    // Build the first section based on whether it's cash or selling assets
    let firstSection = '';
    if (strategyId === 'use-cash') {
      firstSection = `
        <div class="detail-group">
          <h3 class="group-heading">Your cash</h3>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Cash you'd need</span>
              <span class="detail-value">${formatCurrency(fundingGap)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      firstSection = `
        <div class="detail-group">
          <h3 class="group-heading">What you'd need to sell</h3>
          <p class="group-description">To get ${formatCurrency(fundingGap)} after taxes, you need to sell more.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Funding gap</span>
              <span class="detail-value">${formatCurrency(fundingGap)}</span>
            </div>
            ${taxBreakdownRows}
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Gross asset value to sell</strong></span>
              <span class="detail-value"><strong>${formatCurrency(assetValue)}</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    // Build the opportunity cost section with edit buttons
    const editIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    let opportunityCostSection = '';
    if (strategyId === 'use-cash') {
      opportunityCostSection = `
        <div class="detail-group">
          <h3 class="group-heading">Financial impact over ${years} years</h3>
          <p class="group-description group-description-italic">Let's see what if you kept this cash invested instead of using it</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Cash value today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expected growth rate <button class="edit-btn" data-field="cashCagr" data-value="${(modelInputs.assets.cash.cagrPct * 100).toFixed(0)}">${editIcon}</button></span>
              <span class="detail-value">${(growthRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Value after ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-land') {
      opportunityCostSection = `
        <div class="detail-group">
          <h3 class="group-heading">Financial impact over ${years} years</h3>
          <p class="group-description group-description-italic">Let's see what if you kept this asset invested instead of selling it</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Asset value today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expected growth rate <button class="edit-btn" data-field="landCagr" data-value="${(modelInputs.assets.land.cagrPct * 100).toFixed(0)}">${editIcon}</button></span>
              <span class="detail-value">${(growthRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Value after ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-indian-equity') {
      opportunityCostSection = `
        <div class="detail-group">
          <h3 class="group-heading">Financial impact over ${years} years</h3>
          <p class="group-description group-description-italic">Let's see what if you kept this asset invested instead of selling it</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Asset value today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expected growth rate <button class="edit-btn" data-field="equityCagr" data-value="${(modelInputs.assets.indianEquity.cagrPct * 100).toFixed(0)}">${editIcon}</button></span>
              <span class="detail-value">${(growthRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Value after ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-rsus') {
      opportunityCostSection = `
        <div class="detail-group">
          <h3 class="group-heading">Financial impact over ${years} years</h3>
          <p class="group-description group-description-italic">Let's see what if you kept this asset invested instead of selling it</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Asset value today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">RSU stock CAGR (USD) <button class="edit-btn" data-field="rsuCagr" data-value="${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}">${editIcon}</button></span>
              <span class="detail-value">${(modelInputs.assets.foreignRsu.usdCagrPct * 100).toFixed(0)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">INR depreciation <button class="edit-btn" data-field="inrDepreciation" data-value="${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}">${editIcon}</button></span>
              <span class="detail-value">${(modelInputs.assets.foreignRsu.inrDepreciationPct * 100).toFixed(1)}%</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Effective CAGR (INR)</span>
              <span class="detail-value">${(growthRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Value after ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else {
      opportunityCostSection = `
        <div class="detail-group">
          <h3 class="group-heading">Financial impact over ${years} years</h3>
          <p class="group-description group-description-italic">Let's see what if you kept this asset invested instead of selling it</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Asset value today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Expected growth rate</span>
              <span class="detail-value">${(growthRate * 100).toFixed(1)}% p.a.</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Value after ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    // Build contextual summary section based on strategy
    // Show the absolute future value that would be lost
    let summarySection = '';

    if (strategyId === 'use-cash') {
      // For cash: show how using cash depletes your cash
      summarySection = `
        <div class="detail-group highlight-group negative">
          <h3 class="group-heading">Value lost after ${years} years: ${formatCr(futureValue)}</h3>
          <p class="group-description">By using your cash, you lose out on potential investment returns.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Cash used today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">If invested at ${(growthRate * 100).toFixed(0)}% for ${years} years</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-land') {
      // For land: show lost appreciation + tax
      summarySection = `
        <div class="detail-group highlight-group negative">
          <h3 class="group-heading">Value lost after ${years} years: ${formatCr(futureValue)}</h3>
          <p class="group-description">You pay LTCG tax and lose future appreciation on your land.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Land sold today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">If kept for ${years} years (at ${(growthRate * 100).toFixed(0)}% p.a.)</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-indian-equity') {
      // For equities: show lost market gains + tax
      summarySection = `
        <div class="detail-group highlight-group negative">
          <h3 class="group-heading">Value lost after ${years} years: ${formatCr(futureValue)}</h3>
          <p class="group-description">You pay LTCG tax and miss out on future market gains.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">Equities sold today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">If held for ${years} years (at ${(growthRate * 100).toFixed(0)}% p.a.)</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    } else if (strategyId === 'sell-rsus') {
      // For RSUs: show lost stock growth + forex gains + tax
      summarySection = `
        <div class="detail-group highlight-group negative">
          <h3 class="group-heading">Value lost after ${years} years: ${formatCr(futureValue)}</h3>
          <p class="group-description">You pay LTCG tax (no exemption) and miss stock + forex gains.</p>
          <div class="detail-rows">
            <div class="detail-row">
              <span class="detail-label">RSUs sold today</span>
              <span class="detail-value">${formatCurrency(assetValue)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">If held for ${years} years (stock + INR depreciation)</span>
              <span class="detail-value">${formatCurrency(futureValue)}</span>
            </div>
            <div class="detail-row detail-row-total">
              <span class="detail-label"><strong>Growth you'd miss</strong></span>
              <span class="detail-value detail-value-red"><strong>${formatCurrency(growth)}</strong></span>
            </div>
          </div>
        </div>
      `;
    }

    content = `
    <div class="detail-modal-container">
      <div class="detail-header">
        <h2 class="detail-modal-title">${strategyName}: Value after ${years} years</h2>
        <p class="detail-description">${taxInfo}</p>
      </div>

      <div class="detail-sections">
        ${firstSection}

        ${opportunityCostSection}

        ${summarySection}
      </div>
    </div>
    `;
  }

  document.getElementById('detail-modal-content').innerHTML = content;
  document.getElementById('detail-modal').classList.add('visible');
}

// Add click handlers to chart columns
document.querySelectorAll('.chart-column').forEach(column => {
  column.style.cursor = 'pointer';
  column.addEventListener('click', () => {
    const option = column.getAttribute('data-option');
    showChartCalculation(option);
  });
});

// Animate bars function
let barsAnimated = false;
function animateBars() {
  if (barsAnimated) return;
  barsAnimated = true;
  document.querySelectorAll('.chart-section .bar').forEach(bar => {
    bar.classList.add('animate');
  });
  document.querySelectorAll('.chart-section .bar-label').forEach(label => {
    label.classList.add('animate');
  });
}

// Draw modal growth curve (smaller version for modals)
function drawModalGrowthCurve(canvasId) {
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
  const paddingRight = 30;
  const paddingBottom = 5;
  const paddingTop = 20;

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

// Event listeners for columns - handled by showChartCalculation above

document.getElementById('detail-modal-close').addEventListener('click', () => {
  document.getElementById('detail-modal').classList.remove('visible');
});

document.getElementById('detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'detail-modal') {
    document.getElementById('detail-modal').classList.remove('visible');
  }
});

// Learn more buttons
document.querySelectorAll('.learn-more-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const optionId = btn.dataset.option;
    showOptionDetails(optionId);
  });
});

// Edit modal functionality
const editModal = document.getElementById('edit-modal');
const editModalInput = document.getElementById('edit-modal-input');
const editModalTitle = document.getElementById('edit-modal-title');
const editModalUnit = document.getElementById('edit-modal-unit');
let currentEditField = null;
let currentStrategyId = null;

const fieldConfig = {
  propertyValue: { title: 'Property Cost', unit: '₹', min: 100000, max: 100000000, step: 100000, isPropertyValue: true },
  homeLoanRate: { title: 'Home Loan Interest Rate', unit: '%', min: 5, max: 15, step: 0.1 },
  homeLoanTenure: { title: 'Home Loan Tenure', unit: 'years', min: 5, max: 30, step: 1 },
  homeLoanLtv: { title: 'Loan-to-Value (LTV)', unit: '%', min: 50, max: 90, step: 5 },
  interiorsPct: { title: 'Interior Budget', unit: '% of property', min: 0, max: 50, step: 5 },
  analysisHorizon: { title: 'Analysis Horizon', unit: 'years', min: 5, max: 20, step: 1 },
  cashCagr: { title: 'Cash Investment CAGR', unit: '%', min: 3, max: 12, step: 1 },
  landCagr: { title: 'Land Appreciation CAGR', unit: '%', min: 3, max: 15, step: 1 },
  landEmbeddedGain: { title: 'Land Embedded Gain', unit: '%', min: 0, max: 90, step: 5 },
  equityCagr: { title: 'Equity CAGR', unit: '%', min: 5, max: 20, step: 1 },
  equityEmbeddedGain: { title: 'Equity Embedded Gain', unit: '%', min: 0, max: 90, step: 5 },
  rsuCagr: { title: 'RSU Stock CAGR (USD)', unit: '%', min: 5, max: 25, step: 1 },
  inrDepreciation: { title: 'INR Depreciation', unit: '%', min: 0, max: 5, step: 0.5 },
  rsuEmbeddedGain: { title: 'RSU Embedded Gain', unit: '%', min: 0, max: 90, step: 5 },
};

function formatIndianNumber(num) {
  const str = num.toString();
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
  return parseInt(str.replace(/,/g, ''), 10) || 0;
}

function openEditModal(field, value, strategyId) {
  const config = fieldConfig[field];
  if (!config) return;

  currentEditField = field;
  currentStrategyId = strategyId;
  editModalTitle.textContent = config.title;

  const prefixEl = document.getElementById('edit-modal-prefix');

  if (config.isPropertyValue) {
    editModalInput.type = 'text';
    editModalInput.value = formatIndianNumber(Math.round(value));
    editModalInput.removeAttribute('min');
    editModalInput.removeAttribute('max');
    editModalInput.removeAttribute('step');
    prefixEl.textContent = '₹';
    editModalUnit.textContent = '';
  } else {
    editModalInput.type = 'number';
    editModalInput.value = value;
    editModalInput.min = config.min;
    editModalInput.max = config.max;
    editModalInput.step = config.step;
    prefixEl.textContent = '';
    editModalUnit.textContent = config.unit;
  }

  editModal.classList.add('visible');
  editModalInput.focus();
  editModalInput.select();
}

function closeEditModal() {
  editModal.classList.remove('visible');
  currentEditField = null;
}

function saveEditValue() {
  if (!currentEditField) return;

  const value = parseFloat(editModalInput.value);
  if (isNaN(value)) {
    closeEditModal();
    return;
  }

  // Handle property value specially (text input with Indian formatting)
  if (currentEditField === 'propertyValue') {
    const newPropertyPrice = parseIndianNumber(editModalInput.value);
    if (newPropertyPrice >= 100000 && newPropertyPrice <= 100000000) {
      modelInputs.propertyPrice = newPropertyPrice;
      localStorage.setItem('houseValue', newPropertyPrice);
      updatePropertyValuePill();
    }
    closeEditModal();
    updateUI();
    updateOptionSections();
    return;
  }

  switch (currentEditField) {
    case 'homeLoanRate':
      modelInputs.selectedHomeLoanRatePct = value / 100;
      break;
    case 'homeLoanTenure':
      modelInputs.homeLoanTenureYears = value;
      break;
    case 'homeLoanLtv':
      modelInputs.homeLoanLtvPct = value / 100;
      break;
    case 'interiorsPct':
      modelInputs.interiorsPct = value / 100;
      break;
    case 'analysisHorizon':
      modelInputs.zincLoanTenureYears = value;
      break;
    case 'cashCagr':
      modelInputs.assets.cash.cagrPct = value / 100;
      break;
    case 'landCagr':
      modelInputs.assets.land.cagrPct = value / 100;
      break;
    case 'landEmbeddedGain':
      modelInputs.assets.land.embeddedGainPct = value / 100;
      break;
    case 'equityCagr':
      modelInputs.assets.indianEquity.cagrPct = value / 100;
      break;
    case 'equityEmbeddedGain':
      modelInputs.assets.indianEquity.embeddedGainPct = value / 100;
      break;
    case 'rsuCagr':
      modelInputs.assets.foreignRsu.usdCagrPct = value / 100;
      break;
    case 'inrDepreciation':
      modelInputs.assets.foreignRsu.inrDepreciationPct = value / 100;
      break;
    case 'rsuEmbeddedGain':
      modelInputs.assets.foreignRsu.embeddedGainPct = value / 100;
      break;
  }

  closeEditModal();
  updateUI();
  updateOptionSections();

  // Refresh the current popup
  if (currentStrategyId) {
    showOptionDetails(currentStrategyId);
  }
}

document.getElementById('edit-modal-save').addEventListener('click', saveEditValue);
document.getElementById('edit-modal-cancel').addEventListener('click', closeEditModal);

editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

editModalInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    saveEditValue();
  } else if (e.key === 'Escape') {
    closeEditModal();
  }
});

// Delegate edit button clicks from detail modal
document.getElementById('detail-modal-content').addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) {
    const field = editBtn.dataset.field;
    const value = editBtn.dataset.value;
    const strategyId = document.querySelector('.detail-modal-container')?.closest('#detail-modal-content')?.dataset.strategyId ||
                       document.querySelector('.learn-more-btn.active')?.dataset.option;

    // Get strategyId from the current popup context
    const detailModalContent = document.getElementById('detail-modal-content');
    const title = detailModalContent.querySelector('.detail-modal-title')?.textContent || '';
    let activeStrategyId = 'zinc-loan';
    if (title.includes('cash')) activeStrategyId = 'use-cash';
    else if (title.includes('land')) activeStrategyId = 'sell-land';
    else if (title.includes('equities')) activeStrategyId = 'sell-indian-equity';
    else if (title.includes('RSUs') && !title.includes('Zinc')) activeStrategyId = 'sell-rsus';

    openEditModal(field, value, activeStrategyId);
  }
});

// Use Intersection Observer to trigger animation when scrolled into view
const chartSection = document.querySelector('.chart-section');

if (chartSection && scrollContainer) {
  const chartObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(animateBars, 300);
        chartObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.5,
    root: scrollContainer
  });

  chartObserver.observe(chartSection);
}

// ============================================
// Comparison Chart (RSU Growth vs Zinc Burden)
// ============================================
let selectedComparisonAsset = 'rsu';
let comparisonChartInitialized = false;

function drawComparisonChart(animate = false) {
  const canvas = document.getElementById('comparison-chart-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const container = canvas.parentElement;
  const tooltip = document.getElementById('comparison-chart-tooltip');

  // Set canvas size
  const dpr = window.devicePixelRatio || 1;
  const rect = container.getBoundingClientRect();
  canvas.width = (rect.width - 48) * dpr;
  canvas.height = (rect.height - 48) * dpr;
  canvas.style.width = (rect.width - 48) + 'px';
  canvas.style.height = (rect.height - 48) + 'px';
  ctx.scale(dpr, dpr);

  const width = rect.width - 48;
  const height = rect.height - 48;
  const padding = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate data points
  const results = calculateModel(modelInputs);
  const years = modelInputs.zincLoanTenureYears;
  const fundingGap = results.fundingGap;

  // Get asset-specific parameters based on selection
  let assetGrossSale, effectiveCagr, assetLabel;
  if (selectedComparisonAsset === 'rsu') {
    assetGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
    effectiveCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    assetLabel = 'RSU';
  } else if (selectedComparisonAsset === 'stocks') {
    assetGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
    effectiveCagr = modelInputs.assets.indianEquity.cagrPct;
    assetLabel = 'Stock';
  } else if (selectedComparisonAsset === 'mutual-funds') {
    assetGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
    effectiveCagr = modelInputs.assets.indianEquity.cagrPct;
    assetLabel = 'Mutual Fund';
  } else if (selectedComparisonAsset === 'land') {
    assetGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
    effectiveCagr = modelInputs.assets.land.cagrPct;
    assetLabel = 'Land';
  } else if (selectedComparisonAsset === 'cash') {
    assetGrossSale = fundingGap; // No tax on cash
    effectiveCagr = modelInputs.assets.cash.cagrPct;
    assetLabel = 'Cash';
  } else {
    assetGrossSale = calculateGrossSaleRequired(fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
    effectiveCagr = modelInputs.assets.cash.cagrPct;
    assetLabel = 'Mutual Fund';
  }

  // Calculate tax amount
  const assetTax = assetGrossSale - fundingGap;

  // Update breakdown line
  const comparisonFundingGap = document.getElementById('comparison-funding-gap');
  const comparisonTax = document.getElementById('comparison-tax');
  const comparisonTotal = document.getElementById('comparison-total');
  const comparisonAssetType = document.getElementById('comparison-asset-type');
  const comparisonAssetType2 = document.getElementById('comparison-asset-type-2');

  if (comparisonFundingGap) comparisonFundingGap.textContent = formatCurrency(fundingGap);
  if (comparisonTax) comparisonTax.textContent = formatCurrency(assetTax);
  if (comparisonTotal) comparisonTotal.textContent = formatCurrency(assetGrossSale);

  // Handle pluralization and action text
  let assetLabelPlural, actionText;
  if (selectedComparisonAsset === 'cash') {
    assetLabelPlural = 'Cash';
    actionText = 'to use';
  } else if (selectedComparisonAsset === 'land') {
    assetLabelPlural = 'Land';
    actionText = 'to sell';
  } else {
    assetLabelPlural = assetLabel + 's';
    actionText = 'to sell';
  }

  if (comparisonAssetType) comparisonAssetType.textContent = assetLabelPlural;
  if (comparisonAssetType2) comparisonAssetType2.textContent = assetLabelPlural;
  const comparisonAction = document.getElementById('comparison-action');
  if (comparisonAction) comparisonAction.textContent = actionText;

  // Update legend label
  const legendLabel = document.getElementById('legend-asset-label');
  if (legendLabel) {
    legendLabel.textContent = `Retained ${assetLabel} future value`;
  }

  // Update tooltip labels
  const tooltipAssetLabel = document.getElementById('tooltip-asset-label');
  if (tooltipAssetLabel) {
    tooltipAssetLabel.textContent = `${assetLabel} value:`;
  }

  // Update growth percentage in tooltip
  const tooltipGrowthValue = document.getElementById('tooltip-growth-value');
  if (tooltipGrowthValue) {
    tooltipGrowthValue.textContent = `${(effectiveCagr * 100).toFixed(1)}%`;
  }

  const zincRate = deriveZincLoanRate(modelInputs.selectedHomeLoanRatePct);
  const zincEmi = calculateEmi(fundingGap, zincRate, years);

  // Generate data for each year
  const dataPoints = [];
  for (let year = 0; year <= years; year++) {
    const assetValue = calculateFutureValue(assetGrossSale, effectiveCagr, year);
    const totalPaidSoFar = zincEmi * 12 * year;
    const zincBurdenAtYear = calculateFutureValue(totalPaidSoFar, modelInputs.zincPaymentReinvestmentCagrPct, (years - year) / 2);
    dataPoints.push({ year, assetValue, zincBurden: zincBurdenAtYear });
  }

  // Find max value for scale
  const maxValue = Math.max(...dataPoints.map(d => Math.max(d.assetValue, d.zincBurden))) * 1.1;

  // Function to get coordinates
  function getCoords(year, value) {
    const x = padding.left + (chartWidth / years) * year;
    const y = padding.top + chartHeight - (value / maxValue) * chartHeight;
    return { x, y };
  }

  // Create gradients
  const assetGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
  assetGradient.addColorStop(0, 'rgba(255, 193, 92, 1)');
  assetGradient.addColorStop(1, 'rgba(1, 87, 60, 1)');

  const burdenGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
  burdenGradient.addColorStop(0, 'rgb(247, 147, 46)');
  burdenGradient.addColorStop(1, 'rgb(235, 39, 39)');

  // Draw static elements (grid, labels)
  function drawStatic() {
    ctx.clearRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw Y-axis labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '12px Satoshi, sans-serif';
    ctx.textAlign = 'right';
    for (let i = 0; i <= gridLines; i++) {
      const value = maxValue - (maxValue / gridLines) * i;
      const y = padding.top + (chartHeight / gridLines) * i;
      ctx.fillText(formatCr(value), padding.left - 10, y + 4);
    }

    // Draw X-axis labels
    ctx.textAlign = 'center';
    for (let year = 0; year <= years; year++) {
      const x = padding.left + (chartWidth / years) * year;
      ctx.fillText(year.toString(), x, height - padding.bottom + 25);
    }

    // X-axis title
    ctx.fillText('Years', width / 2, height - 5);
  }

  // Draw lines and dots up to a certain progress (0-1)
  function drawLines(progress) {
    drawStatic();

    const totalPoints = dataPoints.length;
    const pointsToDraw = Math.floor(progress * totalPoints);
    const partialProgress = (progress * totalPoints) - pointsToDraw;

    // Build arrays of points to draw for area fill
    const assetPoints = [];
    const burdenPoints = [];

    for (let i = 0; i <= pointsToDraw && i < totalPoints; i++) {
      const assetCoords = getCoords(dataPoints[i].year, dataPoints[i].assetValue);
      const burdenCoords = getCoords(dataPoints[i].year, dataPoints[i].zincBurden);

      if (i === pointsToDraw && i < totalPoints - 1 && partialProgress > 0) {
        const nextAssetCoords = getCoords(dataPoints[i + 1].year, dataPoints[i + 1].assetValue);
        const nextBurdenCoords = getCoords(dataPoints[i + 1].year, dataPoints[i + 1].zincBurden);
        assetPoints.push(assetCoords);
        assetPoints.push({
          x: assetCoords.x + (nextAssetCoords.x - assetCoords.x) * partialProgress,
          y: assetCoords.y + (nextAssetCoords.y - assetCoords.y) * partialProgress
        });
        burdenPoints.push(burdenCoords);
        burdenPoints.push({
          x: burdenCoords.x + (nextBurdenCoords.x - burdenCoords.x) * partialProgress,
          y: burdenCoords.y + (nextBurdenCoords.y - burdenCoords.y) * partialProgress
        });
      } else {
        assetPoints.push(assetCoords);
        burdenPoints.push(burdenCoords);
      }
    }

    // Draw filled area between the two lines (green gradient)
    if (assetPoints.length > 1) {
      const areaGradient = ctx.createLinearGradient(padding.left, 0, width - padding.right, 0);
      areaGradient.addColorStop(0, 'rgba(255, 193, 92, 0.25)');
      areaGradient.addColorStop(1, 'rgba(1, 87, 60, 0.35)');

      ctx.beginPath();
      // Start from first asset point
      ctx.moveTo(assetPoints[0].x, assetPoints[0].y);
      // Draw along asset line (top)
      for (let i = 1; i < assetPoints.length; i++) {
        ctx.lineTo(assetPoints[i].x, assetPoints[i].y);
      }
      // Draw down to burden line and back along it (bottom)
      for (let i = burdenPoints.length - 1; i >= 0; i--) {
        ctx.lineTo(burdenPoints[i].x, burdenPoints[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = areaGradient;
      ctx.fill();
    }

    // Draw asset value line
    ctx.strokeStyle = assetGradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < assetPoints.length; i++) {
      if (i === 0) ctx.moveTo(assetPoints[i].x, assetPoints[i].y);
      else ctx.lineTo(assetPoints[i].x, assetPoints[i].y);
    }
    ctx.stroke();

    // Draw burden line
    ctx.strokeStyle = burdenGradient;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < burdenPoints.length; i++) {
      if (i === 0) ctx.moveTo(burdenPoints[i].x, burdenPoints[i].y);
      else ctx.lineTo(burdenPoints[i].x, burdenPoints[i].y);
    }
    ctx.stroke();

    // Draw dots for completed points
    for (let i = 0; i <= pointsToDraw && i < totalPoints; i++) {
      const point = dataPoints[i];
      const assetCoords = getCoords(point.year, point.assetValue);
      const burdenCoords = getCoords(point.year, point.zincBurden);

      const dotProgress = point.year / years;
      const assetDotColor = dotProgress < 0.5 ? 'rgba(255, 193, 92, 1)' : 'rgba(1, 87, 60, 1)';
      ctx.fillStyle = assetDotColor;
      ctx.beginPath();
      ctx.arc(assetCoords.x, assetCoords.y, 5, 0, Math.PI * 2);
      ctx.fill();

      const burdenDotColor = dotProgress < 0.5 ? 'rgb(247, 147, 46)' : 'rgb(235, 39, 39)';
      ctx.fillStyle = burdenDotColor;
      ctx.beginPath();
      ctx.arc(burdenCoords.x, burdenCoords.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Animate or draw immediately
  if (animate) {
    const duration = 1500;
    const startTime = performance.now();

    function animateFrame(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      drawLines(easedProgress);

      if (progress < 1) {
        requestAnimationFrame(animateFrame);
      }
    }

    requestAnimationFrame(animateFrame);
  } else {
    drawLines(1);
  }

  // Store data for hover
  canvas.dataPoints = dataPoints;
  canvas.getCoords = getCoords;
  canvas.padding = padding;
  canvas.chartWidth = chartWidth;
  canvas.years = years;

  // Only add event listeners once
  if (!comparisonChartInitialized) {
    comparisonChartInitialized = true;

    canvas.addEventListener('mousemove', (e) => {
      const canvasRect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - canvasRect.left;

      const yearWidth = canvas.chartWidth / canvas.years;
      const relativeX = mouseX - canvas.padding.left;
      const closestYear = Math.round(relativeX / yearWidth);

      if (closestYear >= 0 && closestYear <= canvas.years && canvas.dataPoints[closestYear]) {
        const point = canvas.dataPoints[closestYear];
        const assetCoords = canvas.getCoords(point.year, point.assetValue);

        document.getElementById('tooltip-year-value').textContent = point.year;
        document.getElementById('tooltip-rsu-value').textContent = formatCurrency(point.assetValue);
        document.getElementById('tooltip-burden-value').textContent = formatCurrency(point.zincBurden);
        document.getElementById('tooltip-net-value').textContent = formatCurrency(point.assetValue - point.zincBurden);

        tooltip.style.left = (assetCoords.x + 20) + 'px';
        tooltip.style.top = (assetCoords.y - 50) + 'px';
        tooltip.classList.add('visible');
      }
    });

    canvas.addEventListener('mouseleave', () => {
      tooltip.classList.remove('visible');
    });
  }
}

// Draw comparison chart when section is in view
const comparisonChartSection = document.querySelector('.comparison-chart-section');
if (comparisonChartSection && scrollContainer) {
  const comparisonObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        comparisonChartSection.classList.add('animate-in');
        setTimeout(() => drawComparisonChart(true), 500);
        trackButtonClick('section_view_comparison_chart');
        comparisonObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.3,
    root: scrollContainer
  });

  comparisonObserver.observe(comparisonChartSection);
}

// Asset toggle buttons
document.querySelectorAll('.asset-toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.asset-toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedComparisonAsset = btn.dataset.asset;
    trackButtonClick('comparison_asset_toggle', { asset: btn.dataset.asset });
    drawComparisonChart(true);
  });
});

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
  // Cash tooltip (no tax for cash)
  document.getElementById('cash-tooltip-gap').textContent = formatCurrency(cashNeeded);
  document.getElementById('cash-tooltip-tax').textContent = '₹0';
  document.getElementById('cash-tooltip-total').textContent = formatCurrency(cashNeeded);

  // Land section
  const landGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
  const landTax = landGrossSale - results.fundingGap;
  const landFV = calculateFutureValue(landGrossSale, modelInputs.assets.land.cagrPct, years);
  const landGrowth = landFV - landGrossSale;
  document.getElementById('land-value-today').textContent = formatCurrency(landGrossSale);
  document.getElementById('land-value-future').textContent = formatCurrency(landFV);
  document.getElementById('land-growth').textContent = '+' + formatCr(landGrowth);
  // Land tooltip
  document.getElementById('land-tooltip-gap').textContent = formatCurrency(results.fundingGap);
  document.getElementById('land-tooltip-tax').textContent = formatCurrency(landTax);
  document.getElementById('land-tooltip-total').textContent = formatCurrency(landGrossSale);

  // Equity section
  const equityGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
  const equityTax = equityGrossSale - results.fundingGap;
  const equityFV = calculateFutureValue(equityGrossSale, modelInputs.assets.indianEquity.cagrPct, years);
  const equityGrowth = equityFV - equityGrossSale;
  document.getElementById('equity-value-today').textContent = formatCurrency(equityGrossSale);
  document.getElementById('equity-value-future').textContent = formatCurrency(equityFV);
  document.getElementById('equity-growth').textContent = '+' + formatCr(equityGrowth);
  // Equity tooltip
  document.getElementById('equity-tooltip-gap').textContent = formatCurrency(results.fundingGap);
  document.getElementById('equity-tooltip-tax').textContent = formatCurrency(equityTax);
  document.getElementById('equity-tooltip-total').textContent = formatCurrency(equityGrossSale);

  // RSU section
  const rsuGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
  const rsuTax = rsuGrossSale - results.fundingGap;
  const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
  const rsuFV = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  const rsuGrowth = rsuFV - rsuGrossSale;
  document.getElementById('rsu-value-today').textContent = formatCurrency(rsuGrossSale);
  document.getElementById('rsu-value-future').textContent = formatCurrency(rsuFV);
  document.getElementById('rsu-growth').textContent = '+' + formatCr(rsuGrowth);
  // RSU tooltip
  document.getElementById('rsu-tooltip-gap').textContent = formatCurrency(results.fundingGap);
  document.getElementById('rsu-tooltip-tax').textContent = formatCurrency(rsuTax);
  document.getElementById('rsu-tooltip-total').textContent = formatCurrency(rsuGrossSale);

  // Zinc section (same as RSU values but kept)
  document.getElementById('zinc-value-today').textContent = formatCurrency(rsuGrossSale);
  document.getElementById('zinc-value-future').textContent = formatCurrency(rsuFV);
  document.getElementById('zinc-growth').textContent = '+' + formatCr(rsuGrowth);
}

// Draw animated growth curve on canvas with year/value updates
function drawGrowthCurve(canvasId, startValue, endValue, color = '#c4a35a') {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // Map canvas ID to element prefix
  const canvasToPrefix = {
    'chart-zinc-loan': 'zinc',
    'chart-use-cash': 'cash',
    'chart-sell-land': 'land',
    'chart-sell-indian-equity': 'equity',
    'chart-sell-rsus': 'rsu'
  };
  const optionType = canvasToPrefix[canvasId] || canvasId.replace('chart-', '').split('-')[0];

  // Get year count and value elements
  const yearCountEl = document.getElementById(optionType + '-year-count');
  const chartYearEl = document.getElementById(optionType + '-chart-year');
  const valueFutureEl = document.getElementById(optionType + '-value-future');
  const growthEl = document.getElementById(optionType + '-growth');

  // Get start and end values for interpolation
  const results = calculateModel(modelInputs);
  const years = modelInputs.zincLoanTenureYears;
  let todayValue = 0;
  let finalValue = 0;
  let cagr = 0;

  if (optionType === 'zinc' || optionType === 'rsu') {
    const rsuGrossSale = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.foreignRsu.embeddedGainPct, modelInputs.assets.foreignRsu.ltcgTaxRatePct, modelInputs.assets.foreignRsu.exemptionAmount);
    const effectiveRsuCagr = calculateEffectiveRsuInrCagr(modelInputs.assets.foreignRsu.usdCagrPct, modelInputs.assets.foreignRsu.inrDepreciationPct);
    todayValue = rsuGrossSale;
    cagr = effectiveRsuCagr;
    finalValue = calculateFutureValue(rsuGrossSale, effectiveRsuCagr, years);
  } else if (optionType === 'cash') {
    todayValue = results.fundingGap;
    cagr = modelInputs.assets.cash.cagrPct;
    finalValue = calculateFutureValue(todayValue, cagr, years);
  } else if (optionType === 'land') {
    todayValue = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.land.embeddedGainPct, modelInputs.assets.land.ltcgTaxRatePct, modelInputs.assets.land.exemptionAmount);
    cagr = modelInputs.assets.land.cagrPct;
    finalValue = calculateFutureValue(todayValue, cagr, years);
  } else if (optionType === 'equity') {
    todayValue = calculateGrossSaleRequired(results.fundingGap, modelInputs.assets.indianEquity.embeddedGainPct, modelInputs.assets.indianEquity.ltcgTaxRatePct, modelInputs.assets.indianEquity.exemptionAmount);
    cagr = modelInputs.assets.indianEquity.cagrPct;
    finalValue = calculateFutureValue(todayValue, cagr, years);
  }

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

  // Generate all curve points
  const allPoints = [];
  const numPoints = 100;
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const x = paddingLeft + t * (width - paddingLeft - paddingRight);
    const y = height - paddingBottom - (Math.pow(t, 2) * (height - paddingBottom - paddingTop));
    allPoints.push({ x, y });
  }

  // Animation - slower duration (3 seconds)
  const animationDuration = 3000;
  const startTime = performance.now();
  let lastYear = 0;

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / animationDuration, 1);
    const easedProgress = 1 - Math.pow(1 - progress, 2); // ease-out quadratic (slower)

    const pointsToShow = Math.floor(easedProgress * numPoints);

    // Calculate current year (0 to 10)
    const currentYear = Math.floor(easedProgress * years);

    // Update year labels when year changes
    if (currentYear !== lastYear || progress >= 1) {
      const displayYear = progress >= 1 ? years : currentYear;
      if (yearCountEl) yearCountEl.textContent = displayYear;
      if (chartYearEl) chartYearEl.textContent = displayYear;

      // Update future value based on current year
      const currentValue = calculateFutureValue(todayValue, cagr, displayYear);
      if (valueFutureEl) valueFutureEl.textContent = formatCurrency(currentValue);

      // Update growth badge amount
      const currentGrowth = currentValue - todayValue;
      if (growthEl) growthEl.textContent = '+' + formatCr(currentGrowth);

      lastYear = currentYear;
    }

    ctx.clearRect(0, 0, width, height);

    if (pointsToShow < 1) {
      requestAnimationFrame(animate);
      return;
    }

    const points = allPoints.slice(0, pointsToShow + 1);

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

    // Draw glowing dot at current position
    const currentPoint = points[points.length - 1];

    // Glow effect
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, 16, 0, Math.PI * 2);
    const glowGradient = ctx.createRadialGradient(currentPoint.x, currentPoint.y, 0, currentPoint.x, currentPoint.y, 16);
    glowGradient.addColorStop(0, 'rgba(180, 200, 100, 0.6)');
    glowGradient.addColorStop(1, 'rgba(180, 200, 100, 0)');
    ctx.fillStyle = glowGradient;
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(currentPoint.x, currentPoint.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#b4c864';
    ctx.fill();

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  // Start with year 0
  if (yearCountEl) yearCountEl.textContent = '0';
  if (chartYearEl) chartYearEl.textContent = '0';
  if (valueFutureEl) valueFutureEl.textContent = formatCurrency(todayValue);
  if (growthEl) growthEl.textContent = '+₹0';

  requestAnimationFrame(animate);
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

const firstOptionSection = document.getElementById('section-zinc-loan') || document.getElementById('section-use-cash');
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

// Nav pill click handlers to scroll to sections
navPills.forEach(pill => {
  pill.style.cursor = 'pointer';
  pill.addEventListener('click', () => {
    const targetOption = pill.dataset.option;
    const targetSection = document.querySelector(`.option-section[data-option="${targetOption}"]`);
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

updateUI();

// Update property value pill
function updatePropertyValuePill() {
  const MIN_VALUE = 100000;
  const MAX_VALUE = 100000000;

  function getHouseLevel(value) {
    const range = MAX_VALUE - MIN_VALUE;
    const step = range / 6;
    if (value < MIN_VALUE + step) return 1;
    if (value < MIN_VALUE + step * 2) return 2;
    if (value < MIN_VALUE + step * 3) return 3;
    if (value < MIN_VALUE + step * 4) return 4;
    if (value < MIN_VALUE + step * 5) return 5;
    return 6;
  }

  function formatPropertyValue(value) {
    const crores = value / 10000000;
    if (crores >= 1) {
      return crores.toFixed(crores % 1 === 0 ? 0 : 1) + ' Cr';
    }
    const lacs = value / 100000;
    return Math.round(lacs) + ' L';
  }

  const currentPrice = modelInputs.propertyPrice;
  const level = getHouseLevel(currentPrice);
  const pillImage = document.getElementById('property-pill-image');
  const pillAmount = document.getElementById('property-pill-amount');

  if (pillImage) {
    pillImage.src = `/houses/level${level}.png`;
  }
  if (pillAmount) {
    pillAmount.textContent = formatPropertyValue(currentPrice);
  }
}

updatePropertyValuePill();

// Property value pill edit click handler
document.getElementById('property-pill-edit')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openEditModal('propertyValue', modelInputs.propertyPrice, null);
});

// Also allow clicking on the pill itself to edit
document.getElementById('property-value-pill')?.addEventListener('click', () => {
  openEditModal('propertyValue', modelInputs.propertyPrice, null);
});

document.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const buttonName = button.id || button.textContent?.trim() || 'unknown_button';
  trackButtonClick(buttonName);
});

// Typing animation for section titles
function typeText(element, text, speed = 30) {
  return new Promise((resolve) => {
    let index = 0;
    element.textContent = '';

    function type() {
      if (index < text.length) {
        element.textContent += text.charAt(index);
        index++;
        setTimeout(type, speed);
      } else {
        resolve();
      }
    }

    type();
  });
}

// Animate a section with typing effect
async function animateSection(section) {
  if (section.dataset.animating === 'true' || section.classList.contains('animate')) return;
  section.dataset.animating = 'true';

  const titleTextEl = section.querySelector('.option-title-text');
  const fullText = titleTextEl?.dataset.fullText || '';

  // Delay before typing starts
  await new Promise(r => setTimeout(r, 300));

  // Type the title (slower speed - 40ms per character)
  if (titleTextEl && fullText) {
    await typeText(titleTextEl, fullText, 40);
  }

  // Small pause after typing completes
  await new Promise(r => setTimeout(r, 300));

  // Add animate class to slide title up and reveal other elements
  section.classList.add('animate');

  // Draw chart after elements start appearing
  const canvasId = 'chart-' + section.dataset.option;
  const canvas = document.getElementById(canvasId);
  if (canvas && !canvas.dataset.drawn) {
    setTimeout(() => {
      drawGrowthCurve(canvasId, 0, 100);
      canvas.dataset.drawn = 'true';
    }, 800);
  }
}

// Page indicator
const pageDots = document.querySelectorAll('.page-dot');
const allSections = document.querySelectorAll('.snap-section');

function updatePageIndicator() {
  let activeIndex = 0;
  const scrollTop = scrollContainer.scrollTop;
  const viewportHeight = window.innerHeight;

  allSections.forEach((section, index) => {
    const sectionTop = section.offsetTop;
    if (scrollTop >= sectionTop - viewportHeight / 2) {
      activeIndex = index;
    }
  });

  pageDots.forEach((dot, index) => {
    dot.classList.toggle('active', index === activeIndex);
  });
}

// Click on page dot to scroll to section
pageDots.forEach((dot, index) => {
  dot.addEventListener('click', () => {
    const targetSection = allSections[index];
    if (targetSection) {
      targetSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// Scroll listener
scrollContainer.addEventListener('scroll', () => {
  updateActivePill();
  updatePageIndicator();

  // Animate sections when they come into view
  optionSections.forEach(section => {
    const rect = section.getBoundingClientRect();
    // Check if section is mostly visible (top is within viewport)
    if (rect.top < window.innerHeight * 0.6 && rect.bottom > 0) {
      animateSection(section);
    }
  });
});

// Zinc intro section typing animation
const zincIntroSection = document.getElementById('zinc-intro-section');
let zincIntroAnimated = false;

async function animateZincIntro() {
  if (zincIntroAnimated) return;
  zincIntroAnimated = true;

  const labelEl = zincIntroSection.querySelector('.zinc-intro-label');
  const titleTextEl = zincIntroSection.querySelector('.zinc-intro-title-text');
  const fullText = titleTextEl?.dataset.fullText || '';

  // First fade in the label
  await new Promise(r => setTimeout(r, 200));
  if (labelEl) {
    labelEl.classList.add('animate');
  }

  // Wait for label animation to complete, then start typing
  await new Promise(r => setTimeout(r, 700));

  if (titleTextEl && fullText) {
    await typeText(titleTextEl, fullText, 25);
    titleTextEl.classList.add('typing-done');
  }
}

const zincIntroObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateZincIntro();
      trackButtonClick('section_view_zinc_intro');
    }
  });
}, {
  threshold: 0.5,
  root: scrollContainer
});

if (zincIntroSection) {
  zincIntroObserver.observe(zincIntroSection);
}

// Track section views
const sectionViewTracker = new Map();

function trackSectionView(sectionId) {
  if (sectionViewTracker.has(sectionId)) return;
  sectionViewTracker.set(sectionId, true);
  trackButtonClick('section_view', { section: sectionId });
}

// Observe all snap sections for view tracking
const sectionViewObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const sectionId = entry.target.id || entry.target.dataset.option || 'unknown';
      trackSectionView(sectionId);
    }
  });
}, {
  threshold: 0.5,
  root: scrollContainer
});

document.querySelectorAll('.snap-section').forEach(section => {
  sectionViewObserver.observe(section);
});

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(question => {
  question.addEventListener('click', () => {
    const faqItem = question.parentElement;
    const isOpen = faqItem.classList.contains('open');
    const questionText = question.querySelector('span')?.textContent || 'unknown';

    // Close all other FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
      item.classList.remove('open');
    });

    // Toggle current item
    if (!isOpen) {
      faqItem.classList.add('open');
      trackButtonClick(`faq_open_${questionText.substring(0, 30).replace(/\s+/g, '_').toLowerCase()}`);
    }
  });
});

// Hide sticky nav and show scroll-to-top when FAQ section is visible
const faqSection = document.getElementById('section-faq');
const scrollToTopBtn = document.getElementById('scroll-to-top');

if (faqSection && stickyNav) {
  const faqNavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        stickyNav.style.opacity = '0';
        stickyNav.style.pointerEvents = 'none';
        if (scrollToTopBtn) scrollToTopBtn.classList.add('visible');
      } else {
        stickyNav.style.opacity = '1';
        stickyNav.style.pointerEvents = 'auto';
        if (scrollToTopBtn) scrollToTopBtn.classList.remove('visible');
      }
    });
  }, {
    threshold: 0.3,
    root: scrollContainer
  });
  faqNavObserver.observe(faqSection);
}

// Scroll to top button click handler
if (scrollToTopBtn) {
  scrollToTopBtn.addEventListener('click', () => {
    trackButtonClick('scroll_to_top');
    scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// Initialize
updateUI();
updateOptionSections();
updatePageIndicator();
