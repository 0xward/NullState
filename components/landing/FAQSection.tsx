'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

const jitterVariant = {
  animate: {
    x: [0, 1, 0, -1, 0, 0],
    y: [0, 0, -1,  0, 1, 0],
    transition: {
      duration: 0.5, repeat: Infinity, repeatDelay: 6.0,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

const faqs = [
  { q: 'What is NullState?', a: 'NullState is a real-time dungeon crawler built on the Celo blockchain. You pick a class, descend through procedurally generated bunkers, fight enemies, and loot containers. Your wallet is your identity — no separate account or sign-up.' },
  { q: 'Do I need a wallet app to play?', a: "Yes, but setup is instant. NullState is built for MiniPay — just open the MiniPay app and you're ready to play. Any injected Celo wallet also works (MetaMask browser extension). WalletConnect, Rainbow, and Coinbase Wallet are not integrated." },
  { q: 'What is USDM and how do I get it?', a: 'USDM (Mento Dollar) is a stablecoin on Celo, worth about $1. You can receive it through MiniPay or an exchange that supports Celo. You can pay for the Marketplace and Season Pass in USDM, USDC, or USDT — whichever you hold the most of. Game rewards (Vault Quest and the seasonal leaderboard) always pay out in USDT.' },
  { q: 'Is permadeath really permanent?', a: "Softened. When your HP drops to zero, you respawn on the same floor you died on with full HP — not back at floor 1. Loot you haven't burned carries with you across bunkers until you spend it." },
  { q: 'What is the Golden Key and the Treasure Vault?', a: 'The Golden Key and a Code Paper occasionally drop from certain containers as you loot — capped at one of each per wallet per week. Bring both to the sealed Vault door and enter the weekly 4-digit code (3 attempts) for a real USDT reward.' },
  { q: 'How does combat work?', a: "It's real-time, not turn-based. Move with WASD/arrows or the on-screen joystick, auto-attack nearby enemies, smash containers for loot, and clear every enemy on a floor to unlock the next one via the Lift. When it counts, trigger NULL_STRIKE — a free ultimate on a short cooldown." },
  { q: 'What happens when I burn items?', a: 'Burning permanently removes an item from your inventory and instantly credits NullState Point — an off-chain, in-game currency spendable on lower-priced Marketplace gear via the Swap button. It is not real money and cannot be withdrawn.' },
  { q: 'What does a Season Pass do?', a: 'A Season Pass is a non-transferable (Soulbound) NFT that gives you normal item drop rates for the season. Without a pass you can still play and earn, just with lower odds at rare-and-up items. Pass price is set on-chain and payable in USDM, USDC, or USDT.' },
  { q: 'How does the leaderboard work?', a: 'Each month, players are ranked by a combined score across USDT earned, items collected, kills, active days, and vault codes solved. The top 3 at season end split a real USDT prize pool.' },
  { q: 'Is the code open source?', a: 'Yes. NullState is MIT licensed and the frontend and smart contracts are available on GitHub.' },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="relative py-24 z-[2]">
      <div className="max-w-3xl mx-auto px-6">

        {/* Header */}
        <div className="reveal text-center mb-14">
          <motion.div
            className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3"
            variants={jitterVariant}
            animate="animate"
          >
            // FREQUENTLY ASKED
          </motion.div>
          <h2 className="font-display font-bold text-null-white"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}>
            QUESTIONS &amp;{' '}
            <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>ANSWERS</em>
          </h2>
        </div>

        {/* FAQ list */}
        <div className="reveal space-y-0 border border-[rgba(0,255,136,0.1)]" style={{ transitionDelay: '0.1s' }}>
          {faqs.map((faq, i) => (
            <div key={i}
              className={`faq-item border-b border-[rgba(0,255,136,0.06)] last:border-0 ${openIndex === i ? 'open' : ''}`}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left hover:bg-[rgba(0,255,136,0.02)] transition-colors duration-200"
              >
                <div className="flex items-start gap-3 flex-1">
                  {/* Index — subtle jitter on active item */}
                  {openIndex === i ? (
                    <motion.span
                      className="font-mono text-[10px] text-null-green mt-0.5 tracking-wider flex-shrink-0"
                      variants={jitterVariant}
                      animate="animate"
                    >
                      {String(i + 1).padStart(2, '0')}
                    </motion.span>
                  ) : (
                    <span className="font-mono text-[10px] text-null-green mt-0.5 tracking-wider flex-shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  )}
                  <span className="font-hud font-semibold text-null-white text-[15px] leading-snug">{faq.q}</span>
                </div>
                <span className="font-mono text-null-green text-lg flex-shrink-0 mt-0.5 transition-transform duration-300"
                  style={{ transform: openIndex === i ? 'rotate(45deg)' : 'rotate(0deg)' }}>
                  +
                </span>
              </button>

              <div className="overflow-hidden transition-all duration-300"
                style={{ maxHeight: openIndex === i ? '400px' : '0', opacity: openIndex === i ? 1 : 0 }}>
                <div className="px-5 pb-5 pl-14">
                  <p className="text-[14px] font-light leading-[1.8]"
                    style={{ color: 'rgba(212,255,232,0.55)' }}>{faq.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Still have questions */}
        <div className="reveal mt-10 text-center" style={{ transitionDelay: '0.2s' }}>
          <p className="font-mono text-[11px] text-null-muted tracking-wider mb-3">Still have questions?</p>
          <a href="https://x.com/intent/tweet?text=@NullStateRPG%20question:"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.2)] px-5 py-2 hover:bg-[rgba(0,255,136,0.05)] hover:border-null-green transition-all no-underline"
            style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}>
            𝕏 ASK ON TWITTER
          </a>
        </div>
      </div>
    </section>
  )
}
