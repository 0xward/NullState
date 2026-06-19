'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useWallet, NULLSTATE_ADDRESS, PlayerData, RaidData } from '@/lib/WalletProvider'
import { Enemy, NarrativeMessage, GameAction, ENEMIES, INITIAL_PLAYER, COMBAT_ACTIONS } from '@/lib/game-types'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'

// ── Types ─────────────────────────────────────────────────────────────────────
type GamePhase = 'char_select' | 'menu' | 'registering' | 'combat' | 'zone_transition' | 'victory' | 'dead' | 'loading'
type CharChoice = 'male' | 'female'
type PlayerAnimState = 'idle' | 'walk' | 'attack' | 'hit'
type EnemyAnimState  = 'idle' | 'attack' | 'hit' | 'death'

// ── Sprite configs (verified from actual files) ───────────────────────────────
const HERO_SPRITES = {
  male: {
    idle:   { src: '/sprites/hero/idle.png',   fw: 288, fh: 240, frames: 8 },
    attack: { src: '/sprites/hero/attack.png', fw: 288, fh: 240, frames: 8 },
    walk:   { src: '/sprites/hero/run.png',    fw: 288, fh: 240, frames: 8 },
  },
  female: {
    idle:   { src: '/sprites/hero/female_idle.png',   fw: 192, fh: 192, frames: 6 },
    attack: { src: '/sprites/hero/female_attack.png', fw: 192, fh: 192, frames: 6 },
    walk:   { src: '/sprites/hero/female_walk.png',   fw: 192, fh: 192, frames: 6 },
  },
}

// Zone sequence: each zone has a background and an enemy pool
const ZONES = [
  {
    id: 'forest',
    bg: '/backgrounds/forest.png',
    enemies: ['gas-goblin', 'null-pointer'],
  },
  {
    id: 'snow',
    bg: '/backgrounds/snow.png',
    enemies: ['null-pointer', 'rug-phantom'],
  },
  {
    id: 'desert',
    bg: '/backgrounds/desert.png',
    enemies: ['rug-phantom', 'fork-wraith'],
  },
  {
    id: 'void',
    bg: '/backgrounds/back.png',
    enemies: ['fork-wraith'],
    isBossZone: true,
  },
]

// Monster sprite config keyed by enemy id
const MONSTER_SPRITES: Record<string, {
  idle: string; attack: string; hit?: string
  fw: number; fh: number
  idleFrames: number; attackFrames: number; hitFrames?: number
}> = {
  'gas-goblin': {
    idle: '/sprites/monsters/mummy_idle.png', attack: '/sprites/monsters/mummy_attack.png',
    fw: 128, fh: 128, idleFrames: 8, attackFrames: 10,
  },
  'null-pointer': {
    idle: '/sprites/monsters/ice_idle.png', attack: '/sprites/monsters/ice_attack.png',
    fw: 128, fh: 128, idleFrames: 8, attackFrames: 10,
  },
  'rug-phantom': {
    idle: '/sprites/monsters/shadow_idle.png', attack: '/sprites/monsters/shadow_attack.png',
    fw: 180, fh: 180, idleFrames: 5, attackFrames: 6,
  },
  'fork-wraith': {
    idle: '/sprites/monsters/creature_idle.png', attack: '/sprites/monsters/creature_attack.png',
    hit: '/sprites/monsters/creature_hit.png',
    fw: 256, fh: 256, idleFrames: 16, attackFrames: 16, hitFrames: 12,
  },
  'boss': {
    idle: '/sprites/monsters/boss_idle.png', attack: '/sprites/monsters/boss_attack.png',
    fw: 256, fh: 256, idleFrames: 6, attackFrames: 8,
  },
}

