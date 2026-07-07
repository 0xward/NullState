// Off-chain "Continue from last bunker" save/load.
//
// This is deliberately separate from the on-chain PlayerProfile (xp/level/
// kills committed to the NullState contract only when the character dies —
// see useContractPlayer.ts). This save is free (no wallet signature, no
// gas): it's a lightweight snapshot of *where the player currently is*
// (floor, inventory, in-run HP/xp/kills-not-yet-recorded-on-chain), stored
// in Firestore keyed by wallet address so it follows the player across
// devices/browsers.
//
// Single-use by design: consumed the moment it's loaded (see
// clearGameSession, called right after a successful load), matching the
// game's own "Death is permanent" ironman-save philosophy — you can't
// save-scum a fight by reloading an old snapshot.

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from './firebase'

export interface GameSessionSnapshot {
  charKey: string
  campaignActIndex: number
  depth: number
  maxDepthReached: number
  xp: number
  level: number
  kills: number
  celo: number
  hp: number
  inventory: { keys: number; relics: number; shards: number }
  key: { depth: number; taken: boolean }
  savedAt: number
}

function docRef(walletAddress: string) {
  return doc(db, 'gameSessions', walletAddress.toLowerCase())
}

/**
 * Save (or overwrite) the current bunker snapshot for a wallet. Called from
 * the Settings > Save Game action and from the silent auto-save on
 * tab-hide/pagehide.
 */
export async function saveGameSession(
  walletAddress: string,
  snapshot: GameSessionSnapshot
): Promise<boolean> {
  try {
    await setDoc(docRef(walletAddress), snapshot)
    return true
  } catch (err) {
    console.error('[v0] Failed to save game session:', err)
    return false
  }
}

/**
 * Fetch the saved snapshot for a wallet, if any. Does NOT delete it — call
 * clearGameSession() separately once the snapshot has actually been applied
 * to a running game, so a failed/aborted load doesn't lose the save.
 */
export async function loadGameSession(
  walletAddress: string
): Promise<GameSessionSnapshot | null> {
  try {
    const snap = await getDoc(docRef(walletAddress))
    return snap.exists() ? (snap.data() as GameSessionSnapshot) : null
  } catch (err) {
    console.error('[v0] Failed to load game session:', err)
    return null
  }
}

/** Consume (delete) the saved snapshot — call right after a successful load. */
export async function clearGameSession(walletAddress: string): Promise<void> {
  try {
    await deleteDoc(docRef(walletAddress))
  } catch (err) {
    console.error('[v0] Failed to clear game session:', err)
  }
}
