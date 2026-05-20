const crypto = require('node:crypto');
const { getApps, initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { HttpsError, onCall } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const { defineSecret } = require('firebase-functions/params');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

setGlobalOptions({ region: 'asia-south1', maxInstances: 10 });

if (!getApps().length) initializeApp();

const db = getFirestore('zinc-home-finance');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_LENGTH = 6;
const SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'no-reply@zinc.money';
const WEB_ORIGIN = (() => {
  const raw = process.env.WEB_ORIGIN;
  if (!raw || raw === 'true') return true;
  if (raw === 'false') return false;
  return raw.split(',').map((item) => item.trim()).filter(Boolean);
})();
const API_BASE_URL = (process.env.API_BASE_URL || 'https://labs-sbox.zinc.money').replace(/\/+$/, '');
const AWS_ACCESS_KEY_ID = defineSecret('AWS_ACCESS_KEY_ID');
const AWS_SECRET_ACCESS_KEY = defineSecret('AWS_SECRET_ACCESS_KEY');
const ZINC_LABS_API_KEY = defineSecret('ZINC_LABS_API_KEY');
const ZINC_LABS_REGISTER_URL = `${API_BASE_URL}/api/customers/register/`;

function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  return value.trim();
}

function normalizeEmail(email) {
  return requireString(email, 'email').toLowerCase();
}

function optionalTrim(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function emailDocId(email) {
  return crypto.createHash('sha256').update(email).digest('hex');
}

function hashOtp(otp, salt) {
  return crypto.createHash('sha256').update(`${otp}:${salt}`).digest('hex');
}

function makeOtp() {
  if (process.env.HARDCODED_OTP) return process.env.HARDCODED_OTP;
  const min = 10 ** (OTP_LENGTH - 1);
  const max = 10 ** OTP_LENGTH - 1;
  return String(crypto.randomInt(min, max + 1));
}

function applicationIdForEmail(email) {
  return crypto.createHash('sha256').update(`application:${email}`).digest('hex').slice(0, 28);
}

function callableOptions(secrets = [], { invoker } = {}) {
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';
  const opts = { cors: isEmulator ? true : WEB_ORIGIN, secrets };
  if (invoker) opts.invoker = invoker;
  return opts;
}

async function sendOtpEmail(email, otp) {
  if (process.env.SKIP_OTP_EMAIL === 'true') {
    console.info(`Skipping OTP email for ${email}; using configured test OTP.`);
    return;
  }

  const client = new SESClient({
    region: process.env.AWS_REGION || 'ap-south-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  await client.send(new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Charset: 'UTF-8', Data: 'Your Zinc verification code' },
      Body: {
        Text: {
          Charset: 'UTF-8',
          Data: `Your Zinc verification code is ${otp}. It expires in 10 minutes.`,
        },
        Html: {
          Charset: 'UTF-8',
          Data: `<p>Your Zinc verification code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes.</p>`,
        },
      },
    },
  }));
}

