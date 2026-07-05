/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com'],
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
}

module.exports = nextConfig
