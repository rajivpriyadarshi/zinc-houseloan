import { trackButtonClick, trackPageView, trackValueSubmit } from './firebaseAnalytics.js';
import { app, auth } from './firebaseAuth.js';
import { connectAuthEmulator, GoogleAuthProvider, signInWithCustomToken, signInWithPopup, signInWithRedirect, getRedirectResult } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions, httpsCallable } from 'firebase/functions';

const loginModal = document.getElementById('login-modal');
const getStartedBtn = document.getElementById('get-started-btn');
const googleSignInBtn = document.getElementById('google-signin-btn');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const editEmailBtn = document.getElementById('edit-email-btn');
const loginSkipBtn = document.getElementById('login-skip');
const loginEmail = document.getElementById('login-email');
const loginOtp = document.getElementById('login-otp');
const loginStepEmail = document.getElementById('login-step-email');
const loginStepOtp = document.getElementById('login-step-otp');
const loginEmailChip = document.getElementById('login-email-chip');
const loginStatus = document.getElementById('login-status');
const provider = new GoogleAuthProvider();

const functions = getFunctions(app, 'asia-south1');
const emulatorFlag = String(import.meta.env.VITE_USE_FIREBASE_EMULATORS || '').toLowerCase();
const authEmulatorFlag = String(import.meta.env.VITE_USE_AUTH_EMULATOR || '').toLowerCase();
const useAuthEmulator = authEmulatorFlag === 'true';
const useFunctionsEmulator = emulatorFlag === 'true' && useAuthEmulator;

if (useFunctionsEmulator) {
  try {
    connectFunctionsEmulator(functions, window.location.hostname, 5001);
  } catch (error) {
    console.warn('Emulator connect failed, continuing with default Firebase endpoints.', error);
  }
}

if (emulatorFlag === 'true' && !useAuthEmulator) {
  console.warn('Functions emulator requested, but Auth emulator is disabled. Using production Functions to avoid INVALID_CUSTOM_TOKEN.');
}

if (useAuthEmulator) {
  try {
    connectAuthEmulator(auth, `http://${window.location.hostname}:9099`, { disableWarnings: true });
  } catch (error) {
    console.warn('Auth emulator connect failed, continuing with Firebase Auth server.', error);
  }
}

const sendEmailOtp = httpsCallable(functions, 'sendEmailOtp');
const verifyEmailOtp = httpsCallable(functions, 'verifyEmailOtp');
const registerCustomer = httpsCallable(functions, 'registerCustomer');

trackPageView('home');

// Header scroll behavior
const siteHeader = document.getElementById('site-header');
const logoutBtn = document.getElementById('logout-btn');
let lastScrollY = 0;

function handleScroll() {
  const currentScrollY = window.scrollY;

  if (currentScrollY > lastScrollY && currentScrollY > 70) {
    siteHeader.classList.add('hidden');
  } else {
    siteHeader.classList.remove('hidden');
  }

  lastScrollY = currentScrollY;
}

window.addEventListener('scroll', handleScroll, { passive: true });

// Check auth state and show/hide logout button
const userEmailEl = document.getElementById('user-email');

auth.onAuthStateChanged((user) => {
  if (user) {
    logoutBtn.classList.add('visible');
    if (userEmailEl) {
      userEmailEl.textContent = user.email || '';
      userEmailEl.classList.add('visible');
    }
  } else {
    logoutBtn.classList.remove('visible');
    if (userEmailEl) {
      userEmailEl.textContent = '';
      userEmailEl.classList.remove('visible');
    }
  }
});

// Logout functionality
logoutBtn.addEventListener('click', async () => {
  trackButtonClick('logout_click');
  try {
    await auth.signOut();
    sessionStorage.removeItem('zinc-flow-started');
    trackButtonClick('logout_success');
  } catch (error) {
    console.error('Logout error:', error);
    trackButtonClick('logout_failed');
  }
});

if (getStartedBtn) {
  getStartedBtn.addEventListener('click', () => {
    trackButtonClick('get_started');
    sessionStorage.setItem('zinc-flow-started', 'true');
    document.body.classList.add('page-exit');
    setTimeout(() => window.location.href = 'planner.html', 400);
  });
}

function setLoginStatus(message, isError = false) {
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#b00020' : 'rgba(0, 0, 0, 0.6)';
}

function showStep(step) {
  loginStepEmail.classList.toggle('active', step === 'email');
  loginStepOtp.classList.toggle('active', step === 'otp');
  trackButtonClick(step === 'otp' ? 'auth_step_otp' : 'auth_step_email');
}

function callableErrorMessage(error, fallback) {
  const details = error?.details;
  const response = details?.response;
  if (typeof response === 'string' && response.trim()) {
    return response;
  }
  if (response && typeof response === 'object') {
    return response.message || response.error || JSON.stringify(response);
  }
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

async function proceedToPlanner(source) {
  trackButtonClick(source);
  trackValueSubmit('user_profile_submit', JSON.stringify({
    email_provided: Boolean(auth.currentUser?.email),
    phone_provided: false,
  }));

  sessionStorage.setItem('zinc-flow-started', 'true');
  loginModal.classList.remove('visible');
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'planner.html', 400);
}

