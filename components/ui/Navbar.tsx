'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useWallet } from '@/lib/WalletProvider'

export default function Navbar() {
  const [blockNum, setBlockNum] = useState(28441902)
  const [scrolled, setScrolled]  = useState(false)
  const [menuOpen, setMenuOpen]  = useState(false)
  const wallet = useWallet()

  useEffect(() => {
    const interval = setInterval(() => {
      setBlockNum(n => n + Math.floor(Math.random() * 3) + 1)
    }, 5000)
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => {
      clearInterval(interval)
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  const navLinks = [
    { href: '#about',    label: 'ABOUT' },
    { href: '#gameplay', label: 'GAMEPLAY' },
    { href: '#raid',     label: 'RAID' },
    { href: '#roadmap',  label: 'ROADMAP' },
    { href: '#faq',      label: 'FAQ' },
  ]

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 px-6 md:px-10 py-4 flex items-center justify-between border-b transition-all duration-300 ${
        scrolled
          ? 'border-[rgba(0,255,136,0.2)] nav-blur'
          : 'border-[rgba(0,255,136,0.05)] bg-transparent'
      }`}
    >
      {/* Logo */}
      <Link
        href="/"
        className="font-display text-lg font-black text-null-green tracking-[4px] glow-green no-underline"
      >
        NULL<span className="text-null-red">_</span>STATE
        <span className="font-mono text-xs text-null-muted tracking-wider ml-2">// v1.0.0</span>
      </Link>

      {/* Center status */}
      <div className="hidden md:flex items-center gap-2 font-mono text-[11px] text-null-muted">
        <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
        <span>CELO_MAINNET :: BLOCK #{blockNum.toLocaleString()}</span>
      </div>

      {/* Desktop nav links + wallet */}
      <div className="hidden md:flex items-center gap-6">
        <ul className="flex gap-7 list-none">
          {navLinks.map(link => (
            <li key={link.href}>
              <a
                href={link.href}
                className="font-mono text-[11px] text-null-muted hover:text-null-green tracking-[2px] uppercase transition-colors duration-200 no-underline"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/*
          ConnectButton dari RainbowKit — ini yang menampilkan popup WalletConnect.
          Kalau MiniPay, wallet langsung auto-connect via injected connector.
          Render kustom dipakai supaya visual sesuai tema NULL_STATE.
        */}
        {wallet.isMiniPay && wallet.isConnected ? (
          /* MiniPay auto-connect — tampilkan saja address */
          <div className="flex items-center gap-2 font-mono text-[11px] border border-[rgba(0,255,136,0.3)] px-4 py-2 text-null-green">
            <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
            <span>
              {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
            </span>
            <span className="text-[8px] text-null-muted ml-1">MiniPay</span>
          </div>
        ) : (
          <ConnectButton.Custom>
            {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
              const connected = mounted && account && chain
              return (
                <div
                  {...(!mounted && {
                    'aria-hidden': true,
                    style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                  })}
                >
                  {connected ? (
                    <button
                      onClick={openAccountModal}
                      className="flex items-center gap-2 font-mono text-[11px] border border-[rgba(0,255,136,0.3)] px-4 py-2 text-null-green hover:border-null-green transition-colors"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
                      <span>{account.displayName}</span>
                      <span className="text-null-muted">·</span>
                      <span className="text-null-amber">{wallet.celoBalance} CELO</span>
                    </button>
                  ) : (
                    <button
                      onClick={openConnectModal}
                      className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-5 py-2 uppercase hover:bg-null-green hover:text-null-bg transition-all duration-200"
                      style={{ clipPath: 'polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%)' }}
                    >
                      ⬡ CONNECT WALLET
                    </button>
                  )}
                </div>
              )
            }}
          </ConnectButton.Custom>
        )}

        <a
          href="/game"
          className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-5 py-2 uppercase clip-button-sm hover:bg-null-green hover:text-null-bg transition-all duration-200 no-underline"
        >
          PLAY NOW
        </a>
      </div>

      {/* Mobile hamburger */}
      <button
        className="md:hidden font-mono text-null-green text-xs tracking-widest"
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? '[ CLOSE ]' : '[ MENU ]'}
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="absolute top-full left-0 right-0 nav-blur border-b border-[rgba(0,255,136,0.15)] py-6 px-6 flex flex-col gap-4 md:hidden">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="font-mono text-[12px] text-null-muted hover:text-null-green tracking-[2px] uppercase transition-colors no-underline"
            >
              {link.label}
            </a>
          ))}

          {/* Mobile connect button — pakai ConnectButton.Custom juga */}
          {!wallet.isConnected && (
            <ConnectButton.Custom>
              {({ openConnectModal, mounted }) => (
                <button
                  disabled={!mounted}
                  onClick={() => { openConnectModal(); setMenuOpen(false) }}
                  className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-4 py-2 uppercase text-center hover:bg-null-green hover:text-null-bg transition-all"
                >
                  ⬡ CONNECT WALLET
                </button>
              )}
            </ConnectButton.Custom>
          )}

          {wallet.isConnected && (
            <div className="font-mono text-[11px] text-null-green border border-[rgba(0,255,136,0.3)] px-4 py-2 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-null-green animate-pulse" />
              <span>
                {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </span>
            </div>
          )}

          <a
            href="/game"
            onClick={() => setMenuOpen(false)}
            className="font-mono text-[11px] tracking-[2px] text-null-green border border-null-green px-4 py-2 uppercase clip-button-sm text-center hover:bg-null-green hover:text-null-bg transition-all no-underline mt-2"
          >
            PLAY NOW
          </a>
        </div>
      )}
    </nav>
  )
}
