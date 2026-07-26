'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useWallet } from '@/lib/WalletProvider'
import { useContractPlayer } from '@/lib/useContractPlayer'
import { PlayerProfile, LeaderboardEntry } from '@/lib/contract'
import { loadGameSession, clearGameSession, saveGameSession, saveGameSessionDraft } from '@/lib/gameSessionService'
import { migrateGuestProgress, getStoredGuestId } from '@/lib/guestMigration'
import MainMenu from './MainMenu'
import WorldMapHub from './WorldMapHub'
import { useWorldMapHubFlag } from '@/lib/worldMapHubFlag'
import NewGameConfirmModal from './NewGameConfirmModal'

// ─── Code-split (PSI v58: ~96 KiB unused JS di initial load) ────────────────
// Screen-screen ini cuma dirender setelah user klik sesuatu di MainMenu
// (lihat switch `phase` di bawah — cuma satu phase yang aktif di satu waktu),
// jadi gak perlu ikut ke initial JS bundle /game. `ssr:false` karena semua
// ini 'use client' component yang gak butuh SEO/first-paint (halaman /game
// sendiri sudah `force-dynamic`, gak di-index buat konten dalam game).
// DungeonGameWrapper membungkus DungeonGame.tsx (808 baris, game engine —
// komponen terberat di codebase ini), jadi men-split wrapper-nya otomatis
// ikut men-split game engine-nya juga.
const UsernameSetup = dynamic(() => import('./UsernameSetup'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING WALKER SETUP" />,
})
const Leaderboard = dynamic(() => import('./Leaderboard'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING LEADERBOARD" />,
})
const RewardsScreen = dynamic(() => import('./RewardsScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING REWARDS" />,
})
const ReferralScreen = dynamic(() => import('./ReferralScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING REFERRAL" />,
})
const SeasonPassScreen = dynamic(() => import('./SeasonPassScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING SEASON PASS" />,
})
const MarketplaceScreen = dynamic(() => import('./MarketplaceScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING MARKETPLACE" />,
})
const CraftingScreen = dynamic(() => import('./CraftingScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING CRAFTING" />,
})
const HowToPlayScreen = dynamic(() => import('./HowToPlayScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING GUIDE" />,
})
const CharacterSheet = dynamic(() => import('./CharacterSheet'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING CHARACTER" />,
})
const SettingsScreen = dynamic(() => import('./SettingsScreen'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING SETTINGS" />,
})
const DungeonGameWrapper = dynamic(() => import('./DungeonGameWrapper'), {
  ssr: false,
  loading: () => <ScreenLoadingFallback label="LOADING DUNGEON" />,
})

// Fallback minimal yang cocok sama tema terminal/hijau NullState, dipakai
// selagi chunk async di atas masih di-fetch (biasanya cuma sekejap di
// koneksi normal — ini bukan buat dungeon engine yang beneran loading asset).
function ScreenLoadingFallback({ label }: { label: string }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-null-bg">
      <div className="font-mono text-[11px] tracking-[4px] text-null-green uppercase animate-pulse">
        // {label}...
      </div>
    </div>
  )
}

type GamePhase = 'menu' | 'username-setup' | 'character-select' | 'game' | 'leaderboard' | 'rewards' | 'referral' | 'season-pass' | 'marketplace' | 'crafting' | 'how-to-play' | 'character' | 'settings'

/**
 * GameFlowManager orchestrates the entire NullState game flow:
 * 1. Show MainMenu with wallet connection
 * 2. Handle Continue/New Game/Leaderboard options
 * 3. Show UsernameSetup for new players (Knight is the sole default character)
 * 4. Pass to DungeonGame for actual gameplay
 * 5. Show Leaderboard when requested
 *
 * All player progress is stored ON-CHAIN via the contract.
 */
