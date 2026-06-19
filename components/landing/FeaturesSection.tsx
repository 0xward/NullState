'use client'

import { motion } from 'framer-motion'

// ── PS1 Animation Variants ────────────────────────────────────────────────────

/**
 * Stepped enemy idle bob — replaces the old smooth `enemyIdle` CSS keyframe.
 * Uses ease:"steps(1)" to create a quantised, frame-skipping effect that
 * mimics low-frame-rate PS1 sprite animation.
 */
const ps1EnemyIdle = {
  animate: {
    y: [0, 0, -3, -3, -6, -6, -3, -3, 0, 0, -2, -2, -5, -5, 0],
    transition: {
      duration: 2.2,
      repeat: Infinity,
      ease: 'steps(1)',           // ← the stepped quantisation
      times: [0, 0.07, 0.14, 0.21, 0.28, 0.35, 0.42, 0.49, 0.56, 0.63, 0.70, 0.77, 0.84, 0.91, 1],
    },
  },
  hover: {
    y: [0, -2, -2, -5, -5, -2, -2, 0, 0, -3, -3, 0],
    filter: 'drop-shadow(0 0 8px rgba(255,34,68,0.7))',
    transition: {
      duration: 1.0,
      repeat: Infinity,
      ease: 'steps(1)',
      times: [0, 0.09, 0.18, 0.27, 0.36, 0.50, 0.62, 0.73, 0.81, 0.90, 0.95, 1],
    },
  },
}

/**
 * Low-frame-rate jitter for enemy sprites on hover — micro x/y shake.
 */
