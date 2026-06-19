'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { db } from '@/lib/firebase'
import {
  collection, onSnapshot, query,
  orderBy, limit, addDoc, serverTimestamp,
} from 'firebase/firestore'

// ── Pixel boss SVG (THE 51% — demon king) ────────────────────────────────────
const BOSS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated">
  <!-- body -->
  <rect x="14" y="22" width="20" height="16" fill="#9900cc"/>
  <!-- head -->
  <rect x="12" y="10" width="24" height="14" fill="#bb00ee"/>
  <!-- horns -->
  <rect x="12" y="4"  width="4" height="8"  fill="#cc00ff"/>
  <rect x="32" y="4"  width="4" height="8"  fill="#cc00ff"/>
  <rect x="10" y="2"  width="4" height="4"  fill="#cc00ff"/>
  <rect x="34" y="2"  width="4" height="4"  fill="#cc00ff"/>
  <!-- eyes glow red -->
  <rect x="15" y="14" width="6" height="4"  fill="#ff0000"/>
  <rect x="27" y="14" width="6" height="4"  fill="#ff0000"/>
  <rect x="16" y="15" width="4" height="2"  fill="#ff6666"/>
  <rect x="28" y="15" width="4" height="2"  fill="#ff6666"/>
  <!-- mouth -->
  <rect x="16" y="20" width="16" height="2" fill="#440066"/>
  <rect x="18" y="19" width="2"  height="2" fill="#ff2244"/>
  <rect x="22" y="19" width="2"  height="2" fill="#ff2244"/>
  <rect x="26" y="19" width="2"  height="2" fill="#ff2244"/>
  <!-- arms -->
  <rect x="6"  y="22" width="8"  height="6" fill="#9900cc"/>
  <rect x="34" y="22" width="8"  height="6" fill="#9900cc"/>
  <rect x="4"  y="26" width="4"  height="4" fill="#cc00ff"/>
  <rect x="40" y="26" width="4"  height="4" fill="#cc00ff"/>
  <!-- claws -->
  <rect x="2"  y="28" width="2"  height="4" fill="#ff00ff"/>
  <rect x="4"  y="30" width="2"  height="4" fill="#ff00ff"/>
  <rect x="42" y="28" width="2"  height="4" fill="#ff00ff"/>
  <rect x="44" y="30" width="2"  height="4" fill="#ff00ff"/>
  <!-- legs -->
  <rect x="14" y="38" width="8"  height="8" fill="#7700aa"/>
  <rect x="26" y="38" width="8"  height="8" fill="#7700aa"/>
  <rect x="12" y="44" width="8"  height="4" fill="#550088"/>
  <rect x="28" y="44" width="8"  height="4" fill="#550088"/>
  <!-- chest mark -->
  <rect x="20" y="26" width="8"  height="6" fill="#ff2244"/>
  <rect x="22" y="24" width="4"  height="2" fill="#ff2244"/>
  <rect x="22" y="32" width="4"  height="2" fill="#ff2244"/>
  <!-- aura -->
  <rect x="10" y="8"  width="2"  height="2" fill="#ff00ff" opacity="0.5"/>
  <rect x="36" y="8"  width="2"  height="2" fill="#ff00ff" opacity="0.5"/>
