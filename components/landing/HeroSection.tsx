'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

const TYPED_LINES = [
  '> initializing nullstate.exe...',
  '> connecting to celo_mainnet...',
  '> wallet_detected: MiniPay',
  '> loading dungeon_engine: THE_FORSAKEN_DEPTHS',
  '> world_event: THE GATEKEEPER stirs',
  '> status: READY TO FORK',
]

// ── PS1 Animation Variants ────────────────────────────────────────────────────

/**
 * "Floating/Bobbing" — non-linear, stepped y-axis float.
 * Uses discrete keyframes (ease: "steps(1)") to mimic old-school game UI
 * where movement feels quantised rather than fluid.
 */
const ps1Float = {
  animate: {
    y: [0, -4, -4, -2, -6, -6, -3, 0, 0, -5, -5, 0],
    transition: {
      duration: 2.4,
      repeat: Infinity,
      ease: 'steps(1)',       // ← "stepped" — the PS1 secret sauce
      times: [0, 0.08, 0.16, 0.25, 0.33, 0.45, 0.58, 0.66, 0.75, 0.83, 0.91, 1],
    },
  },
}

/**
 * Slower, more deliberate float for the title block.
 */
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

/**
 * "Low-Frame Rate Jitter" — randomised micro-shake on x/y/rotate.
 * Snappy, sparse, deliberate. Not constant — fires with long pauses
 * to feel like the UI is struggling under load.
 */
const ps1Jitter = {
  animate: {
    x:      [0, -1, 0,  1,  0,  0,  1,  0, -1, 0],
    y:      [0,  1, 0,  0, -1,  0,  0,  1,  0, 0],
    rotate: [0,  0, 0.3, 0, 0, -0.3, 0,  0,  0, 0],
    transition: {
      duration: 0.9,
      repeat: Infinity,
      repeatDelay: 2.6,   // ← long silence between jitter bursts
      ease: 'steps(1)',
      times: [0, 0.11, 0.22, 0.33, 0.44, 0.55, 0.66, 0.77, 0.88, 1],
    },
  },
}

