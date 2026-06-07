'use client'

import { useState, useEffect } from 'react'

// Inline pixel SVG sprites (same as game)
const PLAYER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="11" y="14" width="10" height="11" fill="#4a9e6b"/><rect x="12" y="7" width="8" height="7" fill="#c8a87c"/><rect x="11" y="5" width="10" height="4" fill="#a0a0c0"/><rect x="10" y="7" width="2" height="4" fill="#a0a0c0"/><rect x="20" y="7" width="2" height="4" fill="#a0a0c0"/><rect x="13" y="9" width="2" height="2" fill="#00ff88"/><rect x="17" y="9" width="2" height="2" fill="#00ff88"/><rect x="8" y="14" width="3" height="8" fill="#4a9e6b"/><rect x="21" y="14" width="3" height="8" fill="#4a9e6b"/><rect x="24" y="10" width="2" height="12" fill="#c0c0d0"/><rect x="23" y="13" width="4" height="2" fill="#a06020"/><rect x="11" y="25" width="4" height="5" fill="#3a7a55"/><rect x="17" y="25" width="4" height="5" fill="#3a7a55"/><rect x="10" y="28" width="5" height="3" fill="#2a4a35"/><rect x="17" y="28" width="5" height="3" fill="#2a4a35"/></svg>`

const GOBLIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="image-rendering:pixelated"><rect x="10" y="15" width="12" height="10" fill="#cc4400"/><rect x="9" y="8" width="14" height="9" fill="#dd5500"/><rect x="7" y="5" width="4" height="6" fill="#cc4400"/><rect x="21" y="5" width="4" height="6" fill="#cc4400"/><rect x="8" y="3" width="2" height="4" fill="#ff7722"/><rect x="22" y="3" width="2" height="4" fill="#ff7722"/><rect x="11" y="10" width="3" height="3" fill="#ffdd00"/><rect x="18" y="10" width="3" height="3" fill="#ffdd00"/><rect x="12" y="11" width="1" height="1" fill="#000"/><rect x="19" y="11" width="1" height="1" fill="#000"/><rect x="12" y="14" width="8" height="2" fill="#660000"/><rect x="7" y="15" width="3" height="7" fill="#cc4400"/><rect x="22" y="15" width="3" height="7" fill="#cc4400"/><rect x="6" y="21" width="2" height="3" fill="#ff6600"/><rect x="22" y="21" width="2" height="3" fill="#ff6600"/><rect x="11" y="25" width="4" height="5" fill="#aa3300"/><rect x="17" y="25" width="4" height="5" fill="#aa3300"/><rect x="14" y="18" width="4" height="4" fill="#ffaa00"/></svg>`

