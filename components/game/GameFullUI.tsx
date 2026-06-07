'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useWallet, NULLSTATE_ADDRESS, PlayerData, RaidData } from '@/lib/WalletProvider'
import {
  Enemy, NarrativeMessage, GameAction,
  ENEMIES, INITIAL_PLAYER, COMBAT_ACTIONS,
} from '@/lib/game-types'
import { db } from '@/lib/firebase'
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'

type GamePhase = 'menu' | 'registering' | 'combat' | 'victory' | 'dead' | 'loading'

// ── Boss pixel sprite ────────────────────────────────────────────────────────
const BOSS_PIXEL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style="image-rendering:pixelated"><rect x="14" y="22" width="20" height="16" fill="#9900cc"/><rect x="12" y="10" width="24" height="14" fill="#bb00ee"/><rect x="12" y="4" width="4" height="8" fill="#cc00ff"/><rect x="32" y="4" width="4" height="8" fill="#cc00ff"/><rect x="10" y="2" width="4" height="4" fill="#cc00ff"/><rect x="34" y="2" width="4" height="4" fill="#cc00ff"/><rect x="15" y="14" width="6" height="4" fill="#ff0000"/><rect x="27" y="14" width="6" height="4" fill="#ff0000"/><rect x="16" y="15" width="4" height="2" fill="#ff6666"/><rect x="28" y="15" width="4" height="2" fill="#ff6666"/><rect x="16" y="20" width="16" height="2" fill="#440066"/><rect x="18" y="19" width="2" height="2" fill="#ff2244"/><rect x="22" y="19" width="2" height="2" fill="#ff2244"/><rect x="26" y="19" width="2" height="2" fill="#ff2244"/><rect x="6" y="22" width="8" height="6" fill="#9900cc"/><rect x="34" y="22" width="8" height="6" fill="#9900cc"/><rect x="4" y="26" width="4" height="4" fill="#cc00ff"/><rect x="40" y="26" width="4" height="4" fill="#cc00ff"/><rect x="20" y="26" width="8" height="6" fill="#ff2244"/></svg>`

// ── Live Raid Feed (Firebase) ─────────────────────────────────────────────────
function LiveRaidFeed() {
  const [feed, setFeed] = useState([
    { type: '⚔', addr: '0xa3f1', dmg: 45 },
    { type: '𝕏', addr: '0xb2cc', dmg: 12 },
    { type: '𝕏', addr: '0xc4d9', dmg: 46 },
    { type: '𝕏', addr: '0xd8e0', dmg: 22 },
  ])

  useEffect(() => {
    try {
      const q = query(collection(db, 'raidFeed'), orderBy('createdAt', 'desc'), limit(4))
      const unsub = onSnapshot(q, snap => {
        if (snap.empty) return
        setFeed(snap.docs.map(doc => ({
          type: doc.data().attackType === 'tweet' ? '𝕏' : '⚔',
          addr: (doc.data().displayAddress ?? '0x????').slice(0, 6),
          dmg:  doc.data().damage ?? 0,
        })))
      })
      return () => unsub()
    } catch { /* Firebase not configured */ }
  }, [])

  return (
    <div className="border border-[rgba(0,255,136,0.08)] bg-[#010805] p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1 h-1 rounded-full bg-null-green animate-pulse" />
        <span className="text-[9px] text-null-muted tracking-[3px]">// LIVE RAID FEED</span>
      </div>
      {feed.map((entry, i) => (
        <div key={i} className="flex items-center justify-between text-[9px] py-0.5">
          <span className="text-null-muted">{entry.type} {entry.addr}..</span>
          <span className="text-null-red">-{entry.dmg} HP</span>
        </div>
      ))}
    </div>
  )
}

// ── In-Game Leaderboard (Firebase) ───────────────────────────────────────────
function InGameLeaderboard() {
  const [leaders, setLeaders] = useState([
    { addr: '0xa1D5..', kills: 45, level: 12, badge: '🥇' },
    { addr: '0xbF23..', kills: 38, level: 9,  badge: '🥈' },
    { addr: '0xc9E1..', kills: 29, level: 7,  badge: '🥉' },
  ])

  useEffect(() => {
    try {
      const q = query(collection(db, 'players'), orderBy('kills', 'desc'), limit(3))
      const unsub = onSnapshot(q, snap => {
        if (snap.empty) return
        const medals = ['🥇', '🥈', '🥉']
        setLeaders(snap.docs.map((doc, i) => ({
          addr:  doc.data().displayAddress ?? doc.id.slice(0, 8) + '..',
          kills: doc.data().kills          ?? 0,
          level: doc.data().level          ?? 1,
          badge: medals[i] ?? '🏅',
        })))
      })
      return () => unsub()
    } catch { /* Firebase not configured */ }
  }, [])

  return (
    <div className="border border-[rgba(255,170,0,0.15)] bg-[#010805] p-3">
      <div className="text-[9px] text-null-amber tracking-[3px] mb-2">🏆 TOP PLAYERS</div>
      {leaders.map((p, i) => (
        <div key={i} className="flex items-center justify-between text-[9px] py-1 border-b border-[rgba(255,170,0,0.05)] last:border-0">
          <div className="flex items-center gap-2">
            <span>{p.badge}</span>
            <span className="text-null-muted">{p.addr}</span>
          </div>
          <div className="flex items-center gap-2 text-right">
            <span className="text-null-muted">LVL {p.level}</span>
            <span className="text-null-amber font-bold">{p.kills}K</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// PS1-STYLE PIXEL ART SPRITES (SVG-based, animated via CSS)
// ─────────────────────────────────────────────────────────────

const PLAYER_SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated">
  <!-- Body -->
  <rect x="11" y="14" width="10" height="11" fill="#4a9e6b"/>
  <!-- Head -->
  <rect x="12" y="7" width="8" height="7" fill="#c8a87c"/>
  <!-- Helmet -->
  <rect x="11" y="5" width="10" height="4" fill="#a0a0c0"/>
  <rect x="10" y="7" width="2" height="4" fill="#a0a0c0"/>
  <rect x="20" y="7" width="2" height="4" fill="#a0a0c0"/>
  <!-- Eyes -->
  <rect x="13" y="9" width="2" height="2" fill="#00ff88"/>
  <rect x="17" y="9" width="2" height="2" fill="#00ff88"/>
  <!-- Arms -->
  <rect x="8" y="14" width="3" height="8" fill="#4a9e6b"/>
  <rect x="21" y="14" width="3" height="8" fill="#4a9e6b"/>
  <!-- Sword (right hand) -->
  <rect x="24" y="10" width="2" height="12" fill="#c0c0d0"/>
  <rect x="23" y="13" width="4" height="2" fill="#a06020"/>
  <!-- Legs -->
  <rect x="11" y="25" width="4" height="5" fill="#3a7a55"/>
  <rect x="17" y="25" width="4" height="5" fill="#3a7a55"/>
  <!-- Boots -->
  <rect x="10" y="28" width="5" height="3" fill="#2a4a35"/>
  <rect x="17" y="28" width="5" height="3" fill="#2a4a35"/>
</svg>
`

