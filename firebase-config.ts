/**
 * Firebase Admin SDK initialization for backend scripts and API routes.
 *
 * This file uses the Admin SDK (firebase-admin) — do NOT import it in
 * client-side code. For client-side Firebase, use lib/firebase.ts instead.
 *
 * IMPORTANT: firebase-admin v12+ (we're on v14) dropped the old namespaced
 * API (`admin.credential.cert(...)`, `admin.database()`, `admin.auth()`).
 * `require('firebase-admin')` now only exposes a small top-level surface
 * (initializeApp, cert, getApps, ...) — the rest lives in subpath modules
 * (`firebase-admin/app`, `firebase-admin/database`, `firebase-admin/auth`).
 * Using the old namespaced calls silently resolves to `undefined` and
 * throws "Cannot read properties of undefined (reading 'cert')" the moment
 * FIREBASE_SERVICE_ACCOUNT is actually set (it never got that far while the
 * env var was empty, which is why this stayed hidden).
 *
 * Required environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — JSON string of the service account key
 *                               (store only in GitHub Secrets / Vercel env, never commit)
 *   FIREBASE_DATABASE_URL     — Realtime Database URL
 *                               e.g. https://nullstate-35b2e-default-rtdb.asia-southeast1.firebasedatabase.app
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app'
import { getDatabase } from 'firebase-admin/database'
import { getAuth } from 'firebase-admin/auth'

function initAdmin(): App | null {
  const existing = getApps()
  if (existing.length > 0) return existing[0]

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

  try {
    return initializeApp({
      credential: cert(serviceAccount as Parameters<typeof cert>[0]),
      databaseURL:
        process.env.FIREBASE_DATABASE_URL ??
        'https://nullstate-35b2e-default-rtdb.firebaseio.com',
    })
  } catch (err) {
    console.error('[firebase-config] Failed to initialize Firebase Admin app:', err)
    return null
  }
}

const adminApp = initAdmin()

/** Firebase Admin Realtime Database instance (or null if unconfigured) */
export function getAdminDb(): ReturnType<typeof getDatabase> | null {
  if (!adminApp) return null
  return getDatabase(adminApp)
}

/** Firebase Admin Auth instance (or null if unconfigured) */
export function getAdminAuth(): ReturnType<typeof getAuth> | null {
  if (!adminApp) return null
  return getAuth(adminApp)
}

export default adminApp
