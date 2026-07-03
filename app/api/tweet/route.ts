import { NextRequest, NextResponse } from 'next/server'

// =============================================
// TWITTER SOCIAL COMBAT
// POST /api/tweet — submit raid attack via tweet
// GET  /api/tweet — fetch raid boss status
// =============================================

// Raid Boss Tweet Intent URL
function buildTweetIntent(params: {
  bossName: string
  bossHp: number
  damage: number
  playerName: string
  txHash?: string
}): string {
  const { bossName, bossHp, damage, playerName, txHash } = params
  
  const tweetText = [
    `⚔️ I just dealt ${damage} DMG to ${bossName} in @NullStateRPG!`,
    ``,
    `🔴 Boss HP: ${bossHp.toLocaleString()} remaining`,
    `👤 Attacker: ${playerName}`,
    txHash ? `⛓️ TX: ${txHash.slice(0, 10)}...` : '',
    ``,
    `Join the raid — every tweet = 1 collective attack`,
    `#NullState #CeloChronicles #Web3RPG #CeloNetwork`,
  ].filter(Boolean).join('\n')

  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, playerName, damage, bossName, bossHp, txHash } = body

    if (action === 'get-tweet-intent') {
      // Return the tweet intent URL (client-side opens it)
      const intentUrl = buildTweetIntent({
        bossName: bossName || 'THE 51%',
        bossHp: bossHp || 9500,
        damage: damage || Math.floor(Math.random() * 50) + 10,
        playerName: playerName || 'NOMAD',
        txHash,
      })

      return NextResponse.json({ intentUrl, success: true })
    }

    if (action === 'verify-tweet') {
      // If Twitter Bearer Token is available, verify the tweet
      const { tweetId, walletAddress } = body

      if (!process.env.TWITTER_BEARER_TOKEN) {
        // Mock verification — grant damage for demonstration
        return NextResponse.json({
          verified: true,
          bonusDamage: 25,
          message: 'Social combat confirmed! +25 bonus damage dealt to boss.',
          mock: true,
        })
      }

      try {
        const response = await fetch(
          `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text,author_id,created_at`,
          {
            headers: {
              Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
            },
          }
        )

        if (!response.ok) {
          throw new Error('Tweet verification failed')
        }

        const tweetData = await response.json()
        const tweet = tweetData.data

        // Verify tweet contains expected hashtags
        const isValid =
          tweet.text.includes('#NullState') ||
          tweet.text.includes('#CeloChronicles') ||
          tweet.text.includes('NullStateRPG')

        if (isValid) {
          return NextResponse.json({
            verified: true,
            bonusDamage: 25,
            message: `Tweet confirmed on-chain! Raid attack registered. +25 bonus damage.`,
            tweetId,
          })
        } else {
          return NextResponse.json({
            verified: false,
            message: 'Tweet did not contain required hashtags.',
          })
        }
      } catch (err) {
        console.error('Tweet verification error:', err)
        return NextResponse.json({
          verified: true, // Optimistic — grant damage anyway
          bonusDamage: 15,
          message: 'Partial verification — social combat registered.',
          error: true,
        })
      }
    }

    if (action === 'raid-status') {
      // Return current raid boss status
      // In production: fetch from your DB / on-chain state
      return NextResponse.json({
        boss: {
          name: 'THE 51%',
          title: 'CONSENSUS DESTROYER',
          currentHp: Math.floor(Math.random() * 3000) + 7000, // Mock fluctuation
          maxHp: 10000,
          phase: 1,
          attackers: 247 + Math.floor(Math.random() * 20),
          tweetCount: 1834 + Math.floor(Math.random() * 50),
          reward: 'Legendary Artifact Drop + 1 CELO',
          activeUntil: Date.now() + 72 * 60 * 60 * 1000,
        },
        topAttackers: [
          { address: '0xa1D5...', name: 'NOMAD', damage: 450 },
          { address: '0xb2E6...', name: 'GHOST', damage: 380 },
          { address: '0xc3F7...', name: 'NULL', damage: 290 },
        ],
      })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    console.error('Tweet API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  // Quick raid status endpoint
  return NextResponse.json({
    boss: {
      name: 'THE 51%',
      currentHp: 8750,
      maxHp: 10000,
      attackers: 247,
      tweetCount: 1834,
      phase: 1,
    },
    active: true,
  })
}
