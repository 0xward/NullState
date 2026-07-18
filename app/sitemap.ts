import type { MetadataRoute } from 'next'

const siteUrl = 'https://nullstate-ten.vercel.app'

const routes = ['/', '/docs', '/game', '/terms', '/privacy']

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
  }))
}
