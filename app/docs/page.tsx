import Link from 'next/link'
import Navbar from '@/components/ui/Navbar'
import Footer from '@/components/ui/Footer'

const TOC = [
  { id: 'overview',  label: 'Overview' },
  { id: 'mechanics', label: 'Game Mechanics' },
  { id: 'chain',     label: 'Chain & Wallet' },
  { id: 'roadmap',   label: 'Roadmap' },
  { id: 'faq',       label: 'FAQ' },
]

export const metadata = {
  title: 'Docs — NULL_STATE',
  description: 'Documentation for NULL_STATE, a real-time dungeon crawler deployed on Celo.',
}

export default function DocsPage() {
  return (
    <>
      <Navbar />

      <main className="relative z-[2] max-w-3xl mx-auto px-6 pt-32 pb-24">
        {/* Header */}
        <div className="mb-16 border-b border-[rgba(0,255,136,0.15)] pb-10">
          <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
            // DOCUMENTATION
          </div>
          <h1
            className="font-display font-bold text-null-white mb-4"
            style={{ fontSize: 'clamp(32px, 6vw, 52px)', lineHeight: 1.1 }}
          >
            NULL_STATE
          </h1>
          <p className="text-null-muted text-base leading-relaxed max-w-[560px]">
            A real-time dungeon crawler deployed on the Celo blockchain. This page
            covers how the game works, how actions are settled on-chain, and what
            to expect as a player.
          </p>
        </div>

        {/* Table of contents */}
        <nav className="mb-16">
          <div className="font-mono text-[10px] tracking-[3px] text-null-muted uppercase mb-3">
            Contents
          </div>
          <ul className="flex flex-col gap-2 font-mono text-sm">
            {TOC.map((item, i) => (
              <li key={item.id}>
                <Link
                  href={`#${item.id}`}
                  className="text-null-green hover:text-null-acid transition-colors no-underline"
                >
                  {String(i + 1).padStart(2, '0')}. {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Overview */}
        <section id="overview" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Overview
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <p>
              NULL_STATE is a top-down, real-time dungeon crawler. Players descend
              through a procedurally themed dungeon called the Forsaken Depths,
              fighting enemies, collecting loot, and gaining experience.
            </p>
            <p>
              Every meaningful in-game action — combat, raid participation, and
              character registration — is settled as a transaction on Celo
              mainnet. There is no separate in-game currency: CELO is spent
              directly to act, and rewards are paid out in CELO and on-chain
              artifacts.
            </p>
            <p>
              Death is permanent within a run. When a character dies, its level,
              experience, and artifacts reset, and the player starts over.
            </p>
          </div>
        </section>

        {/* Game Mechanics */}
        <section id="mechanics" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Game Mechanics
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Registration
              </h3>
              <p>
                Connecting a Celo-compatible wallet (including MiniPay) and
                registering creates a player record on-chain. No separate
                account or sign-up is required — the wallet address is the
                player identity.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Passport Verification
              </h3>
              <p>
                Verifying with Celo&apos;s on-chain Passport confirms a player is
                human and grants a permanent experience bonus on future actions.
                This step is optional but recommended.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Combat
              </h3>
              <p>
                Actions — attack, defend, inspect, flee, or use an artifact — are
                resolved by the game engine and then confirmed with a signed
                transaction costing a small, fixed amount of CELO. Damage dealt,
                damage taken, and experience gained are recorded on-chain.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Loot & Artifacts
              </h3>
              <p>
                Defeating enemies has a chance to drop an artifact of common,
                rare, epic, or legendary rarity. Artifact odds improve as a
                character levels up. Artifacts are stored on-chain per player.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Raid Bosses
              </h3>
              <p>
                Raid bosses are large, time-limited world enemies. Any registered
                player can contribute damage by submitting an attack transaction.
                The player with the highest total contribution when the boss is
                defeated receives a share of the treasury as a reward.
              </p>
            </div>
            <div>
              <h3 className="text-null-green font-mono text-xs tracking-[2px] uppercase mb-2">
                Death & Respawn
              </h3>
              <p>
                Reaching zero health ends the run. Respawning resets level,
                experience, and artifacts back to their starting values. Kill
                and death counts on the player record persist across runs.
              </p>
            </div>
          </div>
        </section>

        {/* Chain & Wallet */}
        <section id="chain" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Chain & Wallet
          </h2>
          <div className="pl-4 flex flex-col gap-4 text-[15px] leading-relaxed text-null-muted">
            <p>
              NULL_STATE runs on Celo mainnet. Every action that changes game
              state is a normal Celo transaction — there is no custodial backend
              holding player funds or progress.
            </p>
            <ul className="flex flex-col gap-2 font-mono text-sm">
              <li>
                <span className="text-null-green">Network</span> — Celo Mainnet
                (chain ID 42220)
              </li>
              <li>
                <span className="text-null-green">Wallet support</span> — MiniPay,
                and any wallet compatible with Celo (MetaMask, Rainbow, Coinbase
                Wallet, WalletConnect)
              </li>
              <li>
                <span className="text-null-green">Action cost</span> — a fixed
                amount of CELO per combat or raid action
              </li>
              <li>
                <span className="text-null-green">License</span> — MIT, source
                available on GitHub
              </li>
            </ul>
            <p>
              Because progress is on-chain, a player&apos;s character, level, and
              artifacts are tied to their wallet address and are readable by
              anyone through a Celo block explorer.
            </p>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="mb-16 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            Roadmap
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            {[
              {
                phase: 'Phase 01 — Genesis',
                status: 'Live',
                items: [
                  'Real-time dungeon engine',
                  'MiniPay integration',
                  'On-chain combat actions',
                  'Celo Passport verification',
                  'Raid boss v1',
                ],
              },
              {
                phase: 'Phase 02 — Expansion',
                status: 'Planned',
                items: [
                  'Artifact NFT minting (ERC-721)',
                  'Additional dungeon zones',
                  'On-chain leaderboard',
                  'Referral rewards',
                ],
              },
              {
                phase: 'Phase 03 — Protocol Wars',
                status: 'Planned',
                items: [
                  'Multiplayer raid improvements',
                  'DAO-style governance',
                  'PvP arena mode',
                ],
              },
              {
                phase: 'Phase 04 — Null Protocol',
                status: 'Exploratory',
                items: [
                  'Full world persistence',
                  'Cross-chain bridges',
                  'Tournament seasons',
                ],
              },
            ].map((p) => (
              <div key={p.phase}>
                <div className="flex items-baseline gap-3 mb-2">
                  <h3 className="text-null-white font-mono text-sm tracking-[1px]">
                    {p.phase}
                  </h3>
                  <span className="font-mono text-[10px] tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.3)] px-2 py-0.5">
                    {p.status}
                  </span>
                </div>
                <ul className="list-none flex flex-col gap-1">
                  {p.items.map((item) => (
                    <li key={item} className="pl-4 relative before:content-['-'] before:absolute before:left-0 before:text-null-green">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="mb-8 scroll-mt-24">
          <h2 className="font-display font-bold text-null-white text-2xl mb-4 border-l-2 border-null-green pl-4">
            FAQ
          </h2>
          <div className="pl-4 flex flex-col gap-6 text-[15px] leading-relaxed text-null-muted">
            {[
              {
                q: 'What does it cost to play?',
                a: 'Registering a character is free. Combat and raid actions each cost a small, fixed amount of CELO, paid directly to the smart contract as part of the transaction.',
              },
              {
                q: 'What happens when my character dies?',
                a: 'Death is permanent for that run. Level, experience, and artifacts reset to their starting values. Your wallet stays registered, and lifetime kill and death counts are preserved.',
              },
              {
                q: 'How does a Raid Boss work?',
                a: 'A Raid Boss is a shared, time-limited encounter. Any registered player can submit an attack transaction to contribute damage. When the boss is defeated, the player with the highest total contribution receives a share of the treasury.',
              },
              {
                q: 'Is the code open source?',
                a: 'Yes. The smart contract and frontend are MIT licensed and available on GitHub.',
              },
              {
                q: 'Is the smart contract audited?',
                a: 'The contract has not undergone a formal third-party audit. Play with amounts you are comfortable risking, as with any early-stage on-chain application.',
              },
              {
                q: 'Which wallets are supported?',
                a: 'MiniPay is supported natively. Any other Celo-compatible wallet — MetaMask, Rainbow, Coinbase Wallet, or WalletConnect — also works.',
              },
            ].map((item) => (
              <div key={item.q}>
                <h3 className="text-null-white font-mono text-sm mb-1.5">{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Back to launch */}
        <div className="pt-10 border-t border-[rgba(0,255,136,0.15)] flex justify-center">
          <a
            href="/game"
            className="font-mono text-[12px] tracking-[2px] uppercase text-null-bg bg-null-green px-8 py-3.5 inline-flex items-center gap-2 transition-all duration-200 no-underline hover:bg-null-acid"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)' }}
          >
            Launch Game
          </a>
        </div>
      </main>

      <Footer />
    </>
  )
}
