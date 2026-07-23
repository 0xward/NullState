'use client'

// How-to-Play / "The Loop" screen (Phase 2 — reward loop jelas).
//
// A single in-game explainer that makes the core loop obvious WITHOUT sending
// the player to the external /docs page. It reflects the ACTUAL economy the
// game ships with (owner-confirmed):
//   • Burning loot converts it to NullState Point — an IN-GAME, faucet-only
//     currency (spent on Marketplace "Swap" gear). It is NOT withdrawable.
//   • Real STABLECOIN comes from the Treasure Vault (weekly code), the
//     seasonal Leaderboard (top 3), and Season Pass reward tracks.
// If the burn→Point vs burn→stablecoin decision is ever revisited, the Weekly
// card below is the one to update.

interface HowToPlayScreenProps {
  onBack: () => void
}

// The five story bunkers, in order — names mirror CAMPAIGN[].title in
// public/game-engine/story_campaign.js. Each is one Act (5 floors).
const BUNKERS: { name: string; biome: string }[] = [
  { name: 'The Treeline Bunker', biome: 'Forest' },
  { name: 'The Sunken Field', biome: 'Sunken ruins' },
  { name: 'The Frostline Bunker', biome: 'Ice' },
  { name: 'The Hollow Market', biome: 'Dead market' },
  { name: 'The Last Light', biome: 'Finale' },
]

// Small pill marking whether a reward is real money or an in-game token.
function Tag({ kind }: { kind: 'stablecoin' | 'point' }) {
  const isCoin = kind === 'stablecoin'
  return (
    <span
      className={`inline-block rounded-sm px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-[1px] align-middle ${
        isCoin
          ? 'bg-[rgba(0,255,136,0.14)] text-null-green border border-[rgba(0,255,136,0.4)]'
          : 'bg-[rgba(255,190,11,0.12)] text-null-amber border border-[rgba(255,190,11,0.35)]'
      }`}
    >
      {isCoin ? 'USDT' : 'POINT'}
    </span>
  )
}

function LoopCard({
  cadence,
  title,
  accent,
  children,
}: {
  cadence: string
  title: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-md border p-4 sm:p-5"
      style={{ borderColor: `${accent}44`, background: `${accent}0a` }}
    >
      <div className="font-mono text-[9px] tracking-[3px] uppercase mb-1" style={{ color: accent }}>
        {cadence}
      </div>
      <h3 className="font-display font-black text-null-white text-lg sm:text-xl mb-3">{title}</h3>
      <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">{children}</div>
    </div>
  )
}

