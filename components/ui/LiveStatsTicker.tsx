'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface Stat {
  label: string
  value: string | number
  color?: string
}

// Block number ticks stepped — feels like a real block counter, not a smooth counter
const tickerJitter = {
  animate: {
    x: [0, -1, 0, 1, 0, 0],
    y: [0,  0, 1, 0, 0, 0],
    transition: {
      duration: 0.4, repeat: Infinity, repeatDelay: 7.0,
      ease: 'steps(1)', times: [0, 0.2, 0.4, 0.6, 0.8, 1],
    },
  },
}

export default function LiveStatsTicker() {
  const [block,   setBlock]   = useState(28441902)
  const [players, setPlayers] = useState(247)
  const [txCount, setTxCount] = useState(14832)

  useEffect(() => {
    const i = setInterval(() => {
      setBlock(b => b + Math.floor(Math.random() * 2) + 1)
      setPlayers(p => p + (Math.random() > 0.8 ? 1 : 0))
      setTxCount(t => t + Math.floor(Math.random() * 3))
    }, 4000)
    return () => clearInterval(i)
  }, [])

  const stats: Stat[] = [
    { label: 'CELO BLOCK',     value: `#${block.toLocaleString()}`,          color: 'var(--null-green)'  },
    { label: 'ACTIVE PLAYERS', value: players,                               color: 'var(--null-green)'  },
    { label: 'TOTAL TXS',      value: txCount.toLocaleString(),              color: 'var(--null-amber)'  },
    { label: 'NULL_STRIKE FEE',value: '0.005 USDm',                          color: 'var(--null-blue)'   },
    { label: 'NETWORK FEE',    value: '~$0.001',                             color: 'var(--null-green)'  },
    { label: 'ENGINE',        value: 'REAL-TIME',                            color: 'var(--null-acid)'   },
    { label: 'NETWORK',        value: 'CELO L1',                             color: 'var(--null-green)'  },
  ]

  const allStats = [...stats, ...stats]

  return (
    <div className="border-y border-[rgba(0,255,136,0.08)] bg-[rgba(0,255,136,0.01)] py-2 overflow-hidden relative z-[2]">
      <div className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to right, var(--null-bg), transparent)' }} />
      <div className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(to left, var(--null-bg), transparent)' }} />

      <div className="ticker-wrap">
        <motion.div
          className="ticker-inner flex items-center gap-10"
          variants={tickerJitter}
          animate="animate"
        >
          {allStats.map((stat, i) => (
            <div key={i} className="flex items-center gap-2 flex-shrink-0">
              <span className="font-mono text-[9px] tracking-[2px] text-null-muted uppercase">{stat.label}</span>
              <span className="font-mono text-[9px]" style={{ color: stat.color }}>{stat.value}</span>
              <span className="font-mono text-[9px] text-[rgba(0,255,136,0.15)] mx-2">·</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
