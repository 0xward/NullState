/**
 * Merge existing next.config.js with additional webpack alias stubs for
 * native/server-only modules that leak into browser bundles (wallet SDKs etc.).
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com'],
  },
  // ESLint is now configured (.eslintrc.json) so `npm run lint` works on
  // demand for local/CI use. We deliberately DO NOT run it during `next build`:
  // the build previously had no ESLint config and so never linted, and the
  // existing codebase has pre-existing lint findings (mostly stylistic
  // jsx-no-comment-textnodes). Keeping the build lint-free preserves the exact
  // current Vercel behavior — a deploy can never start failing on a lint rule.
  // Run `npm run lint` yourself to see/triage findings.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Safety net: force firebase-admin (and anything it pulls in, e.g.
  // jwks-rsa/jose if Admin Auth is ever re-introduced) to be required()
  // at runtime from node_modules instead of webpack-bundled. This avoids
  // ERR_REQUIRE_ESM crashes from ESM-only deps getting bundled into a
  // CJS serverless function. NOTE: this is Next 14 syntax
  // (experimental.serverComponentsExternalPackages) — Next 15 renamed
  // this to a stable top-level `serverExternalPackages` key.
  experimental: {
    serverComponentsExternalPackages: ['firebase-admin'],
  },
  // NOTE: GROQ_API_KEY and TWITTER_* are server-only — never expose to client.
  // Access them via process.env inside API routes only.
  // Only NEXT_PUBLIC_* vars are exposed to the browser.
  //
  // NEXT_PUBLIC_BUILD_ID — used by components/game/DungeonGame.tsx to
  // cache-bust the /game-engine/*.js files (?v=<build id>) so a deploy that
  // fixes an engine bug (freeze near the bunker door, black screen on floor
  // change, etc.) is actually picked up by browsers/CDN instead of serving
  // a stale cached copy of the old script forever.
  //
  // VERCEL_GIT_COMMIT_SHA (no NEXT_PUBLIC_ prefix) is a Vercel *system* env
  // var that's always present at build time on Vercel, with no project
  // settings toggle required. We read that server-only value here and remap
  // it onto a NEXT_PUBLIC_ name so Next.js inlines it into the client
  // bundle. Do NOT rely on NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA directly — that
  // one only exists if "Automatically expose System Environment Variables"
  // happens to be enabled in the project's settings, which it may not be.
  // The Date.now() fallback covers local builds / non-Vercel platforms that
  // don't have VERCEL_GIT_COMMIT_SHA at all.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now()),
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Stub React Native async storage (not used in browser builds)
      '@react-native-async-storage/async-storage': false,
      // Stub pino-pretty (server-only logging helper)
      'pino-pretty': false,
    }
    return config
  },
}

module.exports = nextConfig