</svg>`

const BOSS_ENC = encodeURIComponent(BOSS_SVG)

// ── PS1 Animation Variants ────────────────────────────────────────────────────

/**
 * Boss float — large, aggressive stepped bob. The boss should feel
 * heavy and ominous, so the float is wider (0 → -10px) and the steps
 * are very deliberate with long holds at each position.
 */
const ps1BossFloat = {
  animate: {
    y: [0, 0, 0, -4, -4, -8, -8, -8, -4, -4, 0, 0],
    transition: {
      duration: 2.5,
      repeat: Infinity,
      ease: 'steps(1)',
      times: [0, 0.08, 0.16, 0.25, 0.35, 0.44, 0.52, 0.60, 0.70, 0.80, 0.90, 1],
    },
  },
}

/**
 * Boss glow pulse — also stepped, so the aura "flickers" rather than
 * fading smoothly in/out. Layered on top of the float.
 */
const ps1BossGlow = {
  animate: {
    filter: [
      'drop-shadow(0 0 10px rgba(153,0,204,0.5))',
      'drop-shadow(0 0 10px rgba(153,0,204,0.5))',
      'drop-shadow(0 0 24px rgba(255,0,255,0.9))',
      'drop-shadow(0 0 24px rgba(255,0,255,0.9))',
      'drop-shadow(0 0 10px rgba(153,0,204,0.5))',
      'drop-shadow(0 0 18px rgba(255,0,255,0.7))',
      'drop-shadow(0 0 10px rgba(153,0,204,0.5))',
    ],
    transition: {
      duration: 2.0,
      repeat: Infinity,
      ease: 'steps(1)',
      times: [0, 0.14, 0.28, 0.43, 0.57, 0.71, 1],
    },
  },
}

/**
 * Heavy boss jitter — fires less often but hits harder than the hero-screen
 * jitter. Makes the sprite feel unstable and threatening.
 */
const ps1BossJitter = {
  animate: {
    x:      [0, -2,  0,  2,  0,  1,  0, -1,  0],
    y:      [0,  1,  0, -1,  0,  0, -2,  0,  0],
    rotate: [0,  0,  0.5, 0, 0, -0.5, 0, 0.3, 0],
    transition: {
      duration: 0.7,
      repeat: Infinity,
      repeatDelay: 1.8,
      ease: 'steps(1)',
      times: [0, 0.12, 0.25, 0.37, 0.50, 0.62, 0.75, 0.87, 1],
    },
  },
}

interface Raider {
  address: string
  damage:  number
  badge:   string
}

interface FeedEntry {
  player: string
  damage: number
  time:   string
  type:   string
}

export default function RaidBossSection() {
  const [bossHp,       setBossHp]       = useState(8750)
  const [attackers,    setAttackers]    = useState(247)
  const [tweetCount,   setTweetCount]   = useState(1834)
  const [tweeting,     setTweeting]     = useState(false)
  const [recentAttacks, setRecentAttacks] = useState<FeedEntry[]>([
    { player: '0xa1D5..', damage: 45, time: '2s ago',  type: 'tweet'    },
    { player: '0xbF23..', damage: 30, time: '7s ago',  type: 'artifact' },
    { player: '0xc9E1..', damage: 55, time: '12s ago', type: 'tweet'    },
    { player: '0xd4A8..', damage: 22, time: '18s ago', type: 'basic'    },
  ])
  const [topRaiders, setTopRaiders] = useState<Raider[]>([
    { address: '0xa1D5.. (NOMAD)', damage: 450, badge: '🥇' },
    { address: '0xbF23.. (GHOST)', damage: 380, badge: '🥈' },
    { address: '0xc9E1.. (NULL)',  damage: 290, badge: '🥉' },
  ])

  // ── Firebase: live leaderboard ──────────────────────────────────────────────
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'raidAttacks'),
        orderBy('totalDamage', 'desc'),
        limit(3)
      )
      const unsub = onSnapshot(q, snap => {
        const medals = ['🥇', '🥈', '🥉']
        const raiders: Raider[] = snap.docs.map((doc, i) => ({
          address: doc.data().displayAddress ?? doc.id,
          damage:  doc.data().totalDamage    ?? 0,
          badge:   medals[i] ?? '🏅',
        }))
        if (raiders.length > 0) setTopRaiders(raiders)
      })
      return () => unsub()
    } catch { /* Firebase not configured yet */ }
  }, [])

  // ── Firebase: live feed ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'raidFeed'),
        orderBy('createdAt', 'desc'),
        limit(4)
      )
      const unsub = onSnapshot(q, snap => {
        if (snap.empty) return
        const feed: FeedEntry[] = snap.docs.map(doc => ({
          player: doc.data().displayAddress ?? '0x????',
          damage: doc.data().damage         ?? 0,
          time:   'just now',
          type:   doc.data().type           ?? 'basic',
        }))
        setRecentAttacks(feed)
      })
      return () => unsub()
    } catch { /* Firebase not configured yet */ }
  }, [])

  // ── Tweet attack handler ────────────────────────────────────────────────────
  const handleTweetAttack = async () => {
    if (tweeting) return
    setTweeting(true)

    const tweetText = encodeURIComponent(
      `⚔️ Attacking THE 51% in @NullStateGame! Join the raid — every tweet deals 25 damage!\n\n🔗 nullstate.xyz/game\n#NullState #CeloRPG #Web3Gaming`
    )
    window.open(`https://x.com/intent/tweet?text=${tweetText}`, '_blank')

    try {
      await addDoc(collection(db, 'raidAttacks'), {
        displayAddress: 'anonymous',
        totalDamage:    25,
        createdAt:      serverTimestamp(),
      })
      await addDoc(collection(db, 'raidFeed'), {
        displayAddress: 'you',
        damage:         25,
        type:           'tweet',
        createdAt:      serverTimestamp(),
      })
    } catch { /* Firebase not configured */ }

    setBossHp(prev => Math.max(0, prev - 25))
    setTweetCount(prev => prev + 1)

    setTimeout(() => setTweeting(false), 3000)
  }

  const hpPercent   = (bossHp / 10000) * 100
  const phase       = bossHp > 6666 ? 1 : bossHp > 3333 ? 2 : 3
  const phaseColors = { 1: '#ff2244', 2: '#ff6600', 3: '#ff0000' }

  return (
    <section id="raid" className="relative py-24 z-[2] overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at center, rgba(255,34,68,0.04) 0%, transparent 60%)',
      }} />

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="reveal text-center mb-12">
          <div className="font-mono text-[10px] tracking-[5px] text-null-red uppercase mb-3">
            // WORLD EVENT ACTIVE
          </div>
          <h2
            className="font-display font-bold mb-3"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1, color: 'var(--null-white)' }}
          >
            RAID BOSS:{' '}
            <em className="not-italic" style={{ color: 'var(--null-red)', textShadow: '0 0 30px rgba(255,34,68,0.5)' }}>
              THE 51%
            </em>
          </h2>
          <p className="font-mono text-[11px] tracking-[3px] text-null-muted uppercase">
            CONSENSUS DESTROYER · PHASE {phase} · {attackers} RAIDERS ACTIVE
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Boss panel */}
          <div className="reveal" style={{ transitionDelay: '0.1s' }}>
            <div className="border border-[rgba(255,34,68,0.3)] bg-[rgba(255,34,68,0.03)] p-6 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] terminal-scan" />

              {/* Boss pixel sprite — PS1 float + glow + jitter */}
              <div className="text-center mb-6">
                <div className="inline-block">
                  {/* Outer: stepped float (y-axis bob) */}
                  <motion.div
                    variants={ps1BossFloat}
                    animate="animate"
                  >
                    {/* Middle: stepped glow flicker */}
                    <motion.div
                      variants={ps1BossGlow}
                      animate="animate"
                    >
                      {/* Inner: occasional x/y/rotate jitter */}
                      <motion.div
                        variants={ps1BossJitter}
                        animate="animate"
                      >
                        <img
                          src={`data:image/svg+xml,${BOSS_ENC}`}
                          width={96}
                          height={96}
                          style={{ imageRendering: 'pixelated' }}  // constraint #5 satisfied
                          alt="THE 51%"
                        />
                      </motion.div>
                    </motion.div>
                  </motion.div>
                </div>
                <div
                  className="font-display font-black text-[24px] tracking-[4px] mt-2"
                  style={{ color: 'var(--null-red)', textShadow: '0 0 20px rgba(255,34,68,0.5)' }}
                >
                  THE 51%
                </div>
                <div className="font-mono text-[10px] tracking-[3px] text-null-muted uppercase mt-1">
                  Consensus Destroyer · Phase {phase}
                </div>
              </div>

              {/* HP Bar */}
              <div className="mb-2 flex justify-between font-mono text-[10px] text-null-muted">
                <span>BOSS HP</span>
                <span className="text-null-red">{bossHp.toLocaleString()} / 10,000</span>
              </div>
              <div className="h-4 bg-[rgba(255,255,255,0.05)] relative overflow-hidden mb-4">
                <div
                  className="h-full transition-all duration-700 relative"
                  style={{
                    width: `${hpPercent}%`,
                    background: `linear-gradient(90deg, ${phaseColors[phase as keyof typeof phaseColors]}, rgba(255,100,100,0.8))`,
                    boxShadow: `0 0 12px ${phaseColors[phase as keyof typeof phaseColors]}`,
                  }}
                >
                  <div className="absolute inset-0 opacity-20" style={{
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(255,255,255,0.3) 4px, rgba(255,255,255,0.3) 8px)',
                  }} />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: 'Raiders',   value: attackers.toLocaleString()  },
                  { label: 'Tweets',    value: tweetCount.toLocaleString() },
                  { label: 'Time Left', value: '47h 23m'                   },
                ].map(s => (
                  <div key={s.label} className="text-center border border-[rgba(255,34,68,0.15)] bg-[rgba(255,34,68,0.02)] py-2">
                    <div className="font-display font-bold text-null-red text-base">{s.value}</div>
                    <div className="font-mono text-[8px] text-null-muted tracking-wider uppercase mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Reward */}
              <div className="border border-[rgba(255,170,0,0.2)] bg-[rgba(255,170,0,0.04)] px-4 py-3 mb-4">
                <div className="font-mono text-[9px] text-null-amber tracking-[3px] uppercase mb-1">// KILL REWARD</div>
                <div className="font-hud text-null-white text-[13px]">🏆 Legendary Artifact Drop + 1 CELO to Top Raider</div>
              </div>

              {/* Tweet button */}
              <button
                onClick={handleTweetAttack}
                disabled={tweeting}
                className="w-full font-mono text-[12px] tracking-[2px] uppercase font-bold py-3 flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-70"
                style={{
                  background: tweeting ? 'rgba(29,155,240,0.5)' : 'linear-gradient(90deg, #1d9bf0, #0d8fd0)',
                  clipPath: 'polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)',
                  boxShadow: tweeting ? 'none' : '0 0 20px rgba(29,155,240,0.3)',
                }}
              >
                {tweeting ? <>✓ TWEET SENT — DAMAGE REGISTERED</> : <>𝕏 TWEET TO ATTACK THE BOSS</>}
              </button>
              <p className="font-mono text-[9px] text-null-muted text-center mt-2 tracking-wider">
                Every tweet = 25 bonus raid damage
              </p>
            </div>
          </div>

          {/* Live feed + leaderboard */}
          <div className="space-y-4">
            {/* Live feed */}
            <div className="reveal border border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.01)]" style={{ transitionDelay: '0.2s' }}>
              <div className="px-4 py-2 border-b border-[rgba(0,255,136,0.08)] flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
                <span className="font-mono text-[10px] text-null-green tracking-[3px]">● LIVE RAID FEED</span>
              </div>
              <div className="divide-y divide-[rgba(0,255,136,0.05)]">
                {recentAttacks.map((attack, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm">
                        {attack.type === 'tweet' ? '𝕏' : attack.type === 'artifact' ? '⚔️' : '👊'}
                      </span>
                      <span className="font-mono text-[10px] text-null-muted">{attack.player}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display text-null-red text-[11px] font-bold">-{attack.damage} HP</span>
                      <span className="font-mono text-[9px] text-null-muted">{attack.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TOP RAIDERS — Firebase leaderboard */}
            <div className="reveal border border-[rgba(255,170,0,0.15)] bg-[rgba(255,170,0,0.02)]" style={{ transitionDelay: '0.3s' }}>
              <div className="px-4 py-2 border-b border-[rgba(255,170,0,0.1)] flex items-center justify-between">
                <span className="font-mono text-[10px] text-null-amber tracking-[3px]">🏆 TOP RAIDERS</span>
                <span className="font-mono text-[8px] text-null-muted tracking-wider">LIVE · FIREBASE</span>
              </div>
              {topRaiders.map(raider => (
                <div
                  key={raider.address}
                  className="px-4 py-2.5 flex items-center justify-between border-b border-[rgba(255,170,0,0.06)] last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span>{raider.badge}</span>
                    <span className="font-mono text-[10px] text-null-muted">{raider.address}</span>
                  </div>
                  <span className="font-display text-null-amber text-sm font-bold">{raider.damage.toLocaleString()}</span>
                </div>
              ))}
            </div>

            {/* How it works */}
            <div className="reveal border border-[rgba(0,255,136,0.08)] bg-[rgba(0,255,136,0.01)] p-4" style={{ transitionDelay: '0.35s' }}>
              <div className="font-mono text-[9px] text-null-muted tracking-[3px] uppercase mb-3">// HOW SOCIAL COMBAT WORKS</div>
              <div className="space-y-2">
                {[
                  ['1', 'Connect your MiniPay wallet'],
                  ['2', 'Enter the raid — costs 0.01 CELO'],
                  ['3', 'Click "Tweet to Attack" — compose tweet'],
                  ['4', 'Tweet goes live — 25 bonus damage registered'],
                  ['5', 'Top raider when boss dies claims reward'],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-start gap-3">
                    <span className="font-display text-null-green text-[11px] font-bold flex-shrink-0">0{num}</span>
                    <span className="font-mono text-[10px] text-null-muted leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
