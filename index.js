import { trackButtonClick, trackPageView, trackValueSubmit } from './firebaseAnalytics.js';
import { auth } from './firebaseAuth.js';
import {
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect
} from 'firebase/auth';

const loginModal = document.getElementById('login-modal');
const getStartedBtn = document.getElementById('get-started-btn');
const googleSignInBtn = document.getElementById('google-signin-btn');
const loginSkipBtn = document.getElementById('login-skip');
const loginStatus = document.getElementById('login-status');
const provider = new GoogleAuthProvider();
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://labs-sbox.zinc.money').replace(/\/$/, '');
const CUSTOMER_REGISTER_URL = `${API_BASE_URL}/api/customers/register/`;
const APPLICATION_API_KEY = import.meta.env.VITE_APPLICATION_API_KEY || import.meta.env.VITE_API_KEY || '';

trackPageView('home');

getStartedBtn.addEventListener('click', () => {
  trackButtonClick('get_started');
  loginModal.classList.add('visible');
});

async function registerCustomerForLogin() {
  const user = auth.currentUser;
  if (!user) return;
  if (!APPLICATION_API_KEY) {
    console.warn('Customer register skipped: missing VITE_APPLICATION_API_KEY/VITE_API_KEY');
    return;
  }

  const payload = {
    phone: user.phoneNumber || '+91',
    name: user.displayName || 'Customer Name',
    email: user.email || undefined,
    signup_method: user.phoneNumber ? 'PHONE' : 'EMAIL',
  };

  const response = await fetch(CUSTOMER_REGISTER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': APPLICATION_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Register failed (${response.status}): ${errorText}`);
  }
}

async function proceedToPlanner(source) {
  if (auth.currentUser) {
    try {
      await registerCustomerForLogin();
    } catch (error) {
      console.error('Customer register API failed:', error);
    }
  }

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

function setLoginStatus(message, isError = false) {
  if (!loginStatus) return;
  loginStatus.textContent = message;
  loginStatus.style.color = isError ? '#b00020' : 'rgba(0, 0, 0, 0.6)';
}

function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Popup blocked. Continuing with secure redirect...';
  if (code === 'auth/unauthorized-domain') return 'This domain is not authorized in Firebase Authentication.';
  return error?.message || 'Unable to sign in. Please try again.';
}

async function handleGoogleSignIn() {
  googleSignInBtn.disabled = true;
  setLoginStatus('Signing in with Google...');

  try {
    await signInWithPopup(auth, provider);
    await proceedToPlanner('google_signin_success_popup');
  } catch (error) {
    const code = error?.code || '';
    if (code === 'auth/popup-blocked' || code === 'auth/cancelled-popup-request') {
      setLoginStatus('Popup unavailable. Redirecting to Google sign-in...');
      await signInWithRedirect(auth, provider);
      return;
    }
    setLoginStatus(friendlyAuthError(error), true);
  } finally {
    googleSignInBtn.disabled = false;
  }
}

googleSignInBtn.addEventListener('click', handleGoogleSignIn);
loginSkipBtn.addEventListener('click', () => proceedToPlanner('skip_for_now'));

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) {
    loginModal.classList.remove('visible');
  }
});

getRedirectResult(auth)
  .then((result) => {
    if (result?.user) {
      return proceedToPlanner('google_signin_success_redirect');
    }
    return null;
  })
  .catch((error) => {
    loginModal.classList.add('visible');
    setLoginStatus(friendlyAuthError(error), true);
  });
