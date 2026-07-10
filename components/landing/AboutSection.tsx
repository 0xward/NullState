'use client'

import { motion } from 'framer-motion'

// ── PS1 Shared Variants ───────────────────────────────────────────────────────

const ps1Float = {
  animate: {
    y: [0, 0, -3, -3, -1, -1, -4, -4, -2, -2, 0, 0],
    transition: { duration: 3.0, repeat: Infinity, ease: 'steps(1)',
      times: [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54, 0.63, 0.72, 0.81, 0.90, 1] },
  },
}

const ps1JitterLight = {
  animate: {
    x: [0, 1, 0, -1, 0, 0],
    y: [0, 0, -1,  0, 1, 0],
    transition: { duration: 0.5, repeat: Infinity, repeatDelay: 5.0,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1] },
  },
}

export default function AboutSection() {
  const pillars = [
    { icon: '🗡️', title: 'Real-Time Dungeon Crawler', description: 'Move with WASD or the joystick, auto-attack roaming monsters, smash loot, and descend procedurally generated floors. Pure action — no menus.', tag: 'ACTION_RPG',  color: 'null-green' },
    { icon: '⛓️', title: 'On-Chain Everything',     description: 'Every kill, death, and artifact is minted or burned on Celo. Your wallet IS your character sheet. The chain never forgets.', tag: 'CELO_L1',       color: 'null-blue'  },
    { icon: '💀', title: 'Permadeath Protocol',     description: "When you die, your progress resets. No restores unless you hold a Resurrection SBT. Death is a mechanic, not a message.", tag: 'HIGH_STAKES',  color: 'null-red'   },
    { icon: '📱', title: 'Mobile-First via MiniPay',description: "Play inside MiniPay — no seed phrases, instant CELO wallet. Built for Africa and Southeast Asia's fastest-growing digital payments app.", tag: 'MINIPAY_NATIVE',color: 'null-amber' },
    { icon: '🌐', title: 'Social Combat',           description: 'Raid Bosses require collective action. Tweet to deal damage. The community fights together or falls together.', tag: 'X_SOCIAL',      color: 'null-green' },
    { icon: '🔮', title: 'Artifact NFTs',           description: 'Legendary drops are real NFTs — tradeable, burnable, transferable. Your weapons exist on-chain as Soul-Bound Tokens.', tag: 'ERC-721 SBT',  color: 'null-acid'  },
  ]

  return (
    <section id="about" className="relative py-24 z-[2]">
      <div className="max-w-6xl mx-auto px-6">

        {/* Header — PS1 jitter on the subtitle label */}
        <div className="reveal text-center mb-16">
          <motion.div
            className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3"
            variants={ps1JitterLight}
            animate="animate"
          >
            // WHAT IS NULLSTATE
          </motion.div>
          <h2 className="font-display font-bold text-null-white mb-4"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}>
            BUILT AT THE INTERSECTION OF<br />
            <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>
              GAMING, AI, AND DEFI
            </em>
          </h2>
          <p className="max-w-[580px] mx-auto text-[17px] font-light leading-relaxed"
            style={{ color: 'rgba(212,255,232,0.55)' }}>
            NullState is not a play-to-earn game. It&apos;s a prove-you-exist game.
            Every move costs real money. Every reward is real value.
            The only thing separating life from death is your strategy.
          </p>
        </div>

        {/* 3x2 grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px reveal"
          style={{ background: 'rgba(0,255,136,0.08)', transitionDelay: '0.15s' }}>
          {pillars.map((pillar, i) => (
            <div key={pillar.title} className="about-card p-8 relative overflow-hidden"
              style={{ background: 'var(--null-bg)', transitionDelay: `${i * 0.05}s` }}>
              <div className="absolute top-0 left-0 w-full h-[2px] scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100"
                style={{ background: `var(--${pillar.color})` }} />

              {/* Number */}
              <div className="font-display font-black text-[52px] leading-none mb-4 transition-colors duration-300"
                style={{ color: 'rgba(0,255,136,0.06)' }}>0{i + 1}</div>

              {/* Icon — PS1 float, staggered by index */}
              <motion.div
                className="text-[26px] mb-3"
                variants={ps1Float}
                animate="animate"
                style={{ display: 'inline-block' }}
                // stagger each icon's phase so they bob independently
                transition={{ delay: i * 0.38 }}
              >
                {pillar.icon}
              </motion.div>

              <h3 className="font-display font-bold text-null-white text-[15px] uppercase tracking-wide mb-3">
                {pillar.title}
              </h3>
              <p className="text-[13px] font-light leading-[1.7] mb-4"
                style={{ color: 'rgba(212,255,232,0.45)' }}>
                {pillar.description}
              </p>
              <span className="inline-block font-mono text-[9px] tracking-[2px] uppercase px-2 py-1 border"
                style={{
                  color: `var(--${pillar.color})`,
                  borderColor:
                    pillar.color === 'null-green' ? 'rgba(0,255,136,0.2)' :
                    pillar.color === 'null-blue'  ? 'rgba(0,170,255,0.2)' :
                    pillar.color === 'null-red'   ? 'rgba(255,34,68,0.2)' :
                    pillar.color === 'null-amber' ? 'rgba(255,170,0,0.2)' :
                    pillar.color === 'null-acid'  ? 'rgba(168,255,62,0.2)' :
                    'rgba(0,255,136,0.2)',
                }}>
                {pillar.tag}
              </span>
            </div>
          ))}
        </div>

        {/* Mission statement — PS1 jitter on the quote marks wrapper */}
        <motion.div
          className="reveal mt-16 border border-[rgba(0,255,136,0.12)] bg-[rgba(0,255,136,0.02)] p-8 text-center"
          style={{ transitionDelay: '0.3s' }}
          variants={ps1JitterLight}
          animate="animate"
        >
          <div className="font-mono text-[10px] tracking-[4px] text-null-muted uppercase mb-3">
            // MISSION STATEMENT
          </div>
          <blockquote className="font-display text-lg md:text-xl text-null-white leading-relaxed max-w-2xl mx-auto" style={{ fontStyle: 'normal' }}>
            &ldquo;We built NullState because we believe the future of gaming is
            <span className="text-null-green" style={{ textShadow: 'var(--null-glow)' }}> permissionless, AI-powered, and economically meaningful.</span>
            No gatekeepers. No publisher fees. Just you, the chain, and the dungeon.&rdquo;
          </blockquote>
          <div className="font-mono text-[10px] text-null-muted tracking-wider mt-4">
            — NULLSTATE CORE TEAM :: BUILT ON CELO
          </div>
        </motion.div>
      </div>
    </section>
  )
}
