import { NextRequest, NextResponse } from 'next/server'

// =============================================
// GROQ AI DM ENGINE
// POST /api/groq
// =============================================

const SYSTEM_PROMPT = `You are the Dungeon Master (DM) for NULL_STATE, a Web3 RPG on the Celo blockchain.

GAME CONTEXT:
- Players battle blockchain-themed enemies (Gas Goblins, Null Pointers, Rug Phantoms, Fork Wraiths)
- Each action costs 0.01 CELO — stakes are real
- Tone: cyberpunk-noir, dark humor, blockchain lore references
- Language: English
- Keep responses SHORT (2-4 sentences max) but extremely vivid
- Reference blockchain concepts poetically (gas fees = life force, smart contracts = ancient scrolls, etc.)
- Use em-dashes, ellipses for drama
- Never break character

RESPONSE FORMAT:
Respond with ONLY a JSON object:
{
  "narrative": "The DM's 2-4 sentence description",
  "playerDamage": number (0-40, damage dealt to enemy),
  "enemyDamage": number (0-35, damage dealt to player),
  "statusEffect": "none" | "stunned" | "burned" | "drained" | "blessed",
  "xpGained": number (5-30),
  "specialEvent": null | "critical_hit" | "artifact_resonance" | "chain_curse" | "block_confirmed",
  "loot": null | { "name": string, "type": string, "power": number }
}

TONE EXAMPLES:
- "Your Debug Blade slices through the Gas Goblin's mist-form — 0.01 CELO confirmed on-chain. It staggers, HP bleeding like leaked memory..."
- "The Null Pointer dereferences your armor — 22 damage passes through like an exception nobody caught. Fatal error imminent..."
- "Critical resonance! The Celo network validates your transaction in under a second. The enemy BURNS."
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { action, player, enemy, context } = body

    if (!process.env.GROQ_API_KEY) {
      // Return mock response if no API key
      return NextResponse.json({
        narrative: getMockNarrative(action, enemy?.name),
        playerDamage: Math.floor(Math.random() * 25) + 10,
        enemyDamage: Math.floor(Math.random() * 20) + 5,
        statusEffect: 'none',
        xpGained: Math.floor(Math.random() * 15) + 5,
        specialEvent: Math.random() > 0.85 ? 'critical_hit' : null,
        loot: null,
        mock: true,
      })
    }

    const userPrompt = `
CURRENT SITUATION:
- Player: ${player.name} | HP: ${player.hp}/${player.maxHp} | Level: ${player.level}
- Artifacts: ${player.artifacts.map((a: { name: string; power: number }) => `${a.name} (power: ${a.power})`).join(', ') || 'none'}
- Passport Verified: ${player.passportVerified}
- Enemy: ${enemy.name} (${enemy.class}) | HP: ${enemy.hp}/${enemy.maxHp}
- Enemy Weakness: ${enemy.weakness || 'unknown'}

PLAYER ACTION: ${action.label} — ${action.description}
Context: ${context || 'standard combat'}

Generate the DM response as JSON.`

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.85,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.statusText}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      parsed = {
        narrative: content,
        playerDamage: 15,
        enemyDamage: 10,
        statusEffect: 'none',
        xpGained: 10,
        specialEvent: null,
        loot: null,
      }
    }

    return NextResponse.json(parsed)
  } catch (error) {
    console.error('Groq API Error:', error)
    return NextResponse.json(
      {
        narrative: 'The chain stutters... connection to the AI DM lost. Battle continues in legacy mode.',
        playerDamage: 15,
        enemyDamage: 10,
        statusEffect: 'none',
        xpGained: 5,
        specialEvent: null,
        loot: null,
        error: true,
      },
      { status: 200 } // Return 200 so game continues
    )
  }
}

// Fallback mock narratives
function getMockNarrative(action: { label: string }, enemyName?: string): string {
  const narratives = [
    `Your ${action.label} connects with brutal precision — the ${enemyName || 'enemy'} staggers, gas fees spilling like blood from a corrupted wallet...`,
    `Transaction confirmed in 4.8 seconds. The ${enemyName || 'enemy'} screams in the blockchain void as your attack burns through its HP...`,
    `Critical hit! The Celo network validates your move — ${enemyName || 'the beast'} recoils, its smart contract fraying at the edges...`,
    `The ${enemyName || 'enemy'} counterattacks with a vengeance — an OutOfGas exception tears through your defenses. Pain is just latency here...`,
    `Your artifact resonates with the chain — a brilliant cascade of on-chain damage. The ${enemyName || 'monster'} howls in hexadecimal agony...`,
  ]
  return narratives[Math.floor(Math.random() * narratives.length)]
}