const SPRITES: Record<string, string> = {
  'gas-goblin': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated">
  <!-- Body -->
  <rect x="10" y="15" width="12" height="10" fill="#cc4400"/>
  <!-- Head -->
  <rect x="9" y="8" width="14" height="9" fill="#dd5500"/>
  <!-- Ears/horns -->
  <rect x="7" y="5" width="4" height="6" fill="#cc4400"/>
  <rect x="21" y="5" width="4" height="6" fill="#cc4400"/>
  <rect x="8" y="3" width="2" height="4" fill="#ff7722"/>
  <rect x="22" y="3" width="2" height="4" fill="#ff7722"/>
  <!-- Eyes -->
  <rect x="11" y="10" width="3" height="3" fill="#ffdd00"/>
  <rect x="18" y="10" width="3" height="3" fill="#ffdd00"/>
  <rect x="12" y="11" width="1" height="1" fill="#000"/>
  <rect x="19" y="11" width="1" height="1" fill="#000"/>
  <!-- Mouth -->
  <rect x="12" y="14" width="8" height="2" fill="#660000"/>
  <rect x="13" y="13" width="2" height="2" fill="#eeddaa"/>
  <rect x="17" y="13" width="2" height="2" fill="#eeddaa"/>
  <!-- Arms -->
  <rect x="7" y="15" width="3" height="7" fill="#cc4400"/>
  <rect x="22" y="15" width="3" height="7" fill="#cc4400"/>
  <!-- Claws -->
  <rect x="6" y="21" width="2" height="3" fill="#ff6600"/>
  <rect x="8" y="22" width="2" height="3" fill="#ff6600"/>
  <rect x="22" y="21" width="2" height="3" fill="#ff6600"/>
  <rect x="24" y="22" width="2" height="3" fill="#ff6600"/>
  <!-- Legs -->
  <rect x="11" y="25" width="4" height="5" fill="#aa3300"/>
  <rect x="17" y="25" width="4" height="5" fill="#aa3300"/>
  <!-- Gas coin bag -->
  <rect x="14" y="18" width="4" height="4" fill="#ffaa00"/>
  <rect x="15" y="17" width="2" height="2" fill="#ffaa00"/>
  <rect x="15" y="19" width="2" height="1" fill="#cc8800"/>
</svg>`,
  'null-pointer': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated">
  <!-- Skull body -->
  <rect x="9" y="9" width="14" height="14" fill="#e0e0e0"/>
  <!-- Skull dome -->
  <rect x="11" y="6" width="10" height="6" fill="#e0e0e0"/>
  <rect x="10" y="7" width="12" height="4" fill="#e0e0e0"/>
  <!-- Eyes (hollow) -->
  <rect x="10" y="12" width="5" height="5" fill="#111"/>
  <rect x="17" y="12" width="5" height="5" fill="#111"/>
  <!-- Glowing pupils -->
  <rect x="12" y="13" width="2" height="2" fill="#ff2244"/>
  <rect x="19" y="13" width="2" height="2" fill="#ff2244"/>
  <!-- Nose -->
  <rect x="15" y="17" width="2" height="2" fill="#111"/>
  <!-- Teeth -->
  <rect x="10" y="21" width="2" height="3" fill="#fff"/>
  <rect x="13" y="21" width="2" height="3" fill="#fff"/>
  <rect x="16" y="21" width="2" height="3" fill="#fff"/>
  <rect x="19" y="21" width="2" height="3" fill="#fff"/>
  <!-- Jaw -->
  <rect x="9" y="20" width="14" height="4" fill="#c0c0c0"/>
  <!-- Spine/body -->
  <rect x="14" y="23" width="4" height="7" fill="#888"/>
  <rect x="13" y="24" width="6" height="1" fill="#aaa"/>
  <rect x="13" y="26" width="6" height="1" fill="#aaa"/>
  <rect x="13" y="28" width="6" height="1" fill="#aaa"/>
  <!-- Floating effect arms -->
  <rect x="7" y="14" width="2" height="8" fill="#888"/>
  <rect x="23" y="14" width="2" height="8" fill="#888"/>
</svg>`,
  'rug-phantom': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated">
  <!-- Ghost body (rounded) -->
  <rect x="9" y="10" width="14" height="16" fill="#ccbbff"/>
  <rect x="8" y="12" width="16" height="12" fill="#ccbbff"/>
  <rect x="10" y="9" width="12" height="4" fill="#ccbbff"/>
  <!-- Wavy bottom -->
  <rect x="9" y="26" width="3" height="3" fill="#ccbbff"/>
  <rect x="15" y="26" width="3" height="3" fill="#ccbbff"/>
  <rect x="21" y="25" width="2" height="2" fill="#ccbbff"/>
  <!-- Eyes -->
  <rect x="11" y="14" width="4" height="4" fill="#220066"/>
  <rect x="17" y="14" width="4" height="4" fill="#220066"/>
  <rect x="12" y="15" width="2" height="2" fill="#aa44ff"/>
  <rect x="18" y="15" width="2" height="2" fill="#aa44ff"/>
  <!-- Mouth O -->
  <rect x="14" y="20" width="4" height="3" fill="#220066"/>
  <!-- Money falling -->
  <rect x="5" y="18" width="3" height="2" fill="#00cc44"/>
  <rect x="24" y="15" width="3" height="2" fill="#00cc44"/>
  <rect x="6" y="23" width="3" height="2" fill="#00cc44"/>
  <rect x="23" y="22" width="3" height="2" fill="#00cc44"/>
</svg>`,
  'fork-wraith': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated">
  <!-- Crystal orb body -->
  <rect x="10" y="10" width="12" height="12" fill="#4488ff"/>
  <rect x="9" y="12" width="14" height="8" fill="#4488ff"/>
  <rect x="11" y="9" width="10" height="3" fill="#4488ff"/>
  <!-- Inner glow -->
  <rect x="12" y="12" width="8" height="8" fill="#6699ff"/>
  <rect x="14" y="11" width="4" height="10" fill="#88aaff"/>
  <!-- Eyes (split/double) -->
  <rect x="11" y="13" width="3" height="3" fill="#fff"/>
  <rect x="18" y="13" width="3" height="3" fill="#fff"/>
  <rect x="11" y="17" width="3" height="3" fill="#ff4488"/>
  <rect x="18" y="17" width="3" height="3" fill="#ff4488"/>
  <!-- Fork prongs -->
  <rect x="12" y="22" width="2" height="8" fill="#6699ff"/>
  <rect x="18" y="22" width="2" height="8" fill="#6699ff"/>
  <rect x="12" y="22" width="8" height="2" fill="#6699ff"/>
  <!-- Energy particles -->
  <rect x="6" y="10" width="2" height="2" fill="#4488ff"/>
  <rect x="24" y="14" width="2" height="2" fill="#4488ff"/>
  <rect x="7" y="20" width="2" height="2" fill="#ff4488"/>
  <rect x="23" y="8" width="2" height="2" fill="#ff4488"/>
</svg>`,
}

