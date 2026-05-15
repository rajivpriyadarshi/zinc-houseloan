import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported, logEvent, setAnalyticsCollectionEnabled } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || import.meta.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
let analyticsInstancePromise;

function shouldEnableDebug() {
  const debugFlag = import.meta.env.VITE_FIREBASE_DEBUG || import.meta.env.NEXT_PUBLIC_FIREBASE_DEBUG;
  return String(debugFlag).toLowerCase() === 'true';
}

async function getAnalyticsInstance() {
  if (analyticsInstancePromise) return analyticsInstancePromise;

  analyticsInstancePromise = isSupported().then((supported) => {
    if (!supported) return null;
    const analytics = getAnalytics(app);
    setAnalyticsCollectionEnabled(analytics, true);
    if (shouldEnableDebug()) {
      window.localStorage.setItem('debug_mode', 'true');
    }
    return analytics;
  }).catch(() => null);

  return analyticsInstancePromise;
}

export async function trackPageView(pageName) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, 'page_view', {
    page_title: document.title,
    page_location: window.location.href,
    page_path: window.location.pathname,
    page_name: pageName,
  });
}

export async function trackButtonClick(buttonName, extraParams = {}) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, 'button_click', {
    button_name: buttonName,
    page_path: window.location.pathname,
    ...extraParams,
  });
}

export async function trackValueSubmit(actionName, submittedValue, extraParams = {}) {
  const analytics = await getAnalyticsInstance();
  if (!analytics) return;
  logEvent(analytics, 'value_submit', {
    action_name: actionName,
    submitted_value: submittedValue,
    page_path: window.location.pathname,
    ...extraParams,
  });
}
