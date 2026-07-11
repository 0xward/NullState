'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * "Floating/Bobbing" — non-linear, stepped y-axis float.
 */
const ps1Float = {
  animate: {
    y: [0, -4, -4, -2, -6, -6, -3, 0, 0, -5, -5, 0],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: 'steps(1)',
      times: [0, 0.08, 0.16, 0.25, 0.33, 0.45, 0.58, 0.66, 0.75, 0.83, 0.91, 1],
    },
  },
}

const ps1FloatSlow = {
  animate: {
    y: [0, 0, -3, -3, -1, -1, -5, -5, -2, -2, 0, 0],
    transition: {
      duration: 3.2,
      repeat: Infinity,
      ease: 'steps(1)',
      times: [0, 0.1, 0.2, 0.3, 0.42, 0.5, 0.6, 0.7, 0.8, 0.88, 0.94, 1],
    },
  },
}

const ps1Jitter = {
  animate: {
    x:      [0, -1, 0,  1,  0,  0,  1,  0, -1, 0],
    y:      [0,  1, 0,  0, -1,  0,  0,  1,  0, 0],
    rotate: [0,  0, 0.3, 0, 0, -0.3, 0,  0,  0, 0],
    transition: {
      duration: 0.9,
      repeat: Infinity,
      repeatDelay: 2.6,
      ease: 'steps(1)',
      times: [0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 1],
    },
  },
}

const ps1JitterLight = {
  animate: {
    x:      [0,  1,  0, -1,  0,  0],
    y:      [0,  0, -1,  0,  1,  0],
    transition: {
      duration: 0.6,
      repeat: Infinity,
      repeatDelay: 4.0,
      ease: 'steps(1)',
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

export default function HeroSection() {
  const [videoLoaded, setVideoLoaded] = useState(false)
  const [shouldLoadVideo, setShouldLoadVideo] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    const enableVideo = () => setShouldLoadVideo(true)
    const idleCallback = window.requestIdleCallback?.(enableVideo)
    const timeoutId = idleCallback === undefined ? window.setTimeout(enableVideo, 0) : undefined
    return () => {
      document.body.style.overflow = ''
      if (idleCallback !== undefined) window.cancelIdleCallback?.(idleCallback)
      if (timeoutId !== undefined) window.clearTimeout(timeoutId)
    }
  }, [])

  return (
    <section className="relative h-[100dvh] w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      {/* Background video loop */}
      <video
        autoPlay={shouldLoadVideo}
        muted
        loop
        playsInline
        preload="none"
        onCanPlay={() => setVideoLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          opacity: videoLoaded ? 0.5 : 0,
          filter: 'saturate(1.15) contrast(1.05)',
          transition: 'opacity 1.2s ease',
        }}
      >
        {shouldLoadVideo && <source src="/video/hero-bg.mp4" type="video/mp4" />}
      </video>

      {/* Dark overlay so text stays readable over the footage */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,0,0,0.45)_0%,rgba(0,0,0,0.8)_75%)]" />
      <div className="absolute inset-0 bg-null-bg opacity-20" />

      {/* Glow orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 900,
          height: 900,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,255,136,0.07) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          animation: 'orbPulse 4s ease-in-out infinite',
        }}
      />

      {/* Content */}
      <div className="relative z-[2] flex flex-col items-center">
        {/* Label */}
        <motion.div
          className="font-mono text-[10px] sm:text-[11px] tracking-[4px] sm:tracking-[6px] text-null-green uppercase mb-4 sm:mb-6"
          style={{ animation: 'fadeUp 0.6s 0.2s both' }}
          variants={ps1JitterLight}
          animate="animate"
        >
          // WEB3 RPG ON CELO
        </motion.div>

        {/* Title */}
        <motion.h1
          className="font-display font-black leading-[0.88] tracking-[-2px] mb-3"
          style={{
            fontSize: 'clamp(52px, 14vw, 140px)',
            animation: 'fadeUp 0.6s 0.4s both',
          }}
          variants={ps1FloatSlow}
          animate="animate"
        >
          <motion.span
            className="block text-null-white"
            variants={ps1Jitter}
            animate="animate"
          >
            NULL
          </motion.span>
          <motion.span
            className="block text-null-green glow-green-strong relative"
            style={{ textShadow: 'var(--null-glow-strong)' }}
            variants={ps1Jitter}
            animate="animate"
            transition={{ delay: 0.45 }}
          >
            STATE
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <div
          className="font-mono text-[11px] sm:text-sm text-null-muted tracking-[2px] sm:tracking-[3px] mb-8 sm:mb-10 uppercase max-w-[300px] sm:max-w-none"
          style={{ animation: 'fadeUp 0.6s 0.6s both' }}
        >
          Every Bug is a Beast. Every Transaction is a War.
        </div>

        {/* CTAs */}
        <div
          className="flex gap-3 sm:gap-4 items-center justify-center flex-wrap"
          style={{ animation: 'fadeUp 0.6s 0.8s both' }}
        >
          <a
            href="/game"
            className="font-mono text-[12px] sm:text-[13px] tracking-[2px] uppercase text-null-bg bg-null-green px-7 sm:px-9 py-3.5 sm:py-4 clip-button inline-flex items-center gap-2 transition-all duration-200 no-underline"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--null-acid)'
              el.style.boxShadow = '0 0 30px rgba(0,255,136,0.6), 0 0 60px rgba(0,255,136,0.2)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--null-green)'
              el.style.boxShadow = 'none'
              el.style.transform = 'translateY(0)'
            }}
          >
            <span>⬡</span> LAUNCH GAME
          </a>
          <a
            href="/docs"
            className="font-mono text-[12px] sm:text-[13px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-7 sm:px-9 py-[13px] sm:py-[15px] inline-flex items-center gap-2 transition-all duration-200 no-underline hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
          >
            <span>◈</span> LEARN MORE
          </a>
        </div>

        {/* Tech tags */}
        <motion.div
          className="flex gap-2 sm:gap-3 justify-center mt-8 sm:mt-12 flex-wrap max-w-[320px] sm:max-w-none"
          style={{ animation: 'fadeUp 0.6s 1.0s both' }}
          variants={ps1Float}
          animate="animate"
        >
          {[
            { label: 'CELO MAINNET',     active: true },
            { label: 'MINIPAY NATIVE',   active: true },
            { label: 'REAL-TIME ACTION', active: true },
            { label: 'THE GATEKEEPER',   active: true },
          ].map(badge => (
            <span
              key={badge.label}
              className="font-mono text-[9px] sm:text-[10px] tracking-[1.5px] sm:tracking-[2px] uppercase px-2.5 sm:px-3 py-1 sm:py-1.5 border text-null-green border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.04)]"
            >
              {badge.label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