/**
 * Faster, lighter jitter for smaller elements (badges, labels).
 */
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
  const [typedLines, setTypedLines] = useState<string[]>([])
  const [currentLine, setCurrentLine] = useState(0)
  const [currentChar, setCurrentChar] = useState(0)

  useEffect(() => {
    if (currentLine >= TYPED_LINES.length) return

    const line = TYPED_LINES[currentLine]

    if (currentChar < line.length) {
      const timeout = setTimeout(() => {
        setCurrentChar(c => c + 1)
      }, 35)
      return () => clearTimeout(timeout)
    } else {
      const timeout = setTimeout(() => {
        setTypedLines(prev => [...prev, line])
        setCurrentLine(l => l + 1)
        setCurrentChar(0)
      }, 200)
      return () => clearTimeout(timeout)
    }
  }, [currentLine, currentChar])

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center text-center px-6 py-32 overflow-hidden z-[2]">
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

      {/* Secondary orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,170,255,0.04) 0%, transparent 70%)',
          top: '30%',
          left: '70%',
          animation: 'orbPulse 6s 2s ease-in-out infinite',
        }}
      />

      {/* Label — PS1 jitter (light) */}
      <motion.div
        className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-6"
        style={{ animation: 'fadeUp 0.6s 0.2s both' }}
        variants={ps1JitterLight}
        animate="animate"
      >
        // WEB3 RPG ON CELO :: AI-POWERED
      </motion.div>

      {/* Title — PS1 slow float + jitter */}
      <motion.h1
        className="font-display font-black leading-[0.88] tracking-[-2px] mb-3"
        style={{
          fontSize: 'clamp(64px, 12vw, 140px)',
          animation: 'fadeUp 0.6s 0.4s both',
        }}
        variants={ps1FloatSlow}
        animate="animate"
      >
        {/* "NULL" — jitter overlay */}
        <motion.span
          className="block text-null-white"
          variants={ps1Jitter}
          animate="animate"
        >
          NULL
        </motion.span>

        {/* "STATE" — offset jitter phase so they don't move identically */}
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
        className="font-mono text-sm text-null-muted tracking-[3px] mb-4 uppercase"
        style={{ animation: 'fadeUp 0.6s 0.6s both' }}
      >
        Every Bug is a Beast. Every Transaction is a War.
      </div>

      {/* Description */}
      <p
        className="max-w-[520px] text-lg font-light leading-relaxed mb-12"
        style={{
          color: 'rgba(212,255,232,0.65)',
          animation: 'fadeUp 0.6s 0.8s both',
        }}
      >
        A real-time dungeon crawler deployed on Celo.
        Descend the Forsaken Depths. Sign an on-chain NULL_STRIKE for 0.01 CELO.
        Death is permanent. Glory is on-chain.
      </p>

      {/* CTAs */}
      <div
        className="flex gap-4 items-center justify-center flex-wrap"
        style={{ animation: 'fadeUp 0.6s 1.0s both' }}
      >
        <a
          href="/game"
          className="font-mono text-[13px] tracking-[2px] uppercase text-null-bg bg-null-green px-9 py-4 clip-button inline-flex items-center gap-2 transition-all duration-200 no-underline"
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
          <span>⬡</span> LAUNCH APP
        </a>
        <a
          href="#about"
          className="font-mono text-[13px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-9 py-[15px] inline-flex items-center gap-2 transition-all duration-200 no-underline hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
          style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
        >
          <span>◈</span> LEARN MORE
        </a>
      </div>

      {/* Tech tags — PS1 float (staggered per-badge) */}
      <motion.div
        className="flex gap-3 justify-center mt-12 flex-wrap"
        style={{ animation: 'fadeUp 0.6s 1.2s both' }}
        variants={ps1Float}
        animate="animate"
      >
        {[
          { label: 'CELO MAINNET',    active: true  },
          { label: 'MINIPAY NATIVE',  active: true  },
          { label: 'REAL-TIME ACTION',active: true  },
          { label: 'THE GATEKEEPER',  active: true  },
          { label: 'PERMADEATH',      active: false },
        ].map(badge => (
          <span
            key={badge.label}
            className={`font-mono text-[10px] tracking-[2px] uppercase px-3 py-1.5 border ${
              badge.active
                ? 'text-null-green border-[rgba(0,255,136,0.3)] bg-[rgba(0,255,136,0.04)]'
                : 'text-null-muted border-null-muted'
            }`}
          >
            {badge.label}
          </span>
        ))}
      </motion.div>

      {/* Terminal mini — unchanged business logic */}
      <div
        className="mt-16 border border-[rgba(0,255,136,0.1)] bg-[rgba(0,0,0,0.3)] max-w-sm w-full text-left"
        style={{ animation: 'fadeUp 0.6s 1.4s both' }}
      >
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[rgba(0,255,136,0.08)] bg-[rgba(0,255,136,0.02)]">
          <div className="w-2 h-2 rounded-full bg-[#ff3b30]" />
          <div className="w-2 h-2 rounded-full bg-[#ffcc02]" />
          <div className="w-2 h-2 rounded-full bg-[#34c759]" />
          <span className="font-mono text-[10px] text-null-muted ml-2 tracking-[2px]">nullstate.exe</span>
        </div>
        <div className="px-4 py-3 font-mono text-[11px] leading-relaxed min-h-[100px]">
          {typedLines.map((line, i) => (
            <div
              key={i}
              className={
                line.includes('READY') ? 'text-null-acid' :
                line.includes('RAID') ? 'text-null-red' :
                line.includes('wallet') || line.includes('connecting') ? 'text-null-blue' :
                'text-[rgba(0,255,136,0.5)]'
              }
            >
              {line}
            </div>
          ))}
          {currentLine < TYPED_LINES.length && (
            <div className="text-[rgba(0,255,136,0.5)]">
              {TYPED_LINES[currentLine].slice(0, currentChar)}
              <span className="t-cursor" />
            </div>
          )}
        </div>
      </div>

      {/* Scroll indicator — PS1 float */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        style={{ animation: 'fadeUp 0.6s 1.8s both' }}
        variants={ps1Float}
        animate="animate"
      >
        <div
          className="w-px h-14 scroll-line"
          style={{ background: 'linear-gradient(to bottom, var(--null-green), transparent)' }}
        />
        <span
          className="font-mono text-[9px] tracking-[3px] text-null-muted uppercase"
          style={{ writingMode: 'vertical-rl' }}
        >
          SCROLL
        </span>
      </motion.div>
    </section>
  )
}
