'use client'

import { useEffect } from 'react'
import CustomCursor from '@/components/ui/CustomCursor'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'
import SectionDivider from '@/components/ui/SectionDivider'
import LiveStatsTicker from '@/components/ui/LiveStatsTicker'
import HeroSection from '@/components/landing/HeroSection'
import GamePreviewSection from '@/components/landing/GamePreviewSection'
import AboutSection from '@/components/landing/AboutSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import RaidBossSection from '@/components/landing/RaidBossSection'
import RoadmapSection from '@/components/landing/RoadmapSection'
import FAQSection from '@/components/landing/FAQSection'
import CTASection from '@/components/landing/CTASection'
import GameUI from '@/components/game/GameUI'

export default function Home() {
  // Scroll reveal
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    )

    const observe = () => {
      document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
    }

    observe()
    // Re-observe after components mount
    const timeout = setTimeout(observe, 500)

    return () => {
      observer.disconnect()
      clearTimeout(timeout)
    }
  }, [])

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

      {/* Fixed corner decorations */}
      <div
        className="fixed top-20 left-4 font-mono text-[9px] text-null-muted tracking-[2px] pointer-events-none z-[2] hidden lg:block"
        style={{ writingMode: 'vertical-rl', opacity: 0.3 }}
      >
        NULL_STATE // CELO_MAINNET // ACTION_RPG
      </div>
      <div
        className="fixed top-20 right-4 font-mono text-[9px] text-null-muted tracking-[2px] pointer-events-none z-[2] hidden lg:block"
        style={{ writingMode: 'vertical-rl', opacity: 0.3 }}
      >
        MINIPAY_NATIVE // REAL_TIME // PERMADEATH
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Main content */}
      <main>
        {/* HERO */}
        <HeroSection />

        {/* LIVE STATS TICKER */}
        <LiveStatsTicker />

        <SectionDivider label="// GAME PREVIEW" />

        {/* GAME PREVIEW with phone mockup + glow */}
        <GamePreviewSection />

        <SectionDivider label="// ABOUT" />

        {/* ABOUT */}
        <AboutSection />

        <SectionDivider label="// GAMEPLAY" />

        {/* FEATURES + ENEMIES */}
        <FeaturesSection />

        <SectionDivider label="// WORLD EVENT" />

        {/* RAID BOSS */}
        <RaidBossSection />

        <SectionDivider label="// PLAY NOW" />

        {/* LIVE GAME UI */}
        <GameUI />

        <SectionDivider label="// CHAIN DETAILS + ROADMAP" />

        {/* ROADMAP + CELO + MINIPAY */}
        <RoadmapSection />

        <SectionDivider label="// FAQ" />

        {/* FAQ */}
        <FAQSection />

        {/* FINAL CTA */}
        <CTASection />
      </main>

      {/* Footer */}
      <Footer />
    </>
  )
}
