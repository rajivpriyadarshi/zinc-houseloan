import { trackButtonClick, trackPageView, trackValueSubmit } from './firebaseAnalytics.js';

const loginModal = document.getElementById('login-modal');
const getStartedBtn = document.getElementById('get-started-btn');
const loginSubmitBtn = document.getElementById('login-submit');
const loginSkipBtn = document.getElementById('login-skip');
const loginEmail = document.getElementById('login-email');
const loginPhone = document.getElementById('login-phone');

trackPageView('home');

getStartedBtn.addEventListener('click', () => {
  trackButtonClick('get_started');
  loginModal.classList.add('visible');
});

function proceedToPlanner(source) {
  const emailValue = (loginEmail.value || '').trim();
  const phoneValue = (loginPhone.value || '').trim();

  trackButtonClick(source);
  trackValueSubmit('user_profile_submit', JSON.stringify({
    email_provided: Boolean(emailValue),
    phone_provided: Boolean(phoneValue),
  }));

  sessionStorage.setItem('zinc-flow-started', 'true');
  loginModal.classList.remove('visible');
  document.body.classList.add('page-exit');
  setTimeout(() => window.location.href = 'planner.html', 400);
}

loginSubmitBtn.addEventListener('click', () => proceedToPlanner('login_continue'));
loginSkipBtn.addEventListener('click', () => proceedToPlanner('skip_for_now'));

loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) {
    loginModal.classList.remove('visible');
  }
});
