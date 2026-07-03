/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['pbs.twimg.com', 'abs.twimg.com'],
  },
  // NOTE: GROQ_API_KEY and TWITTER_* are server-only — never expose to client.
  // Access them via process.env inside API routes only.
  // Only NEXT_PUBLIC_* vars are exposed to the browser.
}

module.exports = nextConfig