const ps1SpriteJitter = {
  animate: {
    x: [0, -1, 0, 1, 0, 0],
    y: [0,  0, 1, 0, 0, 0],
    transition: {
      duration: 0.5,
      repeat: Infinity,
      repeatDelay: 3.5,
      ease: 'steps(1)',
      times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

export default function FeaturesSection() {
  const steps = [
    {
      num: '01',
      title: 'Connect Wallet',
      desc: 'Open MiniPay or any Celo-compatible wallet. Your address becomes your player identity — no account creation.',
    },
    {
      num: '02',
      title: 'Verify Passport',
      desc: "Celo On-Chain Passport SBT confirms you're human. Prevents bots, grants XP multiplier bonus.",
    },
    {
      num: '03',
      title: 'Enter The Null',
      desc: 'The AI DM spawns your first encounter. Sign the tx — 0.01 CELO — and battle begins.',
    },
    {
      num: '04',
      title: 'Fight. Loot. Die.',
      desc: 'Win to earn XP, CELO, and Artifact NFTs. Die and your hero resets. The chain remembers everything.',
    },
  ]

  const enemies = [
    {
      class: 'NETWORK DAEMON',
      name: 'GAS GOBLIN',
      desc: 'Born from failed transactions. Hoards gas fees as life force. Weakness: smart contract exploits.',
      stats: ['DMG: 15-25', 'HP: 80', 'XP: 45'],
      svgId: 'gas-goblin',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="10" y="15" width="12" height="10" fill="#cc4400"/><rect x="9" y="8" width="14" height="9" fill="#dd5500"/><rect x="7" y="5" width="4" height="6" fill="#cc4400"/><rect x="21" y="5" width="4" height="6" fill="#cc4400"/><rect x="8" y="3" width="2" height="4" fill="#ff7722"/><rect x="22" y="3" width="2" height="4" fill="#ff7722"/><rect x="11" y="10" width="3" height="3" fill="#ffdd00"/><rect x="18" y="10" width="3" height="3" fill="#ffdd00"/><rect x="12" y="11" width="1" height="1" fill="#000"/><rect x="19" y="11" width="1" height="1" fill="#000"/><rect x="12" y="14" width="8" height="2" fill="#660000"/><rect x="7" y="15" width="3" height="7" fill="#cc4400"/><rect x="22" y="15" width="3" height="7" fill="#cc4400"/><rect x="11" y="25" width="4" height="5" fill="#aa3300"/><rect x="17" y="25" width="4" height="5" fill="#aa3300"/><rect x="14" y="18" width="4" height="4" fill="#ffaa00"/></svg>`,
    },
    {
      class: 'CORRUPTED MEMORY',
      name: 'NULL POINTER',
      desc: "An escaped exception. Silently crashes your HP. One false move and it's a stack overflow.",
      stats: ['DMG: 18-28', 'HP: 60', 'XP: 60'],
      svgId: 'null-pointer',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="9" y="9" width="14" height="14" fill="#e0e0e0"/><rect x="11" y="6" width="10" height="6" fill="#e0e0e0"/><rect x="10" y="7" width="12" height="4" fill="#e0e0e0"/><rect x="10" y="12" width="5" height="5" fill="#111"/><rect x="17" y="12" width="5" height="5" fill="#111"/><rect x="12" y="13" width="2" height="2" fill="#ff2244"/><rect x="19" y="13" width="2" height="2" fill="#ff2244"/><rect x="15" y="17" width="2" height="2" fill="#111"/><rect x="10" y="21" width="2" height="3" fill="#fff"/><rect x="13" y="21" width="2" height="3" fill="#fff"/><rect x="16" y="21" width="2" height="3" fill="#fff"/><rect x="19" y="21" width="2" height="3" fill="#fff"/><rect x="9" y="20" width="14" height="4" fill="#c0c0c0"/><rect x="14" y="23" width="4" height="7" fill="#888"/><rect x="7" y="14" width="2" height="8" fill="#888"/><rect x="23" y="14" width="2" height="8" fill="#888"/></svg>`,
    },
    {
      class: 'LIQUIDITY GHOST',
      name: 'RUG PHANTOM',
      desc: 'Materializes when liquidity disappears. Pulls rewards away. Drops rare Phantom Shards.',
      stats: ['DMG: 20-35', 'HP: 100', 'XP: 80'],
      svgId: 'rug-phantom',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="9" y="10" width="14" height="16" fill="#ccbbff"/><rect x="8" y="12" width="16" height="12" fill="#ccbbff"/><rect x="10" y="9" width="12" height="4" fill="#ccbbff"/><rect x="9" y="26" width="3" height="3" fill="#ccbbff"/><rect x="15" y="26" width="3" height="3" fill="#ccbbff"/><rect x="11" y="14" width="4" height="4" fill="#220066"/><rect x="17" y="14" width="4" height="4" fill="#220066"/><rect x="12" y="15" width="2" height="2" fill="#aa44ff"/><rect x="18" y="15" width="2" height="2" fill="#aa44ff"/><rect x="14" y="20" width="4" height="3" fill="#220066"/><rect x="5" y="18" width="3" height="2" fill="#00cc44"/><rect x="24" y="15" width="3" height="2" fill="#00cc44"/></svg>`,
    },
    {
      class: 'CHAIN SPLIT ENTITY',
      name: 'FORK WRAITH',
      desc: 'Exists in two states simultaneously. Impossible to predict. Chain split damage.',
      stats: ['DMG: 25-40', 'HP: 120', 'XP: 100'],
      svgId: 'fork-wraith',
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="10" y="10" width="12" height="12" fill="#4488ff"/><rect x="9" y="12" width="14" height="8" fill="#4488ff"/><rect x="11" y="9" width="10" height="3" fill="#4488ff"/><rect x="12" y="12" width="8" height="8" fill="#6699ff"/><rect x="14" y="11" width="4" height="10" fill="#88aaff"/><rect x="11" y="13" width="3" height="3" fill="#fff"/><rect x="18" y="13" width="3" height="3" fill="#fff"/><rect x="11" y="17" width="3" height="3" fill="#ff4488"/><rect x="18" y="17" width="3" height="3" fill="#ff4488"/><rect x="12" y="22" width="2" height="8" fill="#6699ff"/><rect x="18" y="22" width="2" height="8" fill="#6699ff"/><rect x="12" y="22" width="8" height="2" fill="#6699ff"/></svg>`,
    },
  ]

  return (
    <>
      {/* Gameplay Flow */}
      <section id="gameplay" className="relative py-24 z-[2]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal text-center mb-16">
            <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
              // HOW TO PLAY
            </div>
            <h2
              className="font-display font-bold text-null-white"
              style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
            >
              THE GAMEPLAY <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>LOOP</em>
            </h2>
          </div>

          <div className="reveal relative" style={{ transitionDelay: '0.15s' }}>
            <div className="hidden lg:block absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-null-green via-null-green to-transparent opacity-20" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <div
                  key={step.num}
                  className="reveal relative border border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.02)] p-6 hover:border-[rgba(0,255,136,0.25)] hover:bg-[rgba(0,255,136,0.04)] transition-all duration-300"
                  style={{ transitionDelay: `${0.1 * i}s` }}
                >
                  <div
                    className="font-display font-black text-[52px] leading-none mb-4"
                    style={{ color: 'rgba(0,255,136,0.06)', letterSpacing: '-2px' }}
                  >
                    {step.num}
                  </div>
                  <h3 className="font-display font-bold text-null-white text-[14px] uppercase tracking-wide mb-2">
                    {step.title}
                  </h3>
                  <p className="font-light leading-relaxed text-[13px]" style={{ color: 'rgba(212,255,232,0.5)' }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bestiary */}
      <section id="bestiary" className="relative py-16 z-[2]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal text-center mb-12">
            <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
              // BESTIARY
            </div>
            <h2
              className="font-display font-bold"
              style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
            >
              <span className="text-null-white">ENEMIES OF</span>{' '}
              <em className="text-null-red not-italic" style={{ textShadow: '0 0 20px rgba(255,34,68,0.4)' }}>THE NULL</em>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enemies.map((enemy, i) => (
              <div
                key={enemy.name}
                className="reveal enemy-card border border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.02)] p-5 flex items-start gap-5 hover:border-[rgba(255,34,68,0.3)] hover:bg-[rgba(255,34,68,0.02)] transition-all duration-300"
                style={{ transitionDelay: `${0.1 * i}s` }}
              >
                {/* Sprite — wrapped in Framer Motion for PS1 stepped bob + jitter */}
                <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 64, height: 64 }}>
                  <motion.div
                    variants={ps1EnemyIdle}
                    animate="animate"
                    whileHover="hover"
                  >
                    {/* Light jitter layer — fires independently on a different cadence */}
                    <motion.div
                      variants={ps1SpriteJitter}
                      animate="animate"
                    >
                      <img
                        src={`data:image/svg+xml,${encodeURIComponent(enemy.svg)}`}
                        width={56}
                        height={56}
                        style={{
                          imageRendering: 'pixelated',   // constraint #5 satisfied
                        }}
                        alt={enemy.name}
                      />
                    </motion.div>
                  </motion.div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[9px] text-null-red tracking-[3px] uppercase mb-0.5">{enemy.class}</div>
                  <h3 className="font-display font-bold text-null-white text-[15px] uppercase tracking-wide mb-1.5">{enemy.name}</h3>
                  <p className="font-light leading-relaxed text-[12px] mb-3" style={{ color: 'rgba(212,255,232,0.5)' }}>
                    {enemy.desc}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    {enemy.stats.map(stat => (
                      <span
                        key={stat}
                        className="font-mono text-[9px] text-null-muted border border-[rgba(0,255,136,0.1)] px-2 py-0.5 tracking-wider"
                      >
                        {stat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