// ── Sprite Animator ───────────────────────────────────────────────────────────
function SpriteAnim({
  src, fw, fh, frames, fps = 8, flipX = false,
  brightness, style,
}: {
  src: string; fw: number; fh: number; frames: number; fps?: number
  flipX?: boolean; brightness?: number; style?: React.CSSProperties
}) {
  const [frame, setFrame] = useState(0)
  const rafRef  = useRef<number>()
  const lastRef = useRef(0)
  const fpsRef  = useRef(fps)
  fpsRef.current = fps

  useEffect(() => {
    setFrame(0)
  }, [src])

  useEffect(() => {
    const tick = (now: number) => {
      if (now - lastRef.current >= 1000 / fpsRef.current) {
        setFrame(f => (f + 1) % frames)
        lastRef.current = now
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [frames])

  return (
    <div style={{
      width: fw, height: fh, flexShrink: 0,
      transform: flipX ? 'scaleX(-1)' : undefined,
      filter: brightness !== undefined && brightness !== 1
        ? `brightness(${brightness}) drop-shadow(0 0 10px rgba(255,34,68,0.8))`
        : undefined,
      backgroundImage: `url(${src})`,
      backgroundRepeat: 'no-repeat',
      backgroundSize: `${fw * frames}px ${fh}px`,
      backgroundPosition: `${-(frame * fw)}px 0px`,
      imageRendering: 'pixelated',
      ...style,
    }} />
  )
}

// ── Ground shadow ─────────────────────────────────────────────────────────────
function GroundShadow({ w }: { w: number }) {
  return (
    <div style={{
      width: w * 0.55, height: 7, borderRadius: '50%',
      background: 'radial-gradient(ellipse, rgba(0,0,0,0.7) 0%, transparent 70%)',
      filter: 'blur(3px)',
      marginTop: -4, alignSelf: 'center',
    }} />
  )
}

// ── Character Select Screen ───────────────────────────────────────────────────
function CharSelect({ onSelect }: { onSelect: (c: CharChoice) => void }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, background: '#020a06',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      zIndex: 50, gap: 32,
    }}>
      <div style={{ fontFamily: 'Orbitron', fontSize: 14, color: '#00ff88', letterSpacing: 6, textTransform: 'uppercase' }}>
        Choose Your Hero
      </div>
      <div style={{ display: 'flex', gap: 32 }}>
        {/* Male hero */}
        <button onClick={() => onSelect('male')} style={{
          background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.3)',
          padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#00ff88'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,136,0.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,136,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,136,0.05)' }}
        >
          {/* Animate idle sprite for preview */}
          <SpriteAnim
            src={HERO_SPRITES.male.idle.src}
            fw={HERO_SPRITES.male.idle.fw}
            fh={HERO_SPRITES.male.idle.fh}
            frames={HERO_SPRITES.male.idle.frames}
            fps={7}
          />
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00ff88', letterSpacing: 3 }}>ADVENTURER</div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(42,74,53,1)', letterSpacing: 2 }}>BALANCED</div>
        </button>

        {/* Female hero */}
        <button onClick={() => onSelect('female')} style={{
          background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.3)',
          padding: 24, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#00ff88'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,136,0.1)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,255,136,0.3)'; (e.currentTarget as HTMLElement).style.background = 'rgba(0,255,136,0.05)' }}
        >
          <SpriteAnim
            src={HERO_SPRITES.female.idle.src}
            fw={HERO_SPRITES.female.idle.fw}
            fh={HERO_SPRITES.female.idle.fh}
            frames={HERO_SPRITES.female.idle.frames}
            fps={7}
          />
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00ff88', letterSpacing: 3 }}>SENTINEL</div>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(42,74,53,1)', letterSpacing: 2 }}>AGILE</div>
        </button>
      </div>
    </div>
  )
}

// ── Zone Transition ───────────────────────────────────────────────────────────
function ZoneTransition({ onDone, heroChar, heroSrc, fw, fh, frames }: {
  onDone: () => void; heroChar: CharChoice
  heroSrc: string; fw: number; fh: number; frames: number
}) {
  const [runX, setRunX] = useState(0)
  const [phase, setPhase] = useState<'run_out' | 'dark' | 'done'>('run_out')

  useEffect(() => {
    // Hero runs to the right edge
    const t1 = setTimeout(() => setPhase('dark'), 1200)
    const t2 = setTimeout(() => { setPhase('done'); onDone() }, 2200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onDone])

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      background: phase === 'dark' ? '#000' : 'transparent',
      transition: 'background 0.3s',
      display: 'flex', alignItems: 'flex-end',
      overflow: 'hidden',
    }}>
      {phase === 'run_out' && (
        <motion.div
          initial={{ x: 20 }}
          animate={{ x: 500 }}
          transition={{ duration: 1.1, ease: 'linear' }}
          style={{ marginBottom: 28, position: 'absolute', left: 0, bottom: 0 }}
        >
          <SpriteAnim src={heroSrc} fw={fw} fh={fh} frames={frames} fps={12} />
        </motion.div>
      )}
      {phase === 'dark' && (
        <div style={{ position: 'absolute', inset: 0, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(0,255,136,0.5)', letterSpacing: 6, animation: 'blinkStep 0.8s step-end infinite' }}>
            LOADING...
          </div>
        </div>
      )}
    </div>
  )
}

