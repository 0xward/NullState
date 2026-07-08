/**
 * Firebase Admin SDK initialization for backend scripts and API routes.
 *
 * This file uses the Admin SDK (firebase-admin) — do NOT import it in
 * client-side code. For client-side Firebase, use lib/firebase.ts instead.
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of the service account key
 *                               (store only in GitHub Secrets / Vercel env, never commit)
 *   FIREBASE_DATABASE_URL     — Realtime Database URL
 *                               e.g. https://nullstate-35b2e-default-rtdb.firebaseio.com
 */

// firebase-admin is a server-only package; dynamic require avoids bundling it
// into the Next.js client bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const admin = require('firebase-admin')

function initAdmin() {
  if (admin.apps.length > 0) return admin.apps[0]

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT
  if (!serviceAccountEnv) {
    console.warn('[firebase-config] FIREBASE_SERVICE_ACCOUNT not set — Firebase Admin disabled')
    return null
  }

  let serviceAccount: object
  try {
    serviceAccount = JSON.parse(serviceAccountEnv)
  } catch {
    console.error('[firebase-config] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON')
    return null
  }

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL:
      process.env.FIREBASE_DATABASE_URL ??
      `https://nullstate-35b2e-default-rtdb.firebaseio.com`,
  })
}

initAdmin()

/** Firebase Admin Realtime Database instance (or null if unconfigured) */
export function getAdminDb(): ReturnType<typeof admin.database> | null {
  if (!admin.apps.length) return null
  return admin.database()
}

/** Firebase Admin Auth instance (or null if unconfigured) */
export function getAdminAuth(): ReturnType<typeof admin.auth> | null {
  if (!admin.apps.length) return null
  return admin.auth()
}

export default admin