export default function HowToPlayScreen({ onBack }: HowToPlayScreenProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(0,0,0,0.95)] p-4 sm:p-6 overflow-y-auto">
      <div
        className="absolute pointer-events-none inset-0"
        style={{ background: 'radial-gradient(circle at 50% 25%, rgba(0,255,136,0.08) 0%, transparent 60%)' }}
      />

      <div className="relative z-10 max-w-3xl w-full mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[9px] sm:text-[10px] tracking-[4px] sm:tracking-[6px] text-null-green uppercase mb-1 sm:mb-2">
              // HOW IT WORKS
            </div>
            <h2 className="font-display font-black text-null-white leading-none" style={{ fontSize: 'clamp(28px, 8vw, 48px)' }}>
              THE LOOP
            </h2>
          </div>
          <button
            onClick={onBack}
            className="shrink-0 inline-flex items-center justify-center min-h-11 font-mono text-[10px] sm:text-xs tracking-[1px] sm:tracking-[2px] uppercase text-null-green border border-[rgba(0,255,136,0.4)] px-3 sm:px-4 py-2 transition-all duration-200 hover:border-null-green hover:bg-[rgba(0,255,136,0.05)]"
            style={{ clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)' }}
          >
            ✕ CLOSE
          </button>
        </div>

        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] px-4 py-3 font-mono text-[11px] text-null-muted">
          <span className="flex items-center gap-2"><Tag kind="stablecoin" /> real USDT reward — withdrawable to your wallet</span>
          <span className="flex items-center gap-2"><Tag kind="point" /> NullState Point — in-game only, not cashable</span>
        </div>

        {/* The Loop — three cadences */}
        <div className="grid gap-4 sm:grid-cols-3 mb-10">
          <LoopCard cadence="EVERY RUN" title="Play &amp; Farm" accent="#00ff88">
            <p>Descend the bunkers, clear floors, and loot gear from containers and elites.</p>
            <p>
              Burn loot you don&apos;t need to convert it into <Tag kind="point" /> — then <span className="text-null-acid font-semibold">Swap</span> that
              Point for non-premium Marketplace gear. This is the daily grind-and-gear cycle.
            </p>
          </LoopCard>

          <LoopCard cadence="EVERY WEEK" title="Treasure Vault" accent="#00aaff">
            <p>
              A <span className="text-null-white">Golden Key</span> and a <span className="text-null-white">Code Paper</span> occasionally drop as you
              play (one of each per week).
            </p>
            <p>
              Bring both to the sealed Vault door and enter the weekly 4-digit code (3 tries) for a real <Tag kind="stablecoin" /> payout.
            </p>
          </LoopCard>

          <LoopCard cadence="EVERY SEASON" title="Rank &amp; Pass" accent="#ffaa00">
            <p>
              Climb the seasonal <span className="text-null-white">Leaderboard</span> — the top 3 at season end split a real <Tag kind="stablecoin" /> prize pool (claiming needs that season&apos;s Pass).
            </p>
            <p>
              A <span className="text-null-white">Season Pass</span> (Soulbound NFT) grants the exclusive Warden outfit, daily perks
              (bonus energy or Glitch Shards), and top-3 bonus eligibility.
            </p>
          </LoopCard>
        </div>

        {/* Progression */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// PROGRESSION</div>
          <div className="rounded-md border border-[rgba(0,255,136,0.2)] bg-[rgba(0,255,136,0.03)] p-4 sm:p-6">
            <div className="flex items-baseline gap-3 mb-4 flex-wrap">
              <span className="font-display font-black text-null-white text-3xl sm:text-4xl">5 × 5 = 25</span>
              <span className="font-mono text-[11px] uppercase tracking-[2px] text-null-muted">bunkers × floors = total depths</span>
            </div>

            {/* 5 bunkers, 5 floors each — with the story name of each Act */}
            <div className="flex flex-col gap-2.5 mb-5">
              {BUNKERS.map((bk, bi) => (
                <div key={bk.name} className="flex items-center gap-3">
                  <div className="flex items-baseline gap-2 w-[168px] shrink-0">
                    <span className="font-mono text-[10px] text-null-green shrink-0">B{bi + 1}</span>
                    <span className="font-mono text-[11px] text-null-white leading-tight">{bk.name}</span>
                  </div>
                  <div className="flex gap-1.5">
                    {[1, 2, 3, 4, 5].map(f => (
                      <span
                        key={f}
                        className="inline-block h-4 w-4 rounded-[2px] border border-[rgba(0,255,136,0.35)] bg-[rgba(0,255,136,0.08)]"
                        title={`${bk.name} · Floor ${f} · ${bk.biome}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-null-muted">
              <p className="text-null-white font-semibold">Why come back after a run?</p>
              <p>• Each bunker is a story Act — clear all five floors to move outside and unlock the next.</p>
              <p>• Death is softened: you respawn on the same floor, so a run is never wiped to zero.</p>
              <p>• Gear, weapon tiers, and NullState Point <span className="text-null-white">carry over</span> — every run makes the next one stronger.</p>
              <p>• Deeper acts drop higher-tier crafting shards for better weapons.</p>
              <p>• Clear Act 1 to unlock the <span className="text-null-white">Armory Trial</span> — pick 2 premium weapons to try free for 48h each (clock starts on first equip).</p>
              <p>• Invite friends from the <span className="text-null-white">Referral</span> menu — free weapon trials, a permanent skin at 3 friends, and a free Season Pass when an invitee makes their first purchase.</p>
              <p>• The Vault code resets weekly and the Leaderboard resets each season — fresh <Tag kind="stablecoin" /> to chase on a timer.</p>
              <p>• Finish all 5 Acts to unlock <span className="text-null-white">New Game+</span> — replay the campaign at a higher Cycle: enemies hit +35% harder per Cycle and shards drop +25% richer.</p>
              <p>• …and <span className="text-null-white">THE NULL ABYSS</span> — an endless descent below Bunker 5. Your deepest floor is your season rank (top 3 split the <Tag kind="stablecoin" /> bonus), the deep floors drop the best shards, and death ends the dive.</p>
            </div>
          </div>
        </div>

        {/* Weapon evolution */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-amber mb-3">// WEAPON EVOLUTION</div>
          <div className="rounded-md border border-[rgba(255,190,11,0.2)] bg-[rgba(255,190,11,0.03)] p-4 sm:p-6">
            <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">
              <p>
                Every weapon starts at <span className="text-null-white">Tier 1</span> and can be evolved with
                <span className="text-null-white"> Glitch Shards</span> (crafting material dropped by elites, caches and
                deeper floors). Each step costs matching-tier shards and adds <span className="text-null-white">+20% attack</span>{' '}
                plus a hotter glow — no stat is ever paid for with real money.
              </p>
              <p>
                Push a weapon to its <span className="text-null-white">MAX tier</span> and it awakens a
                <span className="text-null-white"> traversal power</span>:
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                <li>
                  • <span className="text-null-acid font-semibold">Grapple</span> — Void Katana &amp; Sunfire Bow. Opens a
                  <span className="text-null-white"> Chasm Cache</span>.
                </li>
                <li>
                  • <span className="text-null-acid font-semibold">Wall-Melt</span> — Verdant Reaper &amp; Ancient Blade. Opens a
                  <span className="text-null-white"> Frozen Cache</span>.
                </li>
              </ul>
              <p>
                Those sealed caches stay shut until you carry the matching maxed weapon — they hold the richest shard hauls,
                so evolution literally unlocks new loot. <span className="text-null-white">Your Golden Key and Code Paper are
                never locked behind one</span> — they only ever drop in ordinary breakable containers.
              </p>
            </div>
          </div>
        </div>

        {/* The Null Abyss */}
        <div className="mb-8">
          <div className="font-mono text-[10px] tracking-[4px] uppercase text-null-green mb-3">// THE NULL ABYSS</div>
          <div className="rounded-md border border-[rgba(120,80,255,0.28)] bg-[rgba(120,80,255,0.05)] p-4 sm:p-6">
            <div className="flex flex-col gap-2.5 text-[13px] leading-relaxed text-null-muted">
              <p>
                Beat all 5 bunkers to open <span className="text-null-white">THE NULL ABYSS</span> from the title screen — an
                <span className="text-null-white"> endless descent</span> below The Last Light. There is no bottom and no
                lift cap; the floors just keep going and hitting harder.
              </p>
              <ul className="flex flex-col gap-1.5 pl-1">
                <li>• Your <span className="text-null-white">deepest floor</span> this season is your Abyss rank.</li>
                <li>• The top 3 ranks split the seasonal <Tag kind="stablecoin" /> bonus pool.</li>
                <li>• The deep floors drop the <span className="text-null-white">best crafting shards</span> in the game.</li>
                <li>• <span className="text-null-white">Death ends the dive</span> — no respawn — so bank your depth by
                  going as deep as you dare, then dying is how the run is scored.</li>
              </ul>
            </div>
          </div>
        </div>

        <p className="text-center font-mono text-[10px] text-null-muted pb-4">
          Play free, loot free — NULL_STRIKE is free too. You only ever spend real money if you choose to buy premium gear or a Season Pass.
        </p>
      </div>
    </div>
  )
}