exports.sendEmailOtp = onCall(callableOptions([AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY], { invoker: 'public' }), async (request) => {
  const email = normalizeEmail(request.data?.email);
  const otp = makeOtp();
  const salt = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const expiresAt = new Date(now + OTP_TTL_MS);

  await db.collection('emailVerifications').doc(emailDocId(email)).set({
    email,
    otpHash: hashOtp(otp, salt),
    salt,
    attempts: 0,
    expiresAt: Timestamp.fromDate(expiresAt),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  try {
    await sendOtpEmail(email, otp);
  } catch (error) {
    throw new HttpsError('unavailable', 'Unable to send OTP email right now.', {
      message: error?.message || 'Unknown email provider error',
    });
  }

  return { expiresAt: expiresAt.toISOString() };
});

exports.verifyEmailOtp = onCall(callableOptions([], { invoker: 'public' }), async (request) => {
  try {
    const email = normalizeEmail(request.data?.email);
    const otp = requireString(request.data?.otp, 'otp');
    if (!/^\d{6}$/.test(otp)) {
      throw new HttpsError('invalid-argument', 'Enter the 6-digit code.');
    }

    const verificationRef = db.collection('emailVerifications').doc(emailDocId(email));
    const applicationId = applicationIdForEmail(email);
    const authTokenExpiresAt = new Date(Date.now() + SESSION_TTL_MS);

    await db.runTransaction(async (tx) => {
      const verificationSnap = await tx.get(verificationRef);
      if (!verificationSnap.exists) {
        throw new HttpsError('not-found', 'Request a new verification code.');
      }

      const verification = verificationSnap.data();
      const expiresAt = verification.expiresAt?.toDate?.();
      if (!expiresAt || expiresAt.getTime() < Date.now()) {
        throw new HttpsError('deadline-exceeded', 'Verification code expired. Request a new code.');
      }
      if ((verification.attempts || 0) >= 5) {
        throw new HttpsError('resource-exhausted', 'Too many attempts. Request a new code.');
      }
      if (hashOtp(otp, verification.salt) !== verification.otpHash) {
        tx.update(verificationRef, {
          attempts: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
        throw new HttpsError('permission-denied', 'The verification code is incorrect.');
      }

      tx.set(verificationRef, {
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });

    const authClient = getAuth();
    let authUser;
    try {
      authUser = await authClient.getUserByEmail(email);
    } catch (error) {
      if (error?.code !== 'auth/user-not-found') throw error;
      authUser = await authClient.createUser({ uid: applicationId, email, emailVerified: true });
    }

    const resolvedApplicationId = authUser.uid;

    await authClient.setCustomUserClaims(resolvedApplicationId, {
      applicationId: resolvedApplicationId,
      email,
      sessionExpiresAt: authTokenExpiresAt.getTime(),
    });
    const firebaseCustomToken = await authClient.createCustomToken(resolvedApplicationId, {
      applicationId: resolvedApplicationId,
      email,
      sessionExpiresAt: authTokenExpiresAt.getTime(),
    });

    return {
      applicationId: resolvedApplicationId,
      email,
      firebaseCustomToken,
      authTokenExpiresAt: authTokenExpiresAt.toISOString(),
      status: 'email_verified',
    };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('verifyEmailOtp unexpected error', error);
    throw new HttpsError('internal', 'INTERNAL', {
      reason: error?.message || 'Unknown error',
      code: error?.code || 'unknown',
    });
  }
});

exports.registerCustomer = onCall(callableOptions([ZINC_LABS_API_KEY], { invoker: 'public' }), async (request) => {
  const auth = request.auth;
  if (!auth?.uid) {
    throw new HttpsError('unauthenticated', 'Login required before customer registration.');
  }

  const session = {
    applicationId: auth.uid,
    email: String(auth.token?.email || ''),
  };

  const email = optionalTrim(request.data?.email || session.email).toLowerCase();
  const name = optionalTrim(request.data?.name);

  if (!email) {
    throw new HttpsError('invalid-argument', 'email is required for customer registration.');
  }

  const payload = {
    name,
    email,
    signup_method: 'EMAIL',
  };

  const apiKey = process.env.ZINC_LABS_API_KEY;
  if (process.env.FUNCTIONS_EMULATOR === 'true' && process.env.MOCK_ZINC_LABS_REGISTER === 'true') {
    await db.collection('applications').doc(session.applicationId).set({
      customerRegistration: {
        email,
        name,
        status: 'mock_registered',
        statusCode: 200,
        response: {
          ok: true,
          mocked: true,
          reason: 'MOCK_ZINC_LABS_REGISTER is enabled for the local emulator.',
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      ok: true,
      status: 200,
      response: {
        mocked: true,
      },
    };
  }

  if (!apiKey) {
    throw new HttpsError('failed-precondition', 'Zinc Labs API key is not configured.');
  }

  const response = await fetch(ZINC_LABS_REGISTER_URL, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const responseText = await response.text();
  let responseBody = null;
  try {
    responseBody = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseBody = responseText;
  }

  await db.collection('applications').doc(session.applicationId).set({
    customerRegistration: {
      email,
      name,
      status: response.ok ? 'registered' : 'failed',
      statusCode: response.status,
      response: responseBody,
      updatedAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  if (!response.ok) {
    const errorCode = response.status >= 500 ? 'unavailable' : 'failed-precondition';
    throw new HttpsError(errorCode, 'Could not register customer.', {
      status: response.status,
      response: responseBody,
    });
  }

  return {
    ok: true,
    status: response.status,
    response: responseBody,
  };
});
