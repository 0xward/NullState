'use client'

// This component is the in-landing-page "play now" section.
// The full game lives at /game.

export default function GameUI() {
  return (
    <section id="play" className="relative py-24 z-[2]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <div className="font-mono text-[10px] tracking-[5px] text-null-green uppercase mb-4">
          // PLAY NOW
        </div>
        <h2
          className="font-display font-bold text-null-white mb-6"
          style={{ fontSize: 'clamp(28px, 5vw, 52px)', lineHeight: 1.1 }}
        >
          ENTER THE <em className="text-null-green not-italic" style={{ textShadow: 'var(--null-glow)' }}>NULL</em>
        </h2>
        <p className="text-[rgba(212,255,232,0.55)] font-light leading-relaxed text-[15px] max-w-lg mx-auto mb-10">
          The full game runs as a standalone app. Connect your wallet, register on-chain, and fight your first encounter — all in one place.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <a
            href="/game"
            className="font-mono text-[13px] tracking-[2px] uppercase text-null-bg bg-null-green px-10 py-4 inline-flex items-center gap-2 transition-all duration-200 no-underline hover:bg-null-acid"
            style={{ clipPath: 'polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)', boxShadow: '0 0 30px rgba(0,255,136,0.25)' }}
          >
            <span>⬡</span> LAUNCH GAME
          </a>
        </div>
        <div className="mt-8 font-mono text-[10px] text-null-muted tracking-wider">
          Works on MiniPay · MetaMask · Any Celo Wallet
        </div>
      </div>
    </section>
  )
}
