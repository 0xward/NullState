'use client'

import Link from 'next/link'
import CustomCursor from '@/components/ui/CustomCursor'
import Navbar from '@/components/ui/Navbar'
import HeroSection from '@/components/landing/HeroSection'

export default function Home() {
  return (
    <>
      {/* Custom cursor */}
      <CustomCursor />

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
        <div className="relative z-[2] -mt-24 flex justify-center gap-3 pb-10">
          <Link href="/game" className="rounded border border-null-green px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-green hover:bg-null-green hover:text-black">
            Dashboard
          </Link>
          <Link href="/leaderboard" className="rounded border border-null-blue px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-blue hover:bg-null-blue hover:text-black">
            Leaderboard
          </Link>
          <Link href="/profile" className="rounded border border-null-amber px-4 py-2 font-mono text-xs uppercase tracking-[2px] text-null-amber hover:bg-null-amber hover:text-black">
            Profile
          </Link>
        </div>
      </main>
    </>
  )
}