export default function GameFlowManager() {
  const { address, isConnected, realAddress } = useWallet()
  const {
    playerProfile,
    isLoading: isLoadingProfile,
    setPlayerUsername,
    fetchPlayerProfile,
    fetchLeaderboard
  } = useContractPlayer(address || undefined)

  const [phase, setPhase] = useState<GamePhase>('menu')
  const [characterTab, setCharacterTab] = useState<'character' | 'items'>('character')
  const [leaderboardEntries, setLeaderboardEntries] = useState<LeaderboardEntry[]>([])
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false)
  const [selectedUsername, setSelectedUsername] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  // Tracks whether the current run was entered via "New Game" (true) or
  // "Continue" (false) — threaded down to DungeonGame so its mount effect
  // knows whether to load the saved bunker session or skip it entirely.
  // See handleNewGame/handleContinueGame below.
  const [isNewRun, setIsNewRun] = useState(false)
  // Which run the player chose from the menu — threaded to the engine so it
  // skips the canvas title/preview and starts that mode directly.
  const [startMode, setStartMode] = useState<'new' | 'continue' | 'cycle' | 'abyss'>('new')
  // True while handleNewGame is checking Firestore for an existing saved
  // session (so the New Game button can show a brief pending state if the
  // caller wants it — currently unused by MainMenu but kept for parity with
  // the other loading flags here).
  const [checkingNewGame, setCheckingNewGame] = useState(false)
  const [showNewGameConfirm, setShowNewGameConfirm] = useState(false)

  // Render the world-map hub instead of the classic MainMenu when the flag is
  // on (see lib/worldMapHubFlag.ts — OFF by default). HowToPlayScreen reads the
  // same flag, so the help text always matches the screen the player gets.
  const useWorldMapHub = useWorldMapHubFlag()

  // Bunker cleared → surface back to the world map, so the run's progress lands
  // somewhere visible (the ✓ appears, the next bunker loses its fog) instead of
  // the engine walking the player straight into the next act. Only with the hub
  // on; the classic menu keeps the uninterrupted flow it always had.
  //
  // The draft is written SYNCHRONOUSLY before the phase flips: WorldMapHub reads
  // that same localStorage draft on mount, so the map can't paint the bunker we
  // just finished while a network write is still in flight.
  useEffect(() => {
    if (!useWorldMapHub) return
    const onCleared = () => {
      try {
        const NSG = (window as { NullStateGame?: { getSaveSnapshot?: () => unknown } }).NullStateGame
        const raw = NSG?.getSaveSnapshot?.() as Parameters<typeof saveGameSession>[1] | undefined
        if (raw && address) {
          // Floor 1, always. A cleared bunker means the next descent starts a
          // NEW bunker, and the engine restores `depth` straight into
          // startDepth — so persisting the floor the vault was on (5) made
          // ENTER drop the player into the next bunker already on floor 5,
          // skipping the four floors they had just unlocked.
          //
          // game.js resets its cached snapshot at the same moment and for the
          // same reason; this is the shell refusing to write a deep floor after
          // a clear under any circumstances, because it is the last thing
          // standing between that value and the player's saved game.
          const snap = { ...raw, depth: 1, maxDepthReached: 1 }
          saveGameSessionDraft(address, snap)
          saveGameSession(address, snap).catch(() => { /* draft already covers the map */ })
        }
      } catch { /* never block the return to the map on a save problem */ }
      setPhase('menu')
    }
    window.addEventListener('nullstate-bunker-cleared', onCleared)
    return () => window.removeEventListener('nullstate-bunker-cleared', onCleared)
  }, [useWorldMapHub, address])

  // If wallet disconnects, go back to menu
  useEffect(() => {
    if (!isConnected) {
      setPhase('menu')
    }
  }, [isConnected])

  // Referral bind (growth blueprint 2A). A share link lands on
  // /game?ref=CODE — stash the code immediately (the wallet may not be
  // connected yet), then bind it server-side once a real wallet exists.
  // The server is idempotent (binds once ever, rejects self-referrals),
  // so re-running on every mount is harmless.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const ref = new URLSearchParams(window.location.search).get('ref')
      if (ref && /^[A-Za-z0-9]{6,12}$/.test(ref)) localStorage.setItem('nullstate-refcode-pending', ref.toUpperCase())
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    if (!realAddress || typeof window === 'undefined') return
    let code: string | null = null
    try { code = localStorage.getItem('nullstate-refcode-pending') } catch { /* ignore */ }
    if (!code) return
    fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'bind', wallet: realAddress, code }),
    })
      .then(r => r.json())
      .then(d => {
        // Bound (or already bound / self-ref rejected) — either way the
        // pending code has served its purpose.
        if (d && (d.success || d.error)) {
          try { localStorage.removeItem('nullstate-refcode-pending') } catch { /* ignore */ }
        }
      })
      .catch(() => { /* offline — keep pending, retry next mount */ })
  }, [realAddress])

  // Guest → wallet migration (Phase 1). The moment a real wallet connects while
  // a local guest id still exists, move the guest's off-chain progress onto the
  // wallet (fill-the-gaps, wallet wins — see lib/guestMigration.ts), then
  // refresh the profile so the migrated username/session show up immediately.
  useEffect(() => {
    if (!realAddress || !getStoredGuestId()) return
    let cancelled = false
    ;(async () => {
      await migrateGuestProgress(realAddress)
      if (!cancelled) fetchPlayerProfile()
    })()
    return () => { cancelled = true }
  }, [realAddress, fetchPlayerProfile])

  // Actually begins a fresh run (marks isNewRun so DungeonGame's mount
  // effect skips loading any saved bunker snapshot). v72 (user finding #2):
  // REGISTERED players now skip the username-setup screen entirely and drop
  // straight into the game — they already have an on-chain username, and
  // being routed back through "SET USERNAME" on every New Game read as a
  // blocking bug popup. Only first-time (unregistered) players see setup.
  const proceedToNewGame = () => {
    setStartMode('new')
    setIsNewRun(true)
    setPhase(playerProfile?.isRegistered ? 'game' : 'username-setup')
  }

  // New Game+ and The Null Abyss are NOT menu entries — they unlock and are
  // entered from INSIDE the game (the post-campaign title screen the engine
  // shows via returnToTitleScreen once PROTOCOL ZERO is reached). The Main
  // Menu stays focused on New Game / Continue.

  const handleNewGame = async () => {
    if (!address) {
      proceedToNewGame()
      return
    }
    setCheckingNewGame(true)
    try {
      const existing = await loadGameSession(address)
      if (existing) {
        // Don't touch/clear it yet — just ask. The save only gets erased
        // if the player explicitly confirms below.
        setShowNewGameConfirm(true)
      } else {
        proceedToNewGame()
      }
    } catch {
      // Firestore unreachable etc — fail open and let the player start a
      // fresh run rather than getting stuck, same fail-open behavior as
      // DungeonGame's own loadGameSession() catch.
      proceedToNewGame()
    } finally {
      setCheckingNewGame(false)
    }
  }

  // v72 (user finding #2): fire-and-forget. The old version awaited
  // clearGameSession BEFORE proceeding, which froze the modal on slow
  // networks. isNewRun=true already guarantees DungeonGame won't load the
  // stale save while the delete completes in the background.
  const handleConfirmNewGame = () => {
    setShowNewGameConfirm(false)
    if (address) {
      clearGameSession(address).catch(() => { /* retried implicitly: isNewRun run overwrites the save on next auto-save */ })
    }
    proceedToNewGame()
  }

  // v72 (user finding #2): the modal now also offers "Continue Saved Run"
  // so the player genuinely chooses between the two paths, instead of New
  // Game being the only actionable outcome once the popup was open.
  const handleContinueFromModal = () => {
    setShowNewGameConfirm(false)
    if (playerProfile?.isRegistered) {
      handleContinueGame(playerProfile)
    }
  }

  const handleCancelNewGame = () => {
    setShowNewGameConfirm(false)
  }

  const handleContinueGame = (profile: PlayerProfile) => {
    // Jump straight into the game with their existing profile
    setStartMode('continue')
    setIsNewRun(false)
    setPhase('game')
  }

  const handleUsernameSet = async (username: string) => {
    try {
      setError(null)
      setSelectedUsername(username)

      // Registration is now fully OFF-CHAIN (Phase 0): there is no register()
      // tx anymore. A player exists the moment they claim a Firebase username —
      // for real wallets and guests alike. Combat, XP and progress all live
      // off-chain; only reward payouts touch the chain later on.
      await setPlayerUsername(username)

      // Move to game
      setPhase('game')
    } catch (err) {
      const message = (err as any)?.message || 'Failed to set up player'
      setError(message)
    }
  }

  const handleLeaderboardClick = async () => {
    setPhase('leaderboard')
    setIsLoadingLeaderboard(true)
    try {
      const entries = await fetchLeaderboard()
      setLeaderboardEntries(entries)
    } catch (err) {
      console.error('[v0] Failed to load leaderboard:', err)
    } finally {
      setIsLoadingLeaderboard(false)
    }
  }

  const handleBackToMenu = () => {
    setPhase('menu')
    setError(null)
  }

  const handleRewardsClick = () => {
    // Re-fetch before showing Rewards: playerProfile is otherwise only
    // fetched once on wallet connect (see useContractPlayer.ts), so without
    // this a player who connects then plays a session would see stale
    // xp/level here even after recordRunProgress has already synced the
    // real numbers to Firestore on save/death.
    fetchPlayerProfile()
    setPhase('rewards')
  }

  const handleMintPassClick = () => {
    setPhase('season-pass')
  }

  const handleReferralClick = () => {
    setPhase('referral')
  }

  const handleMarketplaceClick = () => {
    setPhase('marketplace')
  }

  const handleCraftingClick = () => {
    setPhase('crafting')
  }

  const handleHowToPlayClick = () => {
    setPhase('how-to-play')
  }

  // Two doors into the same room: the player plate opens CHARACTER, the BAG
  // button opens ITEMS. The tab is remembered on the way in rather than reset,
  // so tapping the bag never lands you on a page about your crit chance.
  const handleCharacterClick = (tab: 'character' | 'items' = 'character') => {
    setCharacterTab(tab)
    setPhase('character')
  }

  const handleSettingsClick = () => {
    setPhase('settings')
  }

  // PHASE: MENU
  if (phase === 'menu') {
    // Same props for both — the hub is a drop-in swap for the classic menu.
    const MenuScreen = useWorldMapHub ? WorldMapHub : MainMenu
    return (
      <>
        <MenuScreen
          onContinueGame={handleContinueGame}
          onNewGame={handleNewGame}
          onLeaderboard={handleLeaderboardClick}
          onRewards={handleRewardsClick}
          onReferral={handleReferralClick}
          onMintPass={handleMintPassClick}
          onMarketplace={handleMarketplaceClick}
          onCrafting={handleCraftingClick}
          onHowToPlay={handleHowToPlayClick}
          onCharacter={handleCharacterClick}
          onSettings={handleSettingsClick}
          playerProfile={playerProfile}
          isLoadingProfile={isLoadingProfile}
        />
        <NewGameConfirmModal
          open={showNewGameConfirm}
          onConfirm={handleConfirmNewGame}
          onContinue={playerProfile?.isRegistered ? handleContinueFromModal : null}
          onCancel={handleCancelNewGame}
        />
      </>
    )
  }

  // PHASE: CHARACTER SELECT
  if (phase === 'username-setup' && !playerProfile?.isRegistered) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[rgba(0,0,0,0.95)] p-6">
        {/* Glow orb */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(0,255,136,0.08) 0%, rgba(0,170,255,0.03) 40%, transparent 70%)',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />

        <div className="relative z-10 max-w-2xl w-full text-center">
          {/* Title */}
          <div className="font-mono text-[11px] tracking-[6px] text-null-green uppercase mb-8">
            // NULLSTATE // NEW GAME
          </div>

          <h2 className="font-display font-black text-null-white mb-8" style={{ fontSize: '52px' }}>
            NEW WALKER
          </h2>

          {/* Username setup component */}
          <UsernameSetup
            onUsernameSet={handleUsernameSet}
            onCancel={handleBackToMenu}
            isLoading={isLoadingProfile}
          />

          {error && (
            <div className="mt-4 p-3 bg-[rgba(255,59,48,0.2)] border border-[rgba(255,59,48,0.5)] text-null-red font-mono text-xs">
              {error}
            </div>
          )}
        </div>
      </div>
    )
  }

  // PHASE: USERNAME SETUP (shown inside above, so this is redundant, but kept for clarity)
  if (phase === 'username-setup') {
    return (
      <UsernameSetup
        onUsernameSet={handleUsernameSet}
        onCancel={handleBackToMenu}
        isLoading={isLoadingProfile}
      />
    )
  }

  // PHASE: LEADERBOARD
  if (phase === 'leaderboard') {
    return (
      <Leaderboard
        onBack={handleBackToMenu}
        isLoading={isLoadingLeaderboard}
        entries={leaderboardEntries}
        currentWalletAddress={address}
      />
    )
  }

  // PHASE: REWARDS
  if (phase === 'rewards') {
    return (
      <RewardsScreen
        onBack={handleBackToMenu}
        address={address || undefined}
        playerProfile={playerProfile}
      />
    )
  }

  // PHASE: REFERRAL
  if (phase === 'referral') {
    return (
      <ReferralScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: SEASON PASS
  if (phase === 'season-pass') {
    return (
      <SeasonPassScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: MARKETPLACE
  if (phase === 'marketplace') {
    return (
      <MarketplaceScreen
        onBack={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: CRAFTING (Phase 4 — weapon evolution)
  if (phase === 'crafting') {
    return (
      <CraftingScreen
        onBack={handleBackToMenu}
        onGoToRun={handleBackToMenu}
        address={address || undefined}
      />
    )
  }

  // PHASE: HOW TO PLAY (Phase 2 — "The Loop" + progression explainer)
  if (phase === 'how-to-play') {
    return <HowToPlayScreen onBack={handleBackToMenu} />
  }

  // PHASE: CHARACTER / ITEMS — the only place outside a run where a player can
  // see and equip what they own. Before it existed, buying a weapon told you to
  // "equip it in your inventory" and there was no inventory to open.
  if (phase === 'character') {
    return (
      <CharacterSheet
        onBack={handleBackToMenu}
        onMarketplace={handleMarketplaceClick}
        playerProfile={playerProfile}
        initialTab={characterTab}
      />
    )
  }

  // PHASE: SETTINGS — the preferences that make sense OUTSIDE a run. The
  // in-run SettingsModal keeps the run-scoped half (Save Game, Exit, session
  // stats); this one owns the preferences, which are now persisted so both read
  // the same values.
  if (phase === 'settings') {
    return (
      <SettingsScreen
        onBack={handleBackToMenu}
        playerProfile={playerProfile}
        setPlayerUsername={setPlayerUsername}
      />
    )
  }

  // PHASE: GAME
  if (phase === 'game') {
    return (
      <DungeonGameWrapper
        playerProfile={playerProfile}
        setPlayerUsername={setPlayerUsername}
        isNewRun={isNewRun}
        startMode={startMode}
      />
    )
  }

  return null
}
