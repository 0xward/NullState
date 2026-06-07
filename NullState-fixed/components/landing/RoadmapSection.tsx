'use client'

export default function RoadmapSection() {
  const phases = [
    {
      phase: 'PHASE 01',
      timing: 'NOW',
      title: 'Genesis',
      active: true,
      items: [
        'AI DM engine live (Groq)',
        'MiniPay deep integration',
        'Core combat loop',
        'Celo Passport verify',
        'Social combat (Twitter)',
        'Raid Boss v1',
      ],
    },
    {
      phase: 'PHASE 02',
      timing: 'Q3 2025',
      title: 'Expansion',
      active: false,
      items: [
        'Artifact NFT minting (ERC-721)',
        'Zone unlocks (5 new areas)',
        'World Events v1',
        'Leaderboard on-chain',
        'Referral rewards',
        'Discord integration',
      ],
    },
    {
      phase: 'PHASE 03',
      timing: 'Q4 2025',
      title: 'Protocol Wars',
      active: false,
      items: [
        'Multiplayer raid system',
        'Social combat layer v2',
        'DAO governance (token)',
        'Lore NFT drops',
        'PvP arena mode',
        'Mobile app (React Native)',
      ],
    },
    {
      phase: 'PHASE 04',
      timing: '2026',
      title: 'Null Protocol',
      active: false,
      items: [
        'Full world persistence',
        'Cross-chain bridges',
        'Animated pixel client',
        'Tournament seasons',
        'SDK for third-party zones',
        'Web3 game passport',
      ],
    },
  ]

  return (
    <section id="roadmap" className="relative py-24 z-[2]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="reveal text-center mb-16">
          <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
            // DEPLOYMENT SCHEDULE
          </div>
          <h2
            className="font-display font-bold text-null-white"
            style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
          >
            EXECUTION{' '}
            <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>
              ROADMAP
            </em>
          </h2>
        </div>

        {/* Timeline */}
        <div className="reveal relative" style={{ transitionDelay: '0.1s' }}>
          {/* Horizontal connector */}
          <div className="hidden lg:block absolute top-4 left-4 right-4 h-px bg-[rgba(0,255,136,0.1)]" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {phases.map((phase, i) => (
              <div key={phase.phase} className="relative pt-10" style={{ transitionDelay: `${i * 0.1}s` }}>
                {/* Dot */}
                <div
                  className="absolute top-0 left-0 w-8 h-8 flex items-center justify-center"
                  style={{
                    background: phase.active ? 'var(--null-green)' : 'var(--null-bg)',
                    border: `1px solid ${phase.active ? 'var(--null-green)' : 'rgba(0,255,136,0.2)'}`,
                    clipPath: 'polygon(4px 0, 100% 0, calc(100% - 4px) 100%, 0 100%)',
                    boxShadow: phase.active ? 'var(--null-glow)' : 'none',
                  }}
                >
                  {phase.active && (
                    <div className="w-2 h-2 bg-null-bg rounded-none" />
                  )}
                </div>

                <div className="font-mono text-[9px] tracking-[3px] text-null-muted uppercase mb-1">
                  {phase.phase} :: {phase.timing}
                </div>
                <h3
                  className="font-hud font-semibold uppercase tracking-wide mb-3 text-[16px]"
                  style={{ color: phase.active ? 'var(--null-green)' : 'var(--null-white)' }}
                >
                  {phase.title}
                  {phase.active && (
                    <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-null-green align-middle animate-pulse" />
                  )}
                </h3>
                <ul className="space-y-1.5">
                  {phase.items.map(item => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="font-mono text-[10px] text-null-green flex-shrink-0 mt-0.5">//</span>
                      <span
                        className="font-mono text-[11px] leading-snug"
                        style={{ color: phase.active ? 'rgba(212,255,232,0.6)' : 'rgba(42,74,53,0.8)' }}
                      >
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Celo + MiniPay strip */}
        <div className="reveal mt-16 grid md:grid-cols-2 gap-4" style={{ transitionDelay: '0.3s' }}>
          {/* Celo */}
          <div className="border border-[rgba(0,255,136,0.15)] bg-[rgba(0,255,136,0.02)] p-6 flex items-center gap-6">
            <div className="relative flex-shrink-0">
              {[1, 2, 3].map(i => (
                <div
                  key={i}
                  className="absolute rounded-full border border-[rgba(0,255,136,0.15)]"
                  style={{
                    width: `${50 + i * 20}px`,
                    height: `${50 + i * 20}px`,
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    animation: `rotateCW ${10 + i * 5}s linear ${i % 2 === 0 ? 'reverse' : ''} infinite`,
                  }}
                />
              ))}
              <div className="relative z-10 w-10 h-10 flex items-center justify-center">
                <span className="font-display font-black text-[10px] text-null-green tracking-wider">CELO</span>
              </div>
            </div>
            <div>
              <div className="font-display font-bold text-null-white text-base uppercase tracking-wide mb-1">Built on Celo</div>
              <p className="font-mono text-[10px] text-null-muted leading-relaxed">
                Carbon neutral · Sub-cent fees · 5s block time · Mobile-first L1
              </p>
            </div>
          </div>

          {/* MiniPay */}
          <div className="border border-[rgba(255,170,0,0.2)] bg-[rgba(255,170,0,0.02)] p-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-null-amber animate-pulse" />
              <span className="font-mono text-[10px] text-null-amber tracking-[2px] uppercase">PROOF OF SHIP VERIFIED</span>
            </div>
            <div className="font-display font-bold text-null-white text-base uppercase tracking-wide mb-1">
              MiniPay Native
            </div>
            <p className="font-mono text-[10px] text-null-muted leading-relaxed mb-3">
              Zero setup friction — instant play for 10M+ MiniPay users in Africa &amp; Southeast Asia.
            </p>
            <div className="flex gap-2 flex-wrap">
              {['✓ DEEPLINK READY', '✓ CELO PAYMENTS', '✓ MOBILE FIRST'].map(tag => (
                <span key={tag} className="font-mono text-[9px] text-null-green border border-[rgba(0,255,136,0.15)] px-2 py-0.5 tracking-wider">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
