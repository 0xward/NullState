'use client'

import Navbar from '@/components/ui/Navbar'
import HeroSection from '@/components/landing/HeroSection'

export default function Home() {
  return (
    <>
      {/* Custom cursor removed (Susanne & Dan: cursor disappears on desktop).
          The native OS cursor is more reliable across navigation than a JS
          cursor that hides the real one — keep the real one everywhere. */}

      {/* Background layers */}
      <div className="fixed inset-0 z-0 bg-grid pointer-events-none" />
      <div
        className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Navbar */}
      <Navbar />

      {/* Main content — just the hero, fills the viewport, no scroll */}
      <main className="h-[100dvh] overflow-hidden">
        <HeroSection />
      </main>
    </>
  )
}