function PixelSprite({ id, size = 80, animClass = 'sprite-idle', tint }: { id: string; size?: number; animClass?: string; tint?: string }) {
  const svg = SPRITES[id] || PLAYER_SPRITE
  const encoded = encodeURIComponent(svg.trim())
  return (
    <div className={animClass} style={{ width: size, height: size, imageRendering: 'pixelated', filter: tint ? `drop-shadow(0 0 8px ${tint})` : undefined }}>
      <img
        src={`data:image/svg+xml,${encoded}`}
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated', display: 'block' }}
        alt=""
      />
    </div>
  )
}

function PlayerSprite({ size = 80, animClass = 'sprite-idle' }: { size?: number; animClass?: string }) {
  const encoded = encodeURIComponent(PLAYER_SPRITE.trim())
  return (
    <div className={animClass} style={{ width: size, height: size, imageRendering: 'pixelated' }}>
      <img
        src={`data:image/svg+xml,${encoded}`}
        width={size}
        height={size}
        style={{ imageRendering: 'pixelated', display: 'block', filter: 'drop-shadow(0 0 6px rgba(0,255,136,0.5))' }}
        alt="Player"
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN GAME COMPONENT
// ─────────────────────────────────────────────────────────────

export default function GameFullUI() {
  const wallet = useWallet()

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [chainPlayer, setChainPlayer] = useState<PlayerData | null>(null)
  const [enemy, setEnemy] = useState<Enemy | null>(null)
  const [narrative, setNarrative] = useState<NarrativeMessage[]>([])
  const [raidData, setRaidData] = useState<RaidData | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [txPending, setTxPending] = useState(false)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [dmgNumbers, setDmgNumbers] = useState<Array<{ id: number; val: number; side: 'enemy' | 'player' }>>([])
  const [playerAnim, setPlayerAnim] = useState<'sprite-idle' | 'sprite-attack' | 'sprite-hit'>('sprite-idle')
  const [enemyAnim, setEnemyAnim] = useState<'sprite-idle' | 'sprite-attack' | 'sprite-hit' | 'sprite-death'>('sprite-idle')
  const [screenShake, setScreenShake] = useState(false)
  const dmgId = useRef(0)
  const logRef = useRef<HTMLDivElement>(null)

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

  const triggerScreenShake = useCallback(() => {
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

  useEffect(() => {
    if (wallet.isConnected) refreshChainState()
  }, [wallet.isConnected, refreshChainState])

  const handleConnect = useCallback(async () => {
    await wallet.connect()
  }, [wallet])

  const handleRegister = useCallback(async () => {
    setPhase('registering')
    setTxPending(true)
    try {
      const hash = await wallet.registerPlayer()
      setTxHash(hash)
      addLog(`TX SUBMITTED: ${hash.slice(0, 18)}...\nWaiting for Celo confirmation...`, 'system', 'event')
      await new Promise(r => setTimeout(r, 4000))
      const p = await wallet.readPlayer()
      if (p?.exists) {
        setChainPlayer(p)
        addLog('PLAYER REGISTERED ON-CHAIN.\nWelcome to the Null. Your wallet is your soul.', 'system', 'event')
        setPhase('menu')
      }
    } catch (e: unknown) {
      addLog(`Registration failed: ${(e as Error).message}`, 'system')
      setPhase('menu')
    } finally {
      setTxPending(false)
    }
  }, [wallet, addLog])

  const startEncounter = useCallback(() => {
    const e = ENEMIES[Math.floor(Math.random() * ENEMIES.length)]
    setEnemy({ ...e, hp: e.maxHp })
    setPhase('combat')
    setNarrative([])
    setPlayerAnim('sprite-idle')
    setEnemyAnim('sprite-idle')
    addLog(
      `ENCOUNTER: ${e.name} — ${e.class}\n\n${e.description}\n\nSign your action to attack. Each TX costs 0.01 CELO.`,
      'dm', 'combat'
    )
  }, [addLog])

  const executeAction = useCallback(async (action: GameAction) => {
    if (!enemy || isThinking || txPending || !wallet.isConnected) return

    setTxPending(true)
    addLog(`>> ${action.label} — signing tx...`, 'player')

    try {
      const dmgDealt = Math.floor(Math.random() * 20) + 10
      const dmgReceived = Math.floor(Math.random() * 18) + 5
      const xpGained = Math.floor(Math.random() * 15) + 5
      const newEnemyHp = Math.max(0, enemy.hp - dmgDealt)
      const enemyKilled = newEnemyHp === 0

      // Animate player attack
      setPlayerAnim('sprite-attack')
      setTimeout(() => {
        setEnemyAnim('sprite-hit')
        triggerScreenShake()
      }, 200)
      setTimeout(() => {
        setPlayerAnim('sprite-idle')
        setEnemyAnim(enemyKilled ? 'sprite-death' : 'sprite-idle')
      }, 600)

      let txHash_: string
      if ((NULLSTATE_ADDRESS as string) === '0x0000000000000000000000000000000000000000') {
        await new Promise(r => setTimeout(r, 1200))
        txHash_ = '0xdemo_' + Date.now().toString(16)
        addLog('⚠️ CONTRACT NOT DEPLOYED YET — running in demo mode.', 'system')
      } else {
        txHash_ = await wallet.executeAction({
          actionType: action.effect === 'attack' ? 1 : action.effect === 'defend' ? 2 : action.effect === 'inspect' ? 3 : action.effect === 'flee' ? 4 : 5,
          damageDealt: dmgDealt,
          damageReceived: dmgReceived,
          xpGained,
          enemyKilled,
        })
        setTxHash(txHash_)
        addLog(`TX CONFIRMED: ${txHash_.slice(0, 18)}...`, 'system', 'event')
        await new Promise(r => setTimeout(r, 2000))
      }

      setTxPending(false)
      setIsThinking(true)

      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          player: chainPlayer ?? INITIAL_PLAYER,
          enemy,
          context: `Turn ${narrative.length}`,
        }),
      })
      const result = await res.json()

      showDmg(dmgDealt, 'enemy')
      if (dmgReceived > 0) {
        setTimeout(() => {
          showDmg(dmgReceived, 'player')
          // Enemy attacks back
          setEnemyAnim('sprite-attack')
          setTimeout(() => {
            setPlayerAnim('sprite-hit')
            setTimeout(() => {
              setEnemyAnim(enemyKilled ? 'sprite-death' : 'sprite-idle')
              setPlayerAnim('sprite-idle')
            }, 400)
          }, 200)
        }, 800)
      }

      setEnemy(prev => prev ? { ...prev, hp: newEnemyHp } : null)

      let msg = result.narrative ?? `You struck for ${dmgDealt} damage.`
      if (result.specialEvent === 'critical_hit') msg = '⚡ CRITICAL HIT! ' + msg
      addLog(msg, 'dm', 'combat')

      if (enemyKilled) {
        setTimeout(async () => {
          addLog(`VICTORY — ${enemy.name} defeated.\n+${xpGained} XP · ${enemy.reward.CELO ?? 0} CELO earned`, 'system', 'reward')
          setPhase('victory')
          await refreshChainState()
        }, 500)
      } else {
        const newPlayerHp = Math.max(0, (chainPlayer?.hp ?? INITIAL_PLAYER.hp) - dmgReceived)
        if (newPlayerHp <= 0) {
          setTimeout(async () => {
            addLog('YOU HAVE FALLEN.\n\nYour progress is lost. Respawn on-chain to continue.', 'system', 'death')
            setPhase('dead')
            await refreshChainState()
          }, 600)
        }
      }
    } catch (e: unknown) {
      addLog(`Action failed: ${(e as Error).message}`, 'system')
    } finally {
      setIsThinking(false)
      setTxPending(false)
    }
  }, [enemy, isThinking, txPending, wallet, addLog, chainPlayer, narrative.length, showDmg, refreshChainState, triggerScreenShake])

  const handleRespawn = useCallback(async () => {
    setTxPending(true)
    try {
      const hash = await wallet.respawnPlayer()
      setTxHash(hash)
      addLog(`RESPAWN TX: ${hash.slice(0, 18)}...\nWaiting for Celo...`, 'system', 'event')
      await new Promise(r => setTimeout(r, 4000))
      const p = await wallet.readPlayer()
      if (p) setChainPlayer(p)
      addLog('RESPAWNED. Your data was erased. The Null forgets nothing.', 'system', 'event')
      setPhase('menu')
      setEnemy(null)
      setNarrative([])
    } catch (e: unknown) {
      addLog(`Respawn failed: ${(e as Error).message}`, 'system')
    } finally {
      setTxPending(false)
    }
  }, [wallet, addLog])

  const handleTweetRaid = useCallback(() => {
    const text = encodeURIComponent(`⚔️ Attacking THE 51% Raid Boss on @NullStateRPG!\n\nConsensus will fall. Join the raid 🔴\n\nnullstate.xyz #CeloRPG #Web3Gaming`)
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank')
  }, [])

  // Derived display values
  const displayHp    = chainPlayer?.hp        ?? INITIAL_PLAYER.hp
  const displayMaxHp = chainPlayer?.maxHp     ?? INITIAL_PLAYER.maxHp
  const displayXp    = chainPlayer?.xp        ?? INITIAL_PLAYER.xp
  const displayLevel = chainPlayer?.level     ?? INITIAL_PLAYER.level
  const displayKills = chainPlayer?.kills     ?? INITIAL_PLAYER.kills
  const displayDeaths= chainPlayer?.deaths    ?? INITIAL_PLAYER.deaths
  const hpPct        = Math.round((displayHp / displayMaxHp) * 100)
  const xpPct        = Math.min(100, Math.round(((displayXp % 500) / 500) * 100))
  const enemyHpPct   = enemy ? Math.round((enemy.hp / enemy.maxHp) * 100) : 100
  const raidHp       = raidData ? parseInt(raidData.currentHp, 16) : 6488
  const raidMaxHp    = raidData ? parseInt(raidData.maxHp, 16) : 10000
  const raidPct      = Math.round((raidHp / raidMaxHp) * 100)

  return (
    <>
      <style>{`
        @keyframes spriteIdle {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes spriteAttack {
          0% { transform: translateX(0) scaleX(1); }
          30% { transform: translateX(20px) scaleX(1.1); }
          60% { transform: translateX(-5px) scaleX(0.95); }
          100% { transform: translateX(0) scaleX(1); }
        }
        @keyframes spriteAttackLeft {
          0% { transform: translateX(0) scaleX(-1); }
          30% { transform: translateX(-20px) scaleX(-1.1); }
          60% { transform: translateX(5px) scaleX(-0.95); }
          100% { transform: translateX(0) scaleX(-1); }
        }
        @keyframes spriteHit {
          0% { transform: translateX(0); filter: brightness(1) drop-shadow(0 0 6px rgba(0,255,136,0.5)); }
          20% { transform: translateX(-8px); filter: brightness(3) drop-shadow(0 0 12px #ff2244); }
          40% { transform: translateX(6px); filter: brightness(2) drop-shadow(0 0 8px #ff2244); }
          60% { transform: translateX(-4px); filter: brightness(2); }
          100% { transform: translateX(0); filter: brightness(1) drop-shadow(0 0 6px rgba(0,255,136,0.5)); }
        }
        @keyframes enemyHit {
          0% { transform: scaleX(-1) translateX(0); filter: brightness(1); }
          20% { transform: scaleX(-1) translateX(8px); filter: brightness(3) drop-shadow(0 0 12px #ff2244); }
          40% { transform: scaleX(-1) translateX(-4px); filter: brightness(2); }
          100% { transform: scaleX(-1) translateX(0); filter: brightness(1); }
        }
        @keyframes spriteDeath {
          0% { transform: scaleX(-1) rotate(0deg) translateY(0); opacity: 1; }
          50% { transform: scaleX(-1) rotate(-45deg) translateY(10px); opacity: 0.5; }
          100% { transform: scaleX(-1) rotate(-90deg) translateY(20px); opacity: 0; }
        }
        @keyframes screenShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-4px, 2px); }
          40% { transform: translate(4px, -2px); }
          60% { transform: translate(-3px, 3px); }
          80% { transform: translate(3px, -1px); }
        }
        @keyframes scanlineMove {
          0% { background-position: 0 0; }
          100% { background-position: 0 8px; }
        }
        .sprite-idle { animation: spriteIdle 2s ease-in-out infinite; }
        .sprite-idle-enemy { animation: spriteIdle 2s ease-in-out infinite; transform: scaleX(-1); }
        .sprite-attack { animation: spriteAttack 0.5s ease-out forwards; }
        .sprite-attack-enemy { animation: spriteAttackLeft 0.5s ease-out forwards; }
        .sprite-hit { animation: spriteHit 0.5s ease-out forwards; }
        .sprite-hit-enemy { animation: enemyHit 0.5s ease-out forwards; }
        .sprite-death { animation: spriteDeath 0.8s ease-out forwards; }
        .screen-shake { animation: screenShake 0.4s ease-out; }
        .crt-scanlines {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.15) 2px,
            rgba(0,0,0,0.15) 4px
          );
          pointer-events: none;
        }
        .pixel-border {
          box-shadow:
            0 0 0 2px rgba(0,255,136,0.4),
            0 0 0 4px rgba(0,255,136,0.1),
            inset 0 0 40px rgba(0,0,0,0.6);
        }
        .health-bar-fill {
          transition: width 0.5s steps(20);
        }
        @keyframes dmgFloat {
          0% { transform: translateY(0) scale(0.5); opacity: 0; }
          20% { transform: translateY(-12px) scale(1.3); opacity: 1; }
          80% { transform: translateY(-50px) scale(1); opacity: 1; }
          100% { transform: translateY(-70px) scale(0.8); opacity: 0; }
        }
        .dmg-num { animation: dmgFloat 1.2s ease-out forwards; pointer-events: none; }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .blink { animation: blink 0.8s step-end infinite; }
        @keyframes menuPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(0,255,136,0.4); }
          50% { box-shadow: 0 0 0 1px rgba(0,255,136,0.8), 0 0 20px rgba(0,255,136,0.3); }
        }
        .menu-pulse { animation: menuPulse 2s ease-in-out infinite; }
      `}</style>

      <div className="min-h-screen bg-[#020a06] flex flex-col" style={{ fontFamily: "'Share Tech Mono', monospace" }}>

        {/* TOP NAV BAR — GAME HUD */}
        <div className="border-b border-[rgba(0,255,136,0.2)] bg-[rgba(0,0,0,0.6)] px-4 py-2 flex items-center justify-between">
          <Link href="/" className="font-mono text-[11px] text-null-muted hover:text-null-green transition-colors tracking-[2px] no-underline">
            ← NULL_STATE
          </Link>
          <div className="font-mono text-[11px] text-null-green tracking-[3px]">// CELO_CHRONICLES v1.0.0</div>
          <div className="flex items-center gap-3">
            {wallet.isConnected ? (
              <div className="flex items-center gap-2 text-[10px] text-null-green">
                <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
                <span>{wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}</span>
                {wallet.isMiniPay && <span className="text-null-muted">(MiniPay)</span>}
              </div>
            ) : (
              !wallet.isMiniPay && (
                <button
                  onClick={handleConnect}
                  className="font-mono text-[10px] text-null-green border border-[rgba(0,255,136,0.4)] px-3 py-1 hover:bg-[rgba(0,255,136,0.1)] transition-all"
                >
                  CONNECT WALLET
                </button>
              )
            )}
          </div>
        </div>

        {/* MAIN GAME AREA */}
        <div className="flex-1 flex flex-col lg:flex-row max-w-5xl mx-auto w-full p-4 gap-4">

          {/* LEFT PANEL — PLAYER + LOG */}
          <div className="flex-1 flex flex-col gap-3">

            {/* PLAYER STATS BAR */}
            <div className="border border-[rgba(0,255,136,0.2)] bg-[#010805] p-3 pixel-border">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <PlayerSprite size={56} animClass={playerAnim} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-null-green tracking-wider">HP</span>
                    <span className="text-[10px] text-null-green">{displayHp}/{displayMaxHp}</span>
                  </div>
                  <div className="h-3 bg-[rgba(255,255,255,0.06)] mb-2 border border-[rgba(0,255,136,0.1)]">
                    <div
                      className="health-bar-fill h-full"
                      style={{
                        width: `${hpPct}%`,
                        background: hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ffaa00' : '#ff2244',
                        boxShadow: `0 0 6px ${hpPct > 50 ? '#00ff88' : hpPct > 25 ? '#ffaa00' : '#ff2244'}`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-null-amber tracking-wider">XP</span>
                    <span className="text-[10px] text-null-amber">LVL {displayLevel} · {displayXp} XP</span>
                  </div>
                  <div className="h-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,170,0,0.1)]">
                    <div className="health-bar-fill h-full bg-[#ffaa00]" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
                {chainPlayer?.passportVerified && (
                  <span className="text-[9px] text-null-green border border-[rgba(0,255,136,0.3)] px-2 py-1 whitespace-nowrap">
                    ✓ PASSPORT
                  </span>
                )}
              </div>
            </div>

            {/* BATTLE ARENA */}
            <div
              className={`border border-[rgba(0,255,136,0.15)] bg-[#010a05] relative overflow-hidden ${screenShake ? 'screen-shake' : ''}`}
              style={{ minHeight: 200 }}
            >
              {/* CRT overlay */}
              <div className="absolute inset-0 crt-scanlines z-10 pointer-events-none" />

              {/* Battle scene */}
              {phase === 'combat' && enemy ? (
                <div className="relative flex items-end justify-between px-8 py-6" style={{ minHeight: 200 }}>
                  {/* Player side */}
                  <div className="flex flex-col items-center gap-1 relative z-20">
                    <div className="text-[9px] text-null-green tracking-wider mb-1">PLAYER</div>
                    {dmgNumbers.filter(d => d.side === 'player').map(d => (
                      <div key={d.id} className="absolute dmg-num font-display font-black text-xl text-[#ff2244] -top-4 left-1/2 -translate-x-1/2"
                        style={{ textShadow: '0 0 10px rgba(255,34,68,0.8)', zIndex: 30 }}>
                        -{d.val}
                      </div>
                    ))}
                    <PlayerSprite size={72} animClass={playerAnim} />
                  </div>

                  {/* VS center */}
                  <div className="flex flex-col items-center gap-2 z-20">
                    <div className="font-display text-[11px] text-null-muted tracking-[4px]">VS</div>
                    {isThinking && (
                      <div className="text-[9px] text-null-green animate-pulse tracking-wider">AI THINKING...</div>
                    )}
                  </div>

                  {/* Enemy side */}
                  <div className="flex flex-col items-center gap-1 relative z-20">
                    <div className="text-[9px] text-null-red tracking-wider mb-1">{enemy.class}</div>
                    {dmgNumbers.filter(d => d.side === 'enemy').map(d => (
                      <div key={d.id} className="absolute dmg-num font-display font-black text-xl text-[#ff2244] -top-4 left-1/2 -translate-x-1/2"
                        style={{ textShadow: '0 0 10px rgba(255,34,68,0.8)', zIndex: 30 }}>
                        -{d.val}
                      </div>
                    ))}
                    <PixelSprite
                      id={enemy.id}
                      size={72}
                      animClass={
                        enemyAnim === 'sprite-idle' ? 'sprite-idle-enemy' :
                        enemyAnim === 'sprite-attack' ? 'sprite-attack-enemy' :
                        enemyAnim === 'sprite-hit' ? 'sprite-hit-enemy' :
                        'sprite-death'
                      }
                      tint="rgba(255,34,68,0.5)"
                    />
                    {/* Enemy HP */}
                    <div className="mt-2 w-20">
                      <div className="flex justify-between text-[9px] text-null-red mb-0.5">
                        <span>HP</span><span>{enemy.hp}/{enemy.maxHp}</span>
                      </div>
                      <div className="h-2 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,34,68,0.2)]">
                        <div className="health-bar-fill h-full bg-[#ff2244]" style={{ width: `${enemyHpPct}%`, boxShadow: '0 0 4px #ff2244' }} />
                      </div>
                    </div>
                  </div>

                  {/* Background grid lines */}
                  <div className="absolute inset-0 z-0"
                    style={{ backgroundImage: 'linear-gradient(rgba(0,255,136,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.02) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
                  />
                </div>
              ) : phase === 'menu' || phase === 'registering' ? (
                <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
                  <div className="text-center">
                    <div className="flex justify-center gap-8 mb-4">
                      <PlayerSprite size={56} animClass="sprite-idle" />
                    </div>
                    <div className="font-mono text-[11px] text-null-muted tracking-widest">
                      {phase === 'registering' ? 'REGISTERING ON-CHAIN...' : 'AWAITING ENTRY INTO THE NULL'}
                    </div>
                  </div>
                </div>
              ) : phase === 'victory' ? (
                <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
                  <div className="text-center">
                    <div className="font-display text-2xl text-null-green mb-2" style={{ textShadow: '0 0 20px rgba(0,255,136,0.8)' }}>
                      VICTORY
                    </div>
                    <div className="font-mono text-[11px] text-null-muted">Enemy defeated. Awaiting next encounter.</div>
                  </div>
                </div>
              ) : phase === 'dead' ? (
                <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
                  <div className="text-center">
                    <div className="font-display text-2xl text-null-red mb-2" style={{ textShadow: '0 0 20px rgba(255,34,68,0.8)' }}>
                      YOU DIED
                    </div>
                    <div className="font-mono text-[11px] text-null-muted">Your soul dissolves into the null.</div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* NARRATIVE LOG */}
            <div className="border border-[rgba(0,255,136,0.12)] bg-[#010805] overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[rgba(0,255,136,0.08)] bg-[rgba(0,255,136,0.02)]">
                <div className="w-2 h-2 rounded-full bg-[#ff3b30]" />
                <div className="w-2 h-2 rounded-full bg-[#ffcc02]" />
                <div className="w-2 h-2 rounded-full bg-[#34c759]" />
                <span className="text-[10px] text-null-muted ml-2">AI_DM :: GROQ_70B</span>
                {isThinking && <span className="ml-auto text-[9px] text-null-green animate-pulse">GENERATING...</span>}
              </div>
              <div ref={logRef} className="p-3 text-[11px] leading-relaxed overflow-y-auto" style={{ minHeight: 140, maxHeight: 220, color: 'rgba(212,255,232,0.75)' }}>
                {narrative.length === 0 && (
                  <span className="text-null-muted">
                    {!wallet.isConnected
                      ? '> Connect wallet to begin...'
                      : !chainPlayer?.exists
                      ? '> Register on-chain to start...'
                      : '> Press ENTER THE NULL to begin.'}
                    <span className="blink ml-1">█</span>
                  </span>
                )}
                {narrative.map(msg => (
                  <div key={msg.id} className={`mb-2 ${
                    msg.role === 'player' ? 'text-null-blue' :
                    msg.type === 'reward' ? 'text-null-acid' :
                    msg.type === 'death' ? 'text-null-red' :
                    msg.type === 'event' ? 'text-null-amber' :
                    msg.role === 'system' ? 'text-null-muted' :
                    'text-[rgba(212,255,232,0.75)]'
                  }`}>
                    {msg.role === 'player' && <span className="text-null-green">{'>> '}</span>}
                    {msg.role === 'system' && <span className="text-null-muted">{'// '}</span>}
                    {msg.content.split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
                  </div>
                ))}
                {isThinking && <div className="text-null-green">DM is thinking<span className="blink ml-1">█</span></div>}
              </div>
            </div>

            {/* TX Hash */}
            {txHash && (
              <div className="text-[9px] text-null-muted flex items-center gap-2 px-1">
                <span className="text-null-green">TX:</span>
                <a href={`https://celoscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-null-blue hover:text-null-green truncate transition-colors">
                  {txHash.slice(0, 28)}...
                </a>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="space-y-2">
              {!wallet.isConnected && (
                <button onClick={handleConnect}
                  className="w-full text-[12px] tracking-[2px] uppercase font-bold py-4 text-[#020a06] bg-[#00ff88] menu-pulse transition-all"
                  style={{ clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  ⬡ CONNECT WALLET TO PLAY
                </button>
              )}

              {wallet.isConnected && !chainPlayer?.exists && phase !== 'registering' && (
                <button onClick={handleRegister} disabled={txPending}
                  className="w-full text-[12px] tracking-[2px] uppercase font-bold py-4 text-[#020a06] bg-[#00ff88] transition-all disabled:opacity-50"
                  style={{ clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  ⬡ REGISTER ON-CHAIN (FREE)
                </button>
              )}

              {wallet.isConnected && chainPlayer?.exists && phase === 'menu' && (
                <button onClick={startEncounter}
                  className="w-full text-[12px] tracking-[2px] uppercase font-bold py-4 text-[#020a06] bg-[#00ff88] menu-pulse transition-all"
                  style={{ clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  ⬡ ENTER THE NULL
                </button>
              )}

              {phase === 'combat' && (
                <div className="space-y-1.5">
                  {COMBAT_ACTIONS.map((action, i) => (
                    <button key={action.id} onClick={() => executeAction(action)} disabled={isThinking || txPending}
                      className="w-full text-[11px] tracking-wider py-3 px-4 flex items-center justify-between transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: i === 0 ? 'rgba(0,255,136,0.08)' : 'transparent',
                        border: `1px solid ${i === 0 ? 'rgba(0,255,136,0.35)' : 'rgba(0,255,136,0.12)'}`,
                        clipPath: 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)',
                        color: i === 0 ? '#00ff88' : 'rgba(42,74,53,1)',
                      }}
                      onMouseEnter={e => { if (!isThinking && !txPending) { const el = e.currentTarget as HTMLElement; el.style.borderColor = 'rgba(0,255,136,0.5)'; el.style.color = '#00ff88'; el.style.background = 'rgba(0,255,136,0.06)' } }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.borderColor = i === 0 ? 'rgba(0,255,136,0.35)' : 'rgba(0,255,136,0.12)'; el.style.color = i === 0 ? '#00ff88' : 'rgba(42,74,53,1)'; el.style.background = i === 0 ? 'rgba(0,255,136,0.08)' : 'transparent' }}>
                      <span>ACTION {String.fromCharCode(65 + i)}: {action.label}</span>
                      <span className="text-[9px] opacity-60">{action.costCELO} CELO</span>
                    </button>
                  ))}
                </div>
              )}

              {phase === 'victory' && (
                <button onClick={startEncounter}
                  className="w-full text-[12px] tracking-[2px] uppercase font-bold py-4 text-[#020a06] bg-[#00ff88] transition-all"
                  style={{ clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  ⬡ NEXT ENCOUNTER
                </button>
              )}

              {phase === 'dead' && (
                <button onClick={handleRespawn} disabled={txPending}
                  className="w-full text-[12px] tracking-[2px] uppercase font-bold py-4 transition-all disabled:opacity-50"
                  style={{ background: '#ff2244', color: '#020a06', clipPath: 'polygon(12px 0,100% 0,calc(100% - 12px) 100%,0 100%)' }}>
                  💀 RESPAWN — LOSE ALL PROGRESS
                </button>
              )}

              {txPending && (
                <div className="text-[10px] text-null-amber tracking-wider text-center animate-pulse py-2">
                  ⏳ TX PENDING ON CELO...
                </div>
              )}

              {(phase === 'combat' || phase === 'victory') && (
                <button onClick={handleTweetRaid}
                  className="w-full text-[10px] tracking-[2px] uppercase font-bold py-2.5 flex items-center justify-center gap-2 transition-all"
                  style={{ background: 'rgba(29,155,240,0.1)', border: '1px solid rgba(29,155,240,0.3)', color: '#1d9bf0', clipPath: 'polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%)' }}>
                  𝕏 TWEET TO ATTACK RAID BOSS
                </button>
              )}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-full lg:w-64 space-y-3">

            {/* WORLD EVENT: RAID BOSS */}
            <div className="border border-[rgba(255,34,68,0.25)] bg-[rgba(255,34,68,0.03)] p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1.5 h-1.5 rounded-full bg-null-red animate-pulse" />
                <span className="text-[9px] text-null-red tracking-[3px]">
                  {raidData?.active ? 'RAID ACTIVE' : 'WORLD EVENT'}
                </span>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <img src={`data:image/svg+xml,${encodeURIComponent(BOSS_PIXEL_SVG)}`} width={32} height={32} style={{ imageRendering: 'pixelated', filter: 'drop-shadow(0 0 8px rgba(255,34,68,0.6))', animation: 'spriteIdle 2s ease-in-out infinite' }} alt="Boss" />
                <div className="flex-1">
                  <div className="text-[11px] text-null-red font-bold tracking-wider">THE 51%</div>
                  <div className="text-[9px] text-null-muted">CONSENSUS DESTROYER</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-null-red font-bold">{raidHp.toLocaleString()}</div>
                  <div className="text-[8px] text-null-muted">/ {raidMaxHp.toLocaleString()}</div>
                </div>
              </div>

              <div className="h-2 bg-[rgba(255,255,255,0.05)] mb-3 border border-[rgba(255,34,68,0.1)]">
                <div className="h-full transition-all duration-700" style={{ width: `${raidPct}%`, background: 'linear-gradient(90deg,#ff2244,#ff6600)', boxShadow: '0 0 6px rgba(255,34,68,0.5)' }} />
              </div>

              <button onClick={handleTweetRaid}
                className="w-full text-[10px] tracking-wider uppercase py-2 flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(90deg,#1d9bf0,#0d7fd4)', clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)', color: 'white' }}>
                𝕏 TWEET TO ATTACK
              </button>
            </div>

            {/* BESTIARY CARD */}
            {enemy && phase === 'combat' && (
              <div className="border border-[rgba(255,34,68,0.2)] bg-[#010805] p-3">
                <div className="text-[9px] text-null-red tracking-[3px] mb-1">{enemy.class}</div>
                <div className="text-[12px] text-null-white font-bold uppercase tracking-wide mb-2">{enemy.name}</div>
                <div className="text-[9px] text-null-muted leading-relaxed mb-2">{enemy.description}</div>
                {enemy.weakness && (
                  <div className="text-[9px] text-null-amber">⚡ WEAKNESS: {enemy.weakness}</div>
                )}
                <div className="mt-2 pt-2 border-t border-[rgba(255,34,68,0.1)] flex gap-3 text-[9px] text-null-muted">
                  <span>DMG: {enemy.power}-{enemy.power + 15}</span>
                  <span>XP: {enemy.reward.xp}</span>
                </div>
              </div>
            )}

            {/* ON-CHAIN STATS */}
            <div className="border border-[rgba(0,255,136,0.1)] bg-[#010805] p-3">
              <div className="text-[9px] text-null-muted tracking-[3px] uppercase mb-3">// ON-CHAIN STATS</div>
              {[
                ['KILLS',    displayKills.toString()],
                ['DEATHS',   displayDeaths.toString()],
                ['LEVEL',    displayLevel.toString()],
                ['CELO BAL', wallet.celoBalance + ' CELO'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center py-1 border-b border-[rgba(0,255,136,0.05)]">
                  <span className="text-[10px] text-null-muted tracking-wider">{label}</span>
                  <span className="text-[11px] text-null-green font-bold">{value}</span>
                </div>
              ))}
              {wallet.isConnected && (
                <div className="pt-2">
                  <a href={`https://celoscan.io/address/${wallet.address}`} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] text-null-blue hover:text-null-green transition-colors tracking-wider no-underline">
                    VIEW ON CELOSCAN →
                  </a>
                </div>
              )}
            </div>

            {/* LIVE RAID FEED */}
            <LiveRaidFeed />

            {/* IN-GAME LEADERBOARD */}
            <InGameLeaderboard />
          </div>
        </div>
      </div>
    </>
  )
}