async function tryRegisterCustomer(email, name) {
  try {
    await registerCustomer({ email, name });
    trackButtonClick('register_customer_success');
    return true;
  } catch (error) {
    trackButtonClick('register_customer_failed', {
      error_message: callableErrorMessage(error, 'unknown'),
    });
    console.warn('registerCustomer failed (non-blocking):', error);
    return false;
  }
}

async function handleGoogleSignIn() {
  trackButtonClick('google_signin_click');
  googleSignInBtn.disabled = true;
  setLoginStatus('Signing in with Google...');
  try {
    const result = await signInWithPopup(auth, provider);
    const email = result?.user?.email || '';
    await tryRegisterCustomer(email, result?.user?.displayName || toDisplayName(email));
    await proceedToPlanner('google_signin_success_popup');
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      trackButtonClick('google_signin_redirect_fallback');
      await signInWithRedirect(auth, provider);
      return;
    }
    trackButtonClick('google_signin_failed', {
      error_message: callableErrorMessage(error, 'unknown'),
    });
    setLoginStatus(callableErrorMessage(error, 'Google sign-in failed. Try again.'), true);
  } finally {
    googleSignInBtn.disabled = false;
  }
}

googleSignInBtn.addEventListener('click', handleGoogleSignIn);

sendOtpBtn.addEventListener('click', async () => {
  trackButtonClick('email_otp_send_click');
  const email = String(loginEmail.value || '').trim().toLowerCase();
  if (!isValidEmail(email)) {
    trackButtonClick('email_otp_send_invalid_email');
    setLoginStatus('Enter a valid email address.', true);
    return;
  }

  sendOtpBtn.disabled = true;
  setLoginStatus('Sending OTP...');
  try {
    await sendEmailOtp({ email });
    trackButtonClick('email_otp_sent');
    setLoginStatus('OTP sent. Check your email and enter the code.');
    loginEmailChip.textContent = email;
    loginOtp.value = '';
    showStep('otp');
  } catch (error) {
    trackButtonClick('email_otp_send_failed', {
      error_message: callableErrorMessage(error, 'unknown'),
    });
    setLoginStatus(callableErrorMessage(error, 'Could not send OTP. Try again.'), true);
  } finally {
    sendOtpBtn.disabled = false;
  }
});

verifyOtpBtn.addEventListener('click', async () => {
  trackButtonClick('email_otp_verify_click');
  const email = String(loginEmail.value || '').trim().toLowerCase();
  const otp = String(loginOtp.value || '').trim();

  if (!isValidEmail(email)) {
    trackButtonClick('email_otp_verify_invalid_email');
    setLoginStatus('Enter a valid email address.', true);
    return;
  }
  if (!/^\d{6}$/.test(otp)) {
    trackButtonClick('email_otp_verify_invalid_code');
    setLoginStatus('Enter a valid 6-digit OTP.', true);
    return;
  }

  verifyOtpBtn.disabled = true;
  setLoginStatus('Verifying OTP...');
  try {
    const verifyResult = await verifyEmailOtp({ email, otp });
    const customToken = verifyResult?.data?.firebaseCustomToken;
    if (!customToken) {
      throw new Error('Missing Firebase custom token from OTP verification.');
    }

    await signInWithCustomToken(auth, customToken);
    await tryRegisterCustomer(email, toDisplayName(email));

    trackButtonClick('email_otp_verified');
    setLoginStatus('Login successful. Redirecting...');
    await proceedToPlanner('email_otp_login_success');
  } catch (error) {
    trackButtonClick('email_otp_verify_failed', {
      error_message: callableErrorMessage(error, 'unknown'),
    });
    setLoginStatus(callableErrorMessage(error, 'OTP verification failed. Try again.'), true);
  } finally {
    verifyOtpBtn.disabled = false;
  }
});

loginSkipBtn.addEventListener('click', () => {
  trackButtonClick('auth_skip_click');
  proceedToPlanner('skip_for_now');
});
editEmailBtn.addEventListener('click', () => {
  trackButtonClick('email_otp_edit_email');
  showStep('email');
  setLoginStatus('');
  loginEmail.focus();
});

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) {
    trackButtonClick('auth_modal_dismiss_overlay');
    loginModal.classList.remove('visible');
    showStep('email');
  }
});

getRedirectResult(auth)
  .then(async (result) => {
    if (!result?.user) return;
    trackButtonClick('google_signin_success_redirect');
    const email = result.user.email || '';
    await tryRegisterCustomer(email, result.user.displayName || toDisplayName(email));
    await proceedToPlanner('google_signin_success_redirect');
  })
  .catch((error) => {
    trackButtonClick('google_signin_redirect_failed', {
      error_message: callableErrorMessage(error, 'unknown'),
    });
    setLoginStatus(callableErrorMessage(error, 'Google sign-in failed. Try again.'), true);
  });
