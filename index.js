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

trackPageView('home');

getStartedBtn.addEventListener('click', () => {
  trackButtonClick('get_started');
  loginModal.classList.add('visible');
});

function proceedToPlanner(source) {
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
    proceedToPlanner('google_signin_success_popup');
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
      proceedToPlanner('google_signin_success_redirect');
    }
  })
  .catch((error) => {
    loginModal.classList.add('visible');
    setLoginStatus(friendlyAuthError(error), true);
  });