// ── Battle Arena ──────────────────────────────────────────────────────────────
function BattleArena({
  enemy, phase, bg,
  heroChar, playerAnim, enemyAnim,
  dmgNumbers, screenShake,
  onZoneTransitionDone,
}: {
  enemy: Enemy | null; phase: GamePhase; bg: string
  heroChar: CharChoice
  playerAnim: PlayerAnimState; enemyAnim: EnemyAnimState
  dmgNumbers: Array<{ id: number; val: number; side: 'enemy' | 'player' }>
  screenShake: boolean
  onZoneTransitionDone?: () => void
}) {
  const hero    = HERO_SPRITES[heroChar]
  const monCfg  = enemy ? (MONSTER_SPRITES[enemy.id] ?? MONSTER_SPRITES['boss']) : null

  const getHeroSprite = () => {
    if (playerAnim === 'walk')   return hero.walk
    if (playerAnim === 'attack') return hero.attack
    return hero.idle
  }

  const getMonsterSrc = () => {
    if (!monCfg) return MONSTER_SPRITES.boss.idle
    if (enemyAnim === 'attack') return monCfg.attack
    if (enemyAnim === 'hit' && monCfg.hit) return monCfg.hit
    return monCfg.idle
  }

  const getMonsterFrames = () => {
    if (!monCfg) return MONSTER_SPRITES.boss.idleFrames
    if (enemyAnim === 'attack') return monCfg.attackFrames
    if (enemyAnim === 'hit' && monCfg.hitFrames) return monCfg.hitFrames
    return monCfg.idleFrames
  }

  const heroSprite = getHeroSprite()

  // Scale sprites to a consistent display size relative to arena height (280px)
  // Target: sprite should be ~50% of arena height = 140px tall
  const ARENA_H = 280
  const TARGET_H = 130

  const heroScale   = TARGET_H / heroSprite.fh
  const heroFwDisp  = Math.round(heroSprite.fw * heroScale)
  const heroFhDisp  = TARGET_H

  const monScale    = monCfg ? TARGET_H / monCfg.fh : 1
  const monFwDisp   = monCfg ? Math.round(monCfg.fw * monScale) : TARGET_H
  const monFhDisp   = TARGET_H

  return (
    <div
      className={screenShake ? 'screen-shake' : ''}
      style={{
        position: 'relative', width: '100%', height: ARENA_H,
        overflow: 'hidden', border: '1px solid rgba(0,255,136,0.15)',
      }}
    >
      {/* Background */}
      <img src={bg} alt="" style={{
        position: 'absolute', inset: 0, width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: 'center 30%',
        filter: 'brightness(0.7) saturate(0.85)',
      }} />

      {/* Bottom darkening — helps sprites look grounded */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)',
      }} />

      {/* CRT scanlines */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.07) 3px, rgba(0,0,0,0.07) 4px)',
        zIndex: 8,
      }} />

      {/* Zone transition overlay */}
      {phase === 'zone_transition' && onZoneTransitionDone && (
        <ZoneTransition
          onDone={onZoneTransitionDone}
          heroChar={heroChar}
          heroSrc={hero.walk.src}
          fw={heroFwDisp}
          fh={heroFhDisp}
          frames={hero.walk.frames}
        />
      )}

      {phase === 'combat' && enemy && monCfg && (
        <>
          {/* PLAYER — bottom-left, flush to ground */}
          <div style={{
            position: 'absolute',
            left: 8,
            bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            zIndex: 5,
          }}>
            {/* DMG number */}
            {dmgNumbers.filter(d => d.side === 'player').map(d => (
              <div key={d.id} className="damage-number" style={{
                position: 'absolute', bottom: heroFhDisp + 8,
                left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'Orbitron', fontWeight: 900, fontSize: 18,
                color: '#ff2244', textShadow: '0 0 10px rgba(255,34,68,0.8)',
                zIndex: 20, whiteSpace: 'nowrap',
              }}>-{d.val}</div>
            ))}

            <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#00ff88', letterSpacing: 2, marginBottom: 2, background: 'rgba(0,0,0,0.55)', padding: '1px 6px' }}>
              PLAYER
            </div>

            {/* Hero faces RIGHT (natural direction) */}
            <SpriteAnim
              src={heroSprite.src}
              fw={heroFwDisp}
              fh={heroFhDisp}
              frames={heroSprite.frames}
              fps={playerAnim === 'attack' ? 12 : playerAnim === 'walk' ? 10 : 7}
              brightness={playerAnim === 'hit' ? 4 : 1}
              style={{
                filter: playerAnim === 'hit'
                  ? 'brightness(4) drop-shadow(0 0 12px #ff2244)'
                  : 'drop-shadow(3px 6px 4px rgba(0,0,0,0.9))',
              }}
            />
            <GroundShadow w={heroFwDisp} />
          </div>

          {/* ENEMY — bottom-right, faces LEFT via scaleX(-1) */}
          <div style={{
            position: 'absolute',
            right: 8,
            bottom: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            zIndex: 5,
          }}>
            {dmgNumbers.filter(d => d.side === 'enemy').map(d => (
              <div key={d.id} className="damage-number" style={{
                position: 'absolute', bottom: monFhDisp + 30,
                left: '50%', transform: 'translateX(-50%)',
                fontFamily: 'Orbitron', fontWeight: 900, fontSize: 18,
                color: '#ff2244', textShadow: '0 0 10px rgba(255,34,68,0.8)',
                zIndex: 20, whiteSpace: 'nowrap',
              }}>-{d.val}</div>
            ))}

            {/* Enemy name + HP bar */}
            <div style={{ marginBottom: 3, textAlign: 'center', minWidth: monFwDisp }}>
              <div style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: '#ff2244', letterSpacing: 2, marginBottom: 2, background: 'rgba(0,0,0,0.55)', padding: '1px 6px', display: 'inline-block' }}>
                {enemy.name}
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,34,68,0.3)', width: Math.min(monFwDisp, 100), margin: '0 auto' }}>
                <div className="health-bar-fill" style={{
                  height: '100%', width: `${(enemy.hp / enemy.maxHp) * 100}%`,
                  background: 'linear-gradient(90deg,#ff2244,#ff6600)',
                  boxShadow: '0 0 4px rgba(255,34,68,0.8)',
                }} />
              </div>
            </div>

            {/* Monster faces LEFT = scaleX(-1) applied inside SpriteAnim via flipX */}
            <SpriteAnim
              src={getMonsterSrc()}
              fw={monFwDisp}
              fh={monFhDisp}
              frames={getMonsterFrames()}
              fps={enemyAnim === 'attack' ? 10 : enemyAnim === 'hit' ? 12 : 6}
              flipX={true}
              brightness={enemyAnim === 'hit' ? 4 : enemyAnim === 'death' ? 0.2 : 1}
              style={{
                opacity: enemyAnim === 'death' ? 0.3 : 1,
                filter: enemyAnim === 'hit'
                  ? 'brightness(4) drop-shadow(0 0 12px #ff2244)'
                  : enemyAnim === 'death'
                  ? 'brightness(0.2) grayscale(1)'
                  : 'drop-shadow(-3px 6px 4px rgba(0,0,0,0.9))',
                transition: 'opacity 0.3s, filter 0.1s steps(1)',
              }}
            />
            <GroundShadow w={monFwDisp} />
          </div>
        </>
      )}

      {phase === 'victory' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, zIndex: 5 }}>
          <div style={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: 32, color: '#00ff88', textShadow: '0 0 30px rgba(0,255,136,0.8)', letterSpacing: 6 }}>VICTORY</div>
        </div>
      )}

      {phase === 'dead' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, zIndex: 5 }}>
          <div style={{ fontFamily: 'Orbitron', fontWeight: 900, fontSize: 32, color: '#ff2244', textShadow: '0 0 30px rgba(255,34,68,0.8)', letterSpacing: 6 }}>YOU DIED</div>
        </div>
      )}

      {(phase === 'menu' || phase === 'registering') && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(0,255,136,0.4)', letterSpacing: 4 }}>
            {phase === 'registering' ? 'REGISTERING ON-CHAIN...' : 'AWAITING ENTRY INTO THE NULL...'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Live Raid Feed ────────────────────────────────────────────────────────────
function LiveRaidFeed() {
  const [feed, setFeed] = useState([
    { type: '⚔', addr: '0xa3f1', dmg: 45 },
    { type: '𝕏', addr: '0xb2cc', dmg: 25 },
    { type: '𝕏', addr: '0xc4d9', dmg: 25 },
    { type: '⚔', addr: '0xd8e0', dmg: 22 },
  ])
  useEffect(() => {
    try {
      const q = query(collection(db, 'raidFeed'), orderBy('createdAt', 'desc'), limit(4))
      const unsub = onSnapshot(q, snap => {
        if (!snap.empty) setFeed(snap.docs.map(doc => ({
          type: doc.data().attackType === 'tweet' ? '𝕏' : '⚔',
          addr: (doc.data().displayAddress ?? '0x????').slice(0, 6),
          dmg: doc.data().damage ?? 0,
        })))
      })
      return () => unsub()
    } catch { /* not configured */ }
  }, [])
  return (
    <div style={{ border: '1px solid rgba(0,255,136,0.08)', background: '#010805', padding: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00ff88' }} />
        <span style={{ fontFamily: 'Share Tech Mono', fontSize: 9, color: 'rgba(42,74,53,1)', letterSpacing: 3 }}>// LIVE RAID FEED</span>
      </div>
      {feed.map((e, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'Share Tech Mono', padding: '1px 0', color: 'rgba(42,74,53,1)' }}>
          <span>{e.type} {e.addr}..</span>
          <span style={{ color: '#ff2244' }}>-{e.dmg} HP</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function GameFullUI() {
  const wallet = useWallet()

  const [phase,       setPhase]      = useState<GamePhase>('char_select')
  const [heroChar,    setHeroChar]   = useState<CharChoice>('male')
  const [zoneIndex,   setZoneIndex]  = useState(0)
  const [killCount,   setKillCount]  = useState(0)  // kills in current zone
  const [chainPlayer, setChainPlayer]= useState<PlayerData | null>(null)
  const [enemy,       setEnemy]      = useState<Enemy | null>(null)
  const [narrative,   setNarrative]  = useState<NarrativeMessage[]>([])
  const [raidData,    setRaidData]   = useState<RaidData | null>(null)
  const [isThinking,  setIsThinking] = useState(false)
  const [txPending,   setTxPending]  = useState(false)
  const [txHash,      setTxHash]     = useState<string | null>(null)
  const [dmgNumbers,  setDmgNumbers] = useState<Array<{ id: number; val: number; side: 'enemy' | 'player' }>>([])
  const [screenShake, setScreenShake]= useState(false)
  const [playerAnim,  setPlayerAnim] = useState<PlayerAnimState>('idle')
  const [enemyAnim,   setEnemyAnim]  = useState<EnemyAnimState>('idle')

  const dmgId  = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)

  const zone = ZONES[Math.min(zoneIndex, ZONES.length - 1)]

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [narrative])

  const addLog = useCallback((content: string, role: NarrativeMessage['role'] = 'dm', type: NarrativeMessage['type'] = 'combat') => {
    setNarrative(prev => [...prev, { id: Date.now().toString(), role, content, timestamp: Date.now(), type }])
  }, [])

  const showDmg = useCallback((val: number, side: 'enemy' | 'player') => {
    const id = ++dmgId.current
    setDmgNumbers(prev => [...prev, { id, val, side }])
    setTimeout(() => setDmgNumbers(prev => prev.filter(d => d.id !== id)), 1200)
  }, [])

  const triggerShake = useCallback(() => {
    setScreenShake(true)
    setTimeout(() => setScreenShake(false), 400)
  }, [])

  const refreshChainState = useCallback(async () => {
    if (!wallet.isConnected) return
    const [p, r] = await Promise.all([wallet.readPlayer(), wallet.readRaid()])
    if (p) setChainPlayer(p)
    if (r) setRaidData(r)
    return p
  }, [wallet])

  useEffect(() => { if (wallet.isConnected) refreshChainState() }, [wallet.isConnected, refreshChainState])

  const handleCharSelect = (c: CharChoice) => {
    setHeroChar(c)
    setPhase('menu')
  }

  const handleConnect  = useCallback(async () => { await wallet.connect() }, [wallet])

  const handleRegister = useCallback(async () => {
    setPhase('registering'); setTxPending(true)
    try {
      const hash = await wallet.registerPlayer()
      setTxHash(hash)
      addLog(`TX: ${hash.slice(0, 18)}...\nWaiting for Celo...`, 'system', 'event')
      await new Promise(r => setTimeout(r, 4000))
      const p = await wallet.readPlayer()
      if (p?.exists) { setChainPlayer(p); addLog('REGISTERED ON-CHAIN.', 'system', 'event'); setPhase('menu') }
    } catch (e: unknown) { addLog(`Error: ${(e as Error).message}`, 'system'); setPhase('menu') }
    finally { setTxPending(false) }
  }, [wallet, addLog])

  const startEncounter = useCallback(() => {
    const currentZone = ZONES[Math.min(zoneIndex, ZONES.length - 1)]
    // Pick enemy from zone's enemy pool
    const enemyPool = ENEMIES.filter(e => currentZone.enemies.includes(e.id))
    const pool      = enemyPool.length > 0 ? enemyPool : ENEMIES
    const e         = pool[Math.floor(Math.random() * pool.length)]
    setEnemy({ ...e, hp: e.maxHp })
    setPhase('combat'); setNarrative([])
    setPlayerAnim('idle'); setEnemyAnim('idle')
    addLog(`ENCOUNTER: ${e.name} — ${e.class}\n\n${e.description}\n\nSign your action to attack.`, 'dm', 'combat')
  }, [zoneIndex, addLog])

  // Zone transition: advance to next zone
  const advanceZone = useCallback(() => {
    setPhase('zone_transition')
  }, [])

  const handleZoneTransitionDone = useCallback(() => {
    const next = Math.min(zoneIndex + 1, ZONES.length - 1)
    setZoneIndex(next)
    setKillCount(0)
    setEnemy(null)
    setNarrative([])
    addLog(`ZONE ${next + 1}: ${ZONES[next].id.toUpperCase()}\nA new threat emerges from the null...`, 'system', 'event')
    setPhase('menu')
  }, [zoneIndex, addLog])

  // ── Execute action — TX first, THEN animate ──────────────────────────────
  const executeAction = useCallback(async (action: GameAction) => {
    if (!enemy || isThinking || txPending || !wallet.isConnected) return
    setTxPending(true)
    addLog(`>> ${action.label} — awaiting TX confirmation...`, 'player')

    try {
      const dmgDealt    = Math.floor(Math.random() * 20) + 10
      const dmgReceived = Math.floor(Math.random() * 18) + 5
      const xpGained    = Math.floor(Math.random() * 15) + 5
      const newEnemyHp  = Math.max(0, enemy.hp - dmgDealt)
      const enemyKilled = newEnemyHp === 0

      // ── STEP 1: Submit TX, wait for confirmation ──────────────────────────
      let txHash_: string
      if ((NULLSTATE_ADDRESS as string) === '0x0000000000000000000000000000000000000000') {
        // Demo mode: simulate TX delay
        await new Promise(r => setTimeout(r, 1200))
        txHash_ = '0xdemo_' + Date.now().toString(16)
        addLog('⚠️ CONTRACT NOT DEPLOYED — demo mode.', 'system')
      } else {
        txHash_ = await wallet.executeAction({
          actionType: action.effect === 'attack' ? 1 : action.effect === 'defend' ? 2 : action.effect === 'inspect' ? 3 : action.effect === 'flee' ? 4 : 5,
          damageDealt: dmgDealt, damageReceived: dmgReceived, xpGained, enemyKilled,
        })
        setTxHash(txHash_)
        addLog(`TX CONFIRMED: ${txHash_.slice(0, 20)}...`, 'system', 'event')
      }

      setTxPending(false)

      // ── STEP 2: Play attack animation AFTER TX confirmed ──────────────────
      setPlayerAnim('walk')
      await new Promise(r => setTimeout(r, 150))
      setPlayerAnim('attack')
      await new Promise(r => setTimeout(r, 300))
      setEnemyAnim('hit')
      triggerShake()
      showDmg(dmgDealt, 'enemy')
      await new Promise(r => setTimeout(r, 500))
      setEnemyAnim(enemyKilled ? 'death' : 'idle')
      setPlayerAnim('idle')

      if (!enemyKilled && dmgReceived > 0) {
        await new Promise(r => setTimeout(r, 300))
        setEnemyAnim('attack')
        setPlayerAnim('hit')
        showDmg(dmgReceived, 'player')
        await new Promise(r => setTimeout(r, 600))
        setEnemyAnim('idle')
        setPlayerAnim('idle')
      }

      // ── STEP 3: AI narration ──────────────────────────────────────────────
      setIsThinking(true)
      try {
        const res = await fetch('/api/groq', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, player: chainPlayer ?? INITIAL_PLAYER, enemy, context: `Turn ${narrative.length}` }),
        })
        const result = await res.json()
        let msg = result.narrative ?? `You struck for ${dmgDealt} damage.`
        if (result.specialEvent === 'critical_hit') msg = '⚡ CRITICAL HIT! ' + msg
        addLog(msg, 'dm', 'combat')
      } catch {
        addLog(`You dealt ${dmgDealt} damage.`, 'dm', 'combat')
      }

      setEnemy(prev => prev ? { ...prev, hp: newEnemyHp } : null)

      // ── STEP 4: Outcome ───────────────────────────────────────────────────
      if (enemyKilled) {
        await new Promise(r => setTimeout(r, 600))
        addLog(`VICTORY — ${enemy.name} defeated.\n+${xpGained} XP earned.`, 'system', 'reward')
        setPhase('victory')
        const newKills = killCount + 1
        setKillCount(newKills)
        await refreshChainState()
      } else {
        const newPlayerHp = Math.max(0, (chainPlayer?.hp ?? INITIAL_PLAYER.hp) - dmgReceived)
        if (newPlayerHp <= 0) {
          await new Promise(r => setTimeout(r, 600))
          addLog('YOU HAVE FALLEN.\nYour progress is lost.', 'system', 'death')
          setPhase('dead')
          await refreshChainState()
        }
      }
    } catch (e: unknown) {
      addLog(`Action failed: ${(e as Error).message}`, 'system')
      setPlayerAnim('idle'); setEnemyAnim('idle')
    } finally {
      setIsThinking(false); setTxPending(false)
    }
  }, [enemy, isThinking, txPending, wallet, addLog, chainPlayer, narrative.length, showDmg, refreshChainState, triggerShake, killCount])

  const handleRespawn = useCallback(async () => {
    setTxPending(true)
    try {
      const hash = await wallet.respawnPlayer()
      setTxHash(hash)
      await new Promise(r => setTimeout(r, 4000))
      const p = await wallet.readPlayer()
      if (p) setChainPlayer(p)
      addLog('RESPAWNED. The null forgets nothing.', 'system', 'event')
      setZoneIndex(0); setKillCount(0)
      setPhase('menu'); setEnemy(null); setNarrative([])
    } catch (e: unknown) { addLog(`Respawn failed: ${(e as Error).message}`, 'system') }
    finally { setTxPending(false) }
  }, [wallet, addLog])

  const handleTweetRaid = useCallback(() => {
    const text = encodeURIComponent(`⚔️ Attacking THE 51% Raid Boss on @NullStateRPG!\nnullstate.xyz #CeloRPG`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }, [])

  // Derived
  const displayHp    = chainPlayer?.hp    ?? INITIAL_PLAYER.hp
  const displayMaxHp = chainPlayer?.maxHp ?? INITIAL_PLAYER.maxHp
  const displayXp    = chainPlayer?.xp    ?? INITIAL_PLAYER.xp
  const displayLevel = chainPlayer?.level ?? INITIAL_PLAYER.level
  const displayKills = chainPlayer?.kills ?? INITIAL_PLAYER.kills
  const hpPct        = Math.round((displayHp / displayMaxHp) * 100)
  const xpPct        = Math.min(100, Math.round(((displayXp % 500) / 500) * 100))
  const raidHp       = raidData ? parseInt(raidData.currentHp, 16) : 6488
  const raidMaxHp    = raidData ? parseInt(raidData.maxHp, 16)    : 10000
  const raidPct      = Math.round((raidHp / raidMaxHp) * 100)

  return (
    <>
      <style>{`
        @keyframes dmgFloat { 0%{transform:translateY(0) scale(0.5);opacity:0} 20%{transform:translateY(-14px) scale(1.3);opacity:1} 80%{transform:translateY(-52px) scale(1);opacity:1} 100%{transform:translateY(-72px) scale(0.8);opacity:0} }
        @keyframes screenShakeKf { 0%{transform:translate(0,0)} 20%{transform:translate(-4px,2px)} 40%{transform:translate(4px,-2px)} 60%{transform:translate(-3px,3px)} 80%{transform:translate(3px,-1px)} 100%{transform:translate(0,0)} }
        @keyframes blinkStep { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        @keyframes menuPulse { 0%,49%{box-shadow:0 0 0 1px rgba(0,255,136,0.4)} 50%,100%{box-shadow:0 0 0 1px rgba(0,255,136,0.9),0 0 24px rgba(0,255,136,0.3)} }
        .damage-number { animation: dmgFloat 1.2s steps(8) forwards; pointer-events: none; }
        .screen-shake  { animation: screenShakeKf 0.4s steps(4); }
        .health-bar-fill { transition: width 0.5s steps(20); }
        .menu-pulse    { animation: menuPulse 2s step-end infinite; }
        .blink         { animation: blinkStep 1s step-end infinite; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#020a06', display: 'flex', flexDirection: 'column', fontFamily: "'Share Tech Mono', monospace", position: 'relative' }}>

        {/* Char select overlay */}
        {phase === 'char_select' && <CharSelect onSelect={handleCharSelect} />}

        {/* TOP BAR */}
        <div style={{ borderBottom: '1px solid rgba(0,255,136,0.2)', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link href="/" style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: 'rgba(42,74,53,1)', letterSpacing: 2, textDecoration: 'none' }}>← NULL_STATE</Link>
          <div style={{ fontFamily: 'Share Tech Mono', fontSize: 11, color: '#00ff88', letterSpacing: 3 }}>// ZONE {zoneIndex + 1}: {zone.id.toUpperCase()}</div>
          <div>
            {wallet.isConnected
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: '#00ff88' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88' }} />
                  {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
                </div>
              : !wallet.isMiniPay && (
                  <button onClick={handleConnect} style={{ fontFamily: 'Share Tech Mono', fontSize: 10, color: '#00ff88', border: '1px solid rgba(0,255,136,0.4)', background: 'transparent', padding: '4px 12px', cursor: 'pointer' }}>
                    CONNECT
                  </button>
                )
            }
          </div>
        </div>

        {/* MAIN */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: 960, width: '100%', margin: '0 auto', padding: 12, gap: 8 }}>

          {/* PLAYER HUD */}
          <div style={{ border: '1px solid rgba(0,255,136,0.2)', background: 'rgba(0,0,0,0.6)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#00ff88', letterSpacing: 2 }}>HP</span>
                <span style={{ fontSize: 10, color: '#00ff88' }}>{displayHp}/{displayMaxHp}</span>
              </div>
              <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,255,136,0.1)', marginBottom: 6 }}>
                <div className="health-bar-fill" style={{ height: '100%', width: `${hpPct}%`, background: hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ffaa00' : '#ff2244', boxShadow: `0 0 6px ${hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ffaa00' : '#ff2244'}` }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: '#ffaa00', letterSpacing: 2 }}>XP</span>
                <span style={{ fontSize: 10, color: '#ffaa00' }}>LVL {displayLevel} · {displayXp}</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,170,0,0.1)' }}>
                <div className="health-bar-fill" style={{ height: '100%', width: `${xpPct}%`, background: '#ffaa00' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'rgba(42,74,53,1)' }}>
              <div>KILLS <span style={{ color: '#00ff88' }}>{displayKills}</span></div>
              {wallet.isConnected && <div>BAL <span style={{ color: '#ffaa00' }}>{wallet.celoBalance}</span></div>}
            </div>
          </div>

          {/* BATTLE ARENA */}
          <BattleArena
            enemy={enemy}
            phase={phase}
            bg={zone.bg}
            heroChar={heroChar}
            playerAnim={playerAnim}
            enemyAnim={enemyAnim}
            dmgNumbers={dmgNumbers}
            screenShake={screenShake}
            onZoneTransitionDone={handleZoneTransitionDone}
          />

          {/* NARRATIVE LOG */}
          <div style={{ border: '1px solid rgba(0,255,136,0.12)', background: '#010805' }}>
            <div style={{ padding: '6px 12px', borderBottom: '1px solid rgba(0,255,136,0.08)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,255,136,0.02)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff3b30' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffcc02' }} />
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34c759' }} />
              <span style={{ fontSize: 10, color: 'rgba(42,74,53,1)', marginLeft: 8, letterSpacing: 2 }}>AI_DM :: GROQ_70B</span>
              {isThinking && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#00ff88' }}>GENERATING...</span>}
              {txPending && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#ffaa00', animation: 'blinkStep 0.8s step-end infinite' }}>TX PENDING...</span>}
            </div>
            <div ref={logRef} style={{ padding: 12, fontSize: 11, lineHeight: 1.8, overflowY: 'auto', minHeight: 90, maxHeight: 150, color: 'rgba(212,255,232,0.75)' }}>
              {narrative.length === 0 && (
                <span style={{ color: 'rgba(42,74,53,1)' }}>
                  {!wallet.isConnected ? '> Connect wallet...' : !chainPlayer?.exists ? '> Register on-chain...' : '> Enter the Null to begin.'}
                  <span className="blink" style={{ marginLeft: 4 }}>█</span>
                </span>
              )}
              {narrative.map(msg => (
                <div key={msg.id} style={{ marginBottom: 8, color: msg.role === 'player' ? '#00aaff' : msg.type === 'reward' ? '#a8ff3e' : msg.type === 'death' ? '#ff2244' : msg.type === 'event' ? '#ffaa00' : msg.role === 'system' ? 'rgba(42,74,53,1)' : 'rgba(212,255,232,0.75)' }}>
                  {msg.role === 'player' && <span style={{ color: '#00ff88' }}>&gt;&gt; </span>}
                  {msg.role === 'system' && <span style={{ color: 'rgba(42,74,53,1)' }}>// </span>}
                  {msg.content.split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
                </div>
              ))}
            </div>
          </div>

          {txHash && (
            <div style={{ fontSize: 9, color: 'rgba(42,74,53,1)', display: 'flex', gap: 8 }}>
              <span style={{ color: '#00ff88' }}>TX:</span>
              <a href={`https://celoscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer" style={{ color: '#00aaff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {txHash.slice(0, 30)}...
              </a>
            </div>
          )}

          {/* ACTION BUTTONS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {!wallet.isConnected && (
              <button onClick={handleConnect} className="menu-pulse"
                style={{ fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: '#00ff88', color: '#020a06', border: 'none', cursor: 'pointer', clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                ⬡ CONNECT WALLET TO PLAY
              </button>
            )}

            {wallet.isConnected && !chainPlayer?.exists && phase !== 'registering' && (
              <button onClick={handleRegister} disabled={txPending}
                style={{ fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: '#00ff88', color: '#020a06', border: 'none', cursor: 'pointer', opacity: txPending ? 0.5 : 1, clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                ⬡ REGISTER ON-CHAIN (FREE)
              </button>
            )}

            {wallet.isConnected && chainPlayer?.exists && phase === 'menu' && (
              <button onClick={startEncounter} className="menu-pulse"
                style={{ fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: '#00ff88', color: '#020a06', border: 'none', cursor: 'pointer', clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                ⬡ ENTER THE NULL
              </button>
            )}

            {phase === 'combat' && COMBAT_ACTIONS.map((action, i) => (
              <button key={action.id} onClick={() => executeAction(action)}
                disabled={isThinking || txPending}
                style={{
                  fontFamily: 'Share Tech Mono', fontSize: 11, letterSpacing: 1,
                  padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: i === 0 ? 'rgba(0,255,136,0.08)' : 'transparent',
                  border: `1px solid ${i === 0 ? 'rgba(0,255,136,0.35)' : 'rgba(0,255,136,0.12)'}`,
                  color: i === 0 ? '#00ff88' : 'rgba(42,74,53,1)',
                  cursor: (isThinking || txPending) ? 'not-allowed' : 'pointer',
                  opacity: (isThinking || txPending) ? 0.4 : 1,
                  clipPath: 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)',
                  transition: 'all 0.15s',
                }}>
                <span>ACTION {String.fromCharCode(65 + i)}: {action.label}</span>
                <span style={{ fontSize: 9, opacity: 0.6 }}>{action.costCELO} CELO</span>
              </button>
            ))}

            {phase === 'victory' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={startEncounter}
                  style={{ flex: 1, fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: '#00ff88', color: '#020a06', border: 'none', cursor: 'pointer', clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  ⬡ NEXT ENCOUNTER
                </button>
                {zoneIndex < ZONES.length - 1 && (
                  <button onClick={advanceZone}
                    style={{ flex: 1, fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: 'rgba(0,170,255,0.1)', color: '#00aaff', border: '1px solid rgba(0,170,255,0.4)', cursor: 'pointer', clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                    → NEXT ZONE
                  </button>
                )}
              </div>
            )}

            {phase === 'dead' && (
              <button onClick={handleRespawn} disabled={txPending}
                style={{ fontFamily: 'Share Tech Mono', fontSize: 12, letterSpacing: 2, padding: 14, background: '#ff2244', color: '#020a06', border: 'none', cursor: 'pointer', opacity: txPending ? 0.5 : 1, clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                💀 RESPAWN — LOSE ALL PROGRESS
              </button>
            )}

            {txPending && (
              <div style={{ fontSize: 10, color: '#ffaa00', letterSpacing: 2, textAlign: 'center', padding: 8 }}>
                ⏳ AWAITING TX CONFIRMATION ON CELO...
              </div>
            )}

            {(phase === 'combat' || phase === 'victory') && (
              <button onClick={handleTweetRaid}
                style={{ fontFamily: 'Share Tech Mono', fontSize: 10, letterSpacing: 2, padding: 10, background: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.3)', color: '#1d9bf0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, clipPath: 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
                𝕏 TWEET TO ATTACK RAID BOSS
              </button>
            )}

            {/* Raid HP */}
            <div style={{ border: '1px solid rgba(255,34,68,0.2)', background: 'rgba(255,34,68,0.02)', padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 9, color: '#ff2244', letterSpacing: 3 }}>⚔ RAID BOSS: THE 51%</span>
                <span style={{ fontSize: 9, color: '#ff2244' }}>{raidHp.toLocaleString()} HP</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,34,68,0.1)' }}>
                <div className="health-bar-fill" style={{ height: '100%', width: `${raidPct}%`, background: 'linear-gradient(90deg,#ff2244,#ff6600)', boxShadow: '0 0 5px rgba(255,34,68,0.5)' }} />
              </div>
            </div>

            <LiveRaidFeed />
          </div>
        </div>
      </div>
    </>
  )
}
