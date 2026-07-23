'use client'

export default function FeaturesSection() {
  const steps = [
    {
      num: '01',
      title: 'Connect Wallet',
      desc: 'Open MiniPay or any Celo-compatible wallet. Your address becomes your player identity — no account creation.',
    },
    {
      num: '02',
      title: 'Gear Up The Knight',
      desc: 'You play as the Knight. Weapons, armor, and cosmetic outfits — earned or bought — shape how you look and hit.',
    },
    {
      num: '03',
      title: 'Descend The Bunkers',
      desc: 'Fight your way through procedurally generated floors, loot containers, and find the Golden Key before it relocates.',
    },
    {
      num: '04',
      title: 'Burn. Earn. Climb.',
      desc: 'Burn loot for NullState Point to gear up, solve the weekly Vault code for real USDT, and climb the monthly leaderboard.',
    },
  ]

  return (
    <>
      {/* Gameplay Flow */}
      <section id="gameplay" className="relative py-24 z-[2]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="reveal text-center mb-16">
            <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-3">
              // HOW TO PLAY
            </div>
            <h2
              className="font-display font-bold text-null-white"
              style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
            >
              THE GAMEPLAY <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>LOOP</em>
            </h2>
          </div>

          <div className="reveal relative" style={{ transitionDelay: '0.15s' }}>
            <div className="hidden lg:block absolute top-8 left-8 right-8 h-px bg-gradient-to-r from-null-green via-null-green to-transparent opacity-20" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((step, i) => (
                <div
                  key={step.num}
                  className="reveal relative border border-[rgba(0,255,136,0.1)] bg-[rgba(0,255,136,0.02)] p-6 hover:border-[rgba(0,255,136,0.25)] hover:bg-[rgba(0,255,136,0.04)] transition-all duration-300"
                  style={{ transitionDelay: `${0.1 * i}s` }}
                >
                  <div
                    className="font-display font-black text-[52px] leading-none mb-4"
                    style={{ color: 'rgba(0,255,136,0.06)', letterSpacing: '-2px' }}
                  >
                    {step.num}
                  </div>
                  <h3 className="font-display font-bold text-null-white text-[14px] uppercase tracking-wide mb-2">
                    {step.title}
                  </h3>
                  <p className="font-light leading-relaxed text-[13px]" style={{ color: 'rgba(212,255,232,0.5)' }}>
                    {step.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
