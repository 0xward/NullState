'use client'

import { motion } from 'framer-motion'

const floatVariant = {
  animate: {
    y: [0, 0, -4, -4, -2, -2, -6, -6, -3, -3, 0, 0],
    transition: {
      duration: 2.8, repeat: Infinity, ease: 'steps(1)',
      times: [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54, 0.63, 0.72, 0.81, 0.90, 1],
    },
  },
}

const jitterVariant = {
  animate: {
    x: [0, 1, 0, -1, 0, 0],
    y: [0, 0, -1,  0, 1, 0],
    transition: {
      duration: 0.5, repeat: Infinity, repeatDelay: 5.0,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

export default function GameUI() {
  return (
    <section id="play" className="relative py-24 z-[2]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <motion.div
          className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-4"
          variants={jitterVariant}
          animate="animate"
        >
          // PLAY NOW
        </motion.div>

        <motion.h2
          className="font-display font-bold text-null-white mb-6"
          style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
          variants={floatVariant}
          animate="animate"
        >
          ENTER THE{' '}
          <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>NULL</em>
        </motion.h2>

        <p className="text-[rgba(212,255,232,0.55)] font-light leading-relaxed text-[15px] max-w-lg mx-auto mb-10">
          A real-time dungeon crawler, right in your browser. Pick your Walker, descend
          the Forsaken Depths, and channel on-chain NULL_STRIKEs against elites and The Gatekeeper.
        </p>

        <div className="flex gap-4 justify-center flex-wrap">
          <a href="/game"
            className="font-mono text-[13px] tracking-[2px] uppercase text-null-bg bg-null-green px-10 py-4 inline-flex items-center gap-2 transition-all duration-200 no-underline hover:bg-null-acid"
            style={{
              clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)',
              boxShadow: '0 0 30px rgba(0,255,136,0.25)',
            }}>
            <span>⬡</span> LAUNCH GAME
          </a>
        </div>

        <motion.div
          className="mt-8 font-mono text-[10px] text-null-muted tracking-wider"
          variants={jitterVariant}
          animate="animate"
        >
          Works on MiniPay · MetaMask · Any Celo Wallet
        </motion.div>
      </div>
    </section>
  )
}
