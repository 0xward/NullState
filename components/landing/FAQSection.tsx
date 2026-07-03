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
  { q: 'What is NullState?', a: "NullState is a real-time dungeon crawler built on the Celo blockchain. You descend the procedurally generated Forsaken Depths, fight roaming monsters and elites in real time, and face The Gatekeeper boss. Powerful on-chain NULL_STRIKE ultimates are real blockchain transactions costing 0.01 CELO. It's a game where your wallet is literally your character sheet." },
  { q: 'Do I need a crypto wallet to play?', a: "Yes, but setup is instant. NullState is built for MiniPay — just open the MiniPay app (available on Android/iOS in Africa and Southeast Asia), and you're ready to play with built-in CELO balance. No seed phrases, no complex onboarding. Any Celo-compatible wallet (MetaMask, Valora) also works." },
  { q: 'What is CELO and how do I get it?', a: 'CELO is the native currency of the Celo blockchain. You can get it through MiniPay, or through exchanges like Binance, Coinbase, or Uniswap. Each game action costs 0.01 CELO. Gas fees on Celo average $0.001, so you pay almost nothing in infrastructure costs.' },
  { q: 'Is permadeath really permanent?', a: "Yes — when your HP drops to zero, your hero resets to Level 1 and you lose your current dungeon progress. However, your wallet, XP history, and any Artifact NFTs you've minted remain. You can also find or purchase a Resurrection SBT to avoid one death. The stakes are what make victories meaningful." },
  { q: 'What is a Raid Boss and how does social combat work?', a: 'Raid Bosses are massively powerful world enemies that all players fight collectively. Every player in the game can contribute damage. The "Tweet to Attack" feature lets you post to X/Twitter — when you do, a verified webhook registers bonus raid damage to your contribution. The top raider when the boss falls claims special rewards.' },
  { q: 'How does combat work?', a: "It's a real-time action crawler. Move with WASD/arrows or the on-screen joystick; your Walker auto-attacks the nearest monster or breakable when in range. Smash props for HP/XP/CELO loot, level up to grow your HP and power, and step onto the stairs to descend. Every 5th floor is guarded by The Gatekeeper. When an elite, a boss, or near-death moment appears, you can sign an on-chain NULL_STRIKE for devastating damage." },
  { q: 'Are Artifacts real NFTs?', a: 'Yes. Legendary and Epic artifacts are minted as ERC-721 tokens on Celo when you earn them. You can view them in your wallet, transfer them to other players, or hold them for passive bonuses. Common artifacts are stored off-chain in your player profile for speed, but can be minted on-demand for gas cost.' },
  { q: 'What is the Celo Passport and why does it matter?', a: "The Celo On-Chain Passport is a Soul-Bound Token (SBT) that verifies you're a unique human — not a bot. Having it verified gives you a 20% XP boost and unlocks certain Artifact drops. It also protects the game economy from sybil attacks where one person creates hundreds of wallets." },
  { q: 'When is the full game launching?', a: 'The MVP (real-time dungeon crawler + on-chain NULL_STRIKE + MiniPay integration) is live now for Proof of Ship. Artifact NFT minting, deeper zones, and World Events v1 are targeting Q3 2025. Multiplayer raid mechanics and DAO governance launch in Q4 2025. Follow us on X @NullStateRPG for updates.' },
  { q: 'Is the code open source?', a: "Yes. NullState is MIT licensed and the full smart contract and frontend code is available on GitHub. We believe in building in public on Celo. Forks are welcome — but you'll need your own Groq API key and MiniPay integration." },
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
          <a href="https://twitter.com/intent/tweet?text=@NullStateRPG%20question:"
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.2)] px-5 py-2 hover:bg-[rgba(0,255,136,0.05)] hover:border-null-green transition-all no-underline"
            style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}>
            𝕏 ASK ON TWITTER
          </a>
        </div>
      </div>
    </section>
  )
}