export default function GamePreviewSection() {
  const [bossHp, setBossHp] = useState(8750)
  const [attackers, setAttackers] = useState(247)
  const [playerHp, setPlayerHp] = useState(85)
  const [enemyHp, setEnemyHp] = useState(80)
  const [battleLog, setBattleLog] = useState<string[]>([
    '> ENCOUNTER: Gas Goblin — NETWORK DAEMON',
    '> Your strike ignites green gas sparks. Gas Goblin staggers — HP drops 20!',
    "> Gas Goblin prepares the dreaded 'Out of Gas' curse...",
  ])
  const [isAttacking, setIsAttacking] = useState(false)
  const [playerAnim, setPlayerAnim] = useState(false)
  const [enemyAnim, setEnemyAnim] = useState(false)
  const [dmg, setDmg] = useState<{ show: boolean; val: number; side: 'enemy' | 'player' }>({ show: false, val: 0, side: 'enemy' })

  useEffect(() => {
    const interval = setInterval(() => {
      setBossHp(hp => Math.max(7000, hp - Math.floor(Math.random() * 15)))
      setAttackers(a => a + Math.floor(Math.random() * 3))
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleDemoAttack = () => {
    if (isAttacking) return
    setIsAttacking(true)
    setPlayerAnim(true)

    const dmgDealt = Math.floor(Math.random() * 20) + 10
    const dmgRec = Math.floor(Math.random() * 12) + 5

    setTimeout(() => {
      setEnemyAnim(true)
      setDmg({ show: true, val: dmgDealt, side: 'enemy' })
    }, 250)

    setTimeout(() => {
      setEnemyHp(h => Math.max(0, h - dmgDealt))
      setPlayerHp(h => Math.max(10, h - dmgRec))
      setDmg({ show: false, val: 0, side: 'enemy' })
    }, 500)

    setTimeout(() => {
      setDmg({ show: true, val: dmgRec, side: 'player' })
    }, 700)

    setTimeout(() => {
      setPlayerAnim(false)
      setEnemyAnim(false)
      setDmg({ show: false, val: 0, side: 'player' })
      setBattleLog(prev => [
        ...prev.slice(-3),
        `> You dealt ${dmgDealt} damage! Enemy HP: ${Math.max(0, enemyHp - dmgDealt)}/${80}`,
        `> Gas Goblin retaliates for ${dmgRec} damage!`,
      ])
      setIsAttacking(false)
    }, 1200)
  }

  const playerEnc = encodeURIComponent(PLAYER_SVG)
  const goblinEnc = encodeURIComponent(GOBLIN_SVG)

  return (
    <section id="game" className="relative py-24 overflow-hidden z-[2]">
      <style>{`
        @keyframes idleBob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes idleBobFlip { 0%,100% { transform: scaleX(-1) translateY(0); } 50% { transform: scaleX(-1) translateY(-5px); } }
        @keyframes attackAnim { 0% { transform: translateX(0); } 35% { transform: translateX(22px); } 65% { transform: translateX(-3px); } 100% { transform: translateX(0); } }
        @keyframes hitAnim { 0% { transform: scaleX(-1); filter: brightness(1); } 25% { transform: scaleX(-1) translateX(10px); filter: brightness(4) drop-shadow(0 0 8px #ff2244); } 75% { transform: scaleX(-1) translateX(-3px); filter: brightness(2); } 100% { transform: scaleX(-1); filter: brightness(1); } }
        @keyframes dmgPop { 0% { transform: translateY(0) scale(0); opacity: 0; } 30% { transform: translateY(-14px) scale(1.4); opacity: 1; } 80% { transform: translateY(-36px) scale(1); opacity: 1; } 100% { transform: translateY(-54px) scale(0.8); opacity: 0; } }
        .idle-bob { animation: idleBob 2s ease-in-out infinite; }
        .idle-bob-flip { animation: idleBobFlip 2s ease-in-out infinite; }
        .attack-anim { animation: attackAnim 0.5s ease-out forwards; }
        .hit-anim { animation: hitAnim 0.5s ease-out forwards; }
        .dmg-pop { animation: dmgPop 1s ease-out forwards; position: absolute; font-family: 'Orbitron', monospace; font-weight: 900; pointer-events: none; }
        .crt-lines { background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px); }
      `}</style>

      {/* Section label */}
      <div className="text-center mb-16">
        <div className="reveal font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
          // GAMEPLAY PREVIEW
        </div>
        <h2
          className="reveal font-display font-bold text-null-white"
          style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1, transitionDelay: '0.1s' }}
        >
          THE GAME IS<br /><em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>ALREADY RUNNING</em>
        </h2>
      </div>

      <div className="max-w-6xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-16">

        {/* LEFT — LIVE GAME PREVIEW PHONE */}
        <div className="reveal flex-shrink-0 relative" style={{ transitionDelay: '0.2s' }}>
          {/* Ambient glow */}
          <div className="absolute pointer-events-none" style={{
            inset: '-80px',
            background: 'radial-gradient(ellipse at 50% 60%, rgba(0,255,136,0.18) 0%, rgba(0,170,255,0.06) 35%, transparent 65%)',
            filter: 'blur(50px)', borderRadius: '50%', zIndex: 0,
          }} />

          {/* Phone */}
          <div className="relative z-[1] game-phone" style={{ width: 300 }}>

            {/* Phone header */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.03)]">
              <span className="font-display text-[10px] text-null-green tracking-[3px] font-bold">CELO_CHRONICLES</span>
              <span className="font-mono text-[8px] text-null-muted">// v1.0.0</span>
            </div>

            {/* Wallet bar */}
            <div className="px-3 py-2 flex items-center justify-between bg-[rgba(0,0,0,0.2)]">
              <span className="font-mono text-[9px] text-null-muted">
                CONNECTED: 0xa1D5.. <span className="text-null-green">(MiniPay)</span>
              </span>
              <div className="flex gap-0.5 items-end">
                {[1,2,3].map(i => (
                  <div key={i} className="w-0.5 bg-null-green" style={{ height: `${4 + i * 3}px` }} />
                ))}
              </div>
            </div>

            {/* Player stats */}
            <div className="mx-2 mt-2 p-2 border border-[rgba(0,255,136,0.15)] bg-[rgba(0,255,136,0.02)]">
              <div className="flex items-center gap-2">
                <img src={`data:image/svg+xml,${playerEnc}`} width={32} height={32} style={{ imageRendering: 'pixelated' }} alt="" />
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-mono text-[8px] text-null-red">♥</span>
                    <div className="flex-1 h-2.5 bg-[rgba(255,255,255,0.08)] overflow-hidden">
                      <div className="h-full transition-all duration-500" style={{
                        width: `${playerHp}%`,
                        background: 'linear-gradient(90deg,#00cc6a,#00ff88)',
                        boxShadow: '0 0 6px rgba(0,255,136,0.5)',
                      }} />
                    </div>
                    <span className="font-mono text-[9px] text-null-green">{playerHp}/100</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex-1 h-1.5 bg-[rgba(255,255,255,0.06)] overflow-hidden">
                      <div className="h-full" style={{ width: '52%', background: 'linear-gradient(90deg,#ffaa00,#ffdd44)' }} />
                    </div>
                    <span className="font-mono text-[8px] text-null-amber">420 XP · LVL 4</span>
                  </div>
                </div>
              </div>
              <div className="font-mono text-[8px] text-null-green mt-1">✓ ON-CHAIN PASSPORT VERIFIED</div>
            </div>

            {/* BATTLE ARENA */}
            <div className="mx-2 mt-2 border border-[rgba(0,255,136,0.1)] bg-[#010a05] relative overflow-hidden" style={{ height: 110 }}>
              {/* CRT scanlines */}
              <div className="absolute inset-0 crt-lines pointer-events-none z-10" />
              {/* Grid bg */}
              <div className="absolute inset-0 z-0" style={{
                backgroundImage: 'linear-gradient(rgba(0,255,136,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,136,0.025) 1px, transparent 1px)',
                backgroundSize: '16px 16px',
              }} />

              {/* Player sprite */}
              <div className="absolute left-4 bottom-2 z-20">
                <div className={isAttacking && playerAnim ? 'attack-anim' : 'idle-bob'} style={{ imageRendering: 'pixelated' }}>
                  <img src={`data:image/svg+xml,${playerEnc}`} width={48} height={48} style={{ imageRendering: 'pixelated' }} alt="Player" />
                </div>
                {/* Player dmg number */}
                {dmg.show && dmg.side === 'player' && (
                  <div className="dmg-pop text-[14px] text-[#ff2244]" style={{ left: '50%', bottom: 48, transform: 'translateX(-50%)' }}>
                    -{dmg.val}
                  </div>
                )}
              </div>

              {/* Enemy sprite */}
              <div className="absolute right-4 bottom-2 z-20">
                <div className={isAttacking && enemyAnim ? 'hit-anim' : 'idle-bob-flip'} style={{ imageRendering: 'pixelated' }}>
                  <img src={`data:image/svg+xml,${goblinEnc}`} width={48} height={48} style={{ imageRendering: 'pixelated' }} alt="Gas Goblin" />
                </div>
                {/* Enemy dmg number */}
                {dmg.show && dmg.side === 'enemy' && (
                  <div className="dmg-pop text-[14px] text-[#ff2244]" style={{ left: '50%', bottom: 48, transform: 'translateX(-50%)' }}>
                    -{dmg.val}
                  </div>
                )}
                {/* Enemy HP */}
                <div className="absolute -top-5 right-0 flex items-center gap-1 whitespace-nowrap">
                  <span className="font-mono text-[7px] text-null-red">{enemyHp}/80</span>
                </div>
              </div>

              {/* VS */}
              <div className="absolute inset-x-0 top-2 flex justify-center z-20">
                <span className="font-mono text-[9px] text-null-muted tracking-[4px]">VS</span>
              </div>
            </div>

            {/* Narrative box */}
            <div className="mx-2 mt-2 p-2 border border-[rgba(0,255,136,0.08)] bg-[rgba(0,0,0,0.2)]" style={{ maxHeight: 62, overflow: 'hidden' }}>
              {battleLog.slice(-2).map((line, i) => (
                <p key={i} className="font-mono text-[9px] leading-relaxed" style={{ color: 'rgba(212,255,232,0.7)' }}>
                  {line}
                </p>
              ))}
            </div>

            {/* Action buttons */}
            <div className="mx-2 mt-2 space-y-1.5">
              <button
                onClick={handleDemoAttack}
                disabled={isAttacking}
                className="w-full font-mono text-[10px] tracking-wider py-2.5 px-3 text-null-bg font-bold flex items-center justify-between transition-all disabled:opacity-60"
                style={{
                  background: 'linear-gradient(90deg,var(--null-green),var(--null-acid))',
                  clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)',
                }}
              >
                <span>ACTION A (0.01 CELO): Artifact Strike</span>
                <span className="text-[8px] opacity-70">M</span>
              </button>
              <button
                className="w-full font-mono text-[10px] tracking-wider py-2.5 px-3 text-null-muted border border-[rgba(0,255,136,0.1)] flex items-center justify-between bg-transparent"
                style={{ clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)' }}
              >
                <span>ACTION B (0.01 CELO): Retreat</span>
                <span className="text-[8px] opacity-50">M</span>
              </button>
            </div>

            {/* World event */}
            <div className="mx-2 mt-2 mb-3 border border-[rgba(0,170,255,0.2)] bg-[rgba(0,170,255,0.04)]">
              <div className="px-3 py-1.5 flex items-center justify-between">
                <span className="font-mono text-[8px] text-null-blue tracking-wider">WORLD EVENT: RAID BOSS ACTIVE</span>
                <span className="font-mono text-[8px] text-null-muted">{attackers} raiders</span>
              </div>
              <div className="h-1 bg-[rgba(255,255,255,0.05)] mx-3 mb-2">
                <div className="h-full transition-all duration-1000" style={{
                  width: `${(bossHp / 10000) * 100}%`,
                  background: 'linear-gradient(90deg,#00aaff,#00ddff)',
                  boxShadow: '0 0 8px rgba(0,170,255,0.5)',
                }} />
              </div>
            </div>

            {/* Tweet button */}
            <div className="mx-2 mb-3">
              <button
                className="w-full font-mono text-[10px] tracking-wider py-2.5 text-white font-bold flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(90deg,#1d9bf0,#0d7fd4)', clipPath: 'polygon(6px 0,100% 0,calc(100% - 6px) 100%,0 100%)' }}
              >
                𝕏 TWEET TO ATTACK RAID BOSS
              </button>
            </div>

            {/* Try it label */}
            <div className="mx-2 mb-3 text-center">
              <span className="font-mono text-[8px] text-null-muted tracking-wider">
                ↑ TRY IT — CLICK ACTION A TO DEMO COMBAT
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT — feature explanations */}
        <div className="flex-1 space-y-8">
          <div className="reveal" style={{ transitionDelay: '0.1s' }}>
            <h3 className="font-display text-null-white text-lg font-bold uppercase tracking-wide mb-2">
              AI Dungeon Master
            </h3>
            <p className="text-[rgba(212,255,232,0.55)] font-light leading-relaxed text-[15px]">
              Powered by Groq's 70B LLM — fastest inference available. Every action generates a unique narrative in milliseconds. No two battles are alike.
            </p>
            <span className="inline-block mt-2 font-mono text-[10px] text-null-green border border-[rgba(0,255,136,0.2)] px-2 py-1 tracking-wider">GROQ_LLM_70B</span>
          </div>

          <div className="reveal border-t border-[rgba(0,255,136,0.06)] pt-8" style={{ transitionDelay: '0.2s' }}>
            <h3 className="font-display text-null-white text-lg font-bold uppercase tracking-wide mb-2">
              PS1-Style Pixel Combat
            </h3>
            <p className="text-[rgba(212,255,232,0.55)] font-light leading-relaxed text-[15px]">
              Blockchain enemies rendered as pixel sprites with full attack, hit, and death animations. Every encounter feels like a retro RPG — but your wallet is the save file.
            </p>
            <span className="inline-block mt-2 font-mono text-[10px] text-null-amber border border-[rgba(255,170,0,0.2)] px-2 py-1 tracking-wider">PIXEL ART ENGINE</span>
          </div>

          <div className="reveal border-t border-[rgba(0,255,136,0.06)] pt-8" style={{ transitionDelay: '0.3s' }}>
            <h3 className="font-display text-null-white text-lg font-bold uppercase tracking-wide mb-2">
              Social Combat Layer
            </h3>
            <p className="text-[rgba(212,255,232,0.55)] font-light leading-relaxed text-[15px]">
              Raid Bosses are shared enemies. Every player attacks together. Tweet to deal bonus damage. The more social noise, the faster the boss falls.
            </p>
            <span className="inline-block mt-2 font-mono text-[10px] text-[#1d9bf0] border border-[rgba(29,155,240,0.2)] px-2 py-1 tracking-wider">𝕏 SOCIAL COMBAT</span>
          </div>

          <div className="reveal pt-6" style={{ transitionDelay: '0.4s' }}>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Action Cost', value: '0.01', unit: 'CELO' },
                { label: 'Block Time', value: '5s', unit: 'Celo' },
                { label: 'Gas Fee', value: '$0.001', unit: 'avg' },
              ].map(stat => (
                <div key={stat.label} className="border border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.02)] p-3">
                  <div className="font-mono text-[9px] text-null-muted tracking-widest uppercase mb-1">{stat.label}</div>
                  <div className="font-display text-null-green font-bold text-xl" style={{ textShadow: 'var(--null-glow)' }}>{stat.value}</div>
                  <div className="font-mono text-[9px] text-null-muted tracking-wider mt-0.5">{stat.unit}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Launch CTA */}
          <div className="reveal pt-2" style={{ transitionDelay: '0.5s' }}>
            <a
              href="/game"
              className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[2px] uppercase text-null-bg bg-null-green px-8 py-3 no-underline transition-all hover:bg-null-acid"
              style={{ clipPath: 'polygon(10px 0,100% 0,calc(100% - 10px) 100%,0 100%)' }}
            >
              ⬡ LAUNCH FULL GAME
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
