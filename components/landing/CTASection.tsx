'use client'

import { motion } from 'framer-motion'

// ── PS1 Variants ──────────────────────────────────────────────────────────────

/** Big title float — slow and dramatic for the CTA hero text */
const ps1FloatHeavy = {
  animate: {
    y: [0, 0, 0, -5, -5, -5, -2, -2, -8, -8, -3, -3, 0, 0],
    transition: {
      duration: 3.6, repeat: Infinity, ease: 'steps(1)',
      times: [0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.50, 0.57, 0.64, 0.72, 0.82, 0.91, 1],
    },
  },
}

/** Jitter on "READY TO FORK" — makes it feel volatile */
const ps1Jitter = {
  animate: {
    x:      [0, -2,  0,  2,  0,  1,  0, -1, 0],
    y:      [0,  1,  0, -1,  0,  0, -2,  0, 0],
    rotate: [0,  0, 0.4, 0,  0, -0.4, 0, 0.2, 0],
    transition: {
      duration: 0.8, repeat: Infinity, repeatDelay: 2.2,
      ease: 'steps(1)',
      times: [0, 0.12, 0.25, 0.37, 0.50, 0.62, 0.75, 0.87, 1],
    },
  },
}

/** Light jitter for the decorative label at the top */
const ps1JitterLight = {
  animate: {
    x: [0, 1, 0, -1, 0, 0],
    y: [0, 0, -1,  0, 1, 0],
    transition: {
      duration: 0.5, repeat: Infinity, repeatDelay: 4.5,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

export default function CTASection() {
  return (
    <section className="relative py-32 text-center z-[2] overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: `
          radial-gradient(ellipse at center, rgba(0,255,136,0.08) 0%, transparent 60%),
          linear-gradient(to bottom, transparent, rgba(0,255,136,0.03), transparent)
        `,
      }} />

      <div className="relative max-w-3xl mx-auto px-6">
        {/* Label — light jitter */}
        <motion.div
          className="reveal font-mono text-[11px] tracking-[3px] text-null-muted uppercase mb-8"
          variants={ps1JitterLight}
          animate="animate"
        >
          // INITIATING_SEQUENCE :: PLAYER_REGISTRATION_OPEN
        </motion.div>

        {/* Title block — float + jitter */}
        <motion.h2
          className="reveal font-display font-black mb-6"
          style={{ fontSize: 'clamp(48px, 9vw, 96px)', lineHeight: 0.95, transitionDelay: '0.1s' }}
          variants={ps1FloatHeavy}
          animate="animate"
        >
          <span className="block text-null-white">ARE YOU</span>

          {/* "READY TO FORK" gets its own stepped jitter — slightly offset */}
          <motion.strong
            className="block not-italic"
            style={{ color: 'var(--null-green)', fontWeight: 900, textShadow: 'var(--null-glow-strong)' }}
            variants={ps1Jitter}
            animate="animate"
          >
            READY<br />TO FORK?
          </motion.strong>
        </motion.h2>

        <p className="reveal text-center max-w-md mx-auto text-[17px] font-light leading-relaxed mb-12"
          style={{ color: 'rgba(212,255,232,0.6)', transitionDelay: '0.2s' }}>
          Your wallet contains your legend. Your contracts forge your weapons.
          The chain never lies. Enter NullState — where every bug is a beast
          and every transaction is a war.
        </p>

        <div className="reveal flex gap-4 items-center justify-center flex-wrap"
          style={{ transitionDelay: '0.3s' }}>
          <a href="/game"
            className="font-mono text-[13px] tracking-[2px] uppercase text-null-bg bg-null-green px-10 py-4 inline-flex items-center gap-2 transition-all duration-200 no-underline"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--null-acid)'
              el.style.boxShadow = '0 0 40px rgba(0,255,136,0.6), 0 0 80px rgba(0,255,136,0.2)'
              el.style.transform = 'translateY(-2px)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLElement
              el.style.background = 'var(--null-green)'
              el.style.boxShadow = 'none'
              el.style.transform = 'translateY(0)'
            }}>
            <span>⬡</span> LAUNCH APP
          </a>
          <a href="https://github.com" rel="noopener noreferrer"
            className="font-mono text-[13px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-10 py-[15px] inline-flex items-center gap-2 transition-all duration-200 no-underline hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}>
            <span>◈</span> VIEW SOURCE
          </a>
        </div>

        {/* Decorative bottom line */}
        <div className="reveal mt-16 flex items-center gap-4" style={{ transitionDelay: '0.4s' }}>
          <div className="flex-1 h-px bg-[rgba(0,255,136,0.08)]" />
          <motion.span
            className="font-mono text-[9px] tracking-[3px] text-null-muted"
            variants={ps1JitterLight}
            animate="animate"
          >
            NULLSTATE :: CELO :: 2025
          </motion.span>
          <div className="flex-1 h-px bg-[rgba(0,255,136,0.08)]" />
        </div>
      </div>
    </section>
  )
}
