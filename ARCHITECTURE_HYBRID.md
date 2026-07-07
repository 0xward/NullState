# NullState Hybrid Storage Architecture

## Overview

NullState menggunakan **hybrid storage model** yang menggabungkan on-chain (Celo) dan off-chain (Firebase) untuk optimal balance antara Web3 ownership, performa, dan biaya.

---

## Storage Strategy

### On-Chain (Celo Smart Contract)
**Immutable game progress data:**
- **XP** - Experience points earned from gameplay
- **Level** - Calculated from XP (1 level per 200 XP, max 50)
- **Kills** - Number of enemies defeated
- **HP/MaxHP** - Player health state
- **Deaths** - Number of times player died

**Fungsi kontrak yang digunakan:**
- `register()` - Registrasi pemain baru (no parameters)
- `executeAction(actionType, damageDealt, damageReceived, xpGained, enemyKilled)` - Simpan progress setelah aksi
- `getPlayer(address)` - Baca profil pemain

**Keuntungan:**
✅ Immutable, terdesentralisasi  
✅ Wallet address = unique identifier  
✅ Proof of progress  
✅ Transparent leaderboard  

**Tradeoff:**
❌ Gas cost per update (0.01 CELO per action)  
❌ Aksi game terbatas oleh block time (~5 detik di Celo)  

---

### Off-Chain (Firebase Firestore)
**Mutable user data:**
- **Username** - Custom player name
- **isAutoAssigned** - Apakah username di-auto-assign atau custom
- **createdAt/updatedAt** - Timestamp

**Collection:** `usernames/{walletAddress}`

**Keuntungan:**
✅ Instant read/write (no gas)  
✅ Username dapat diubah kapan saja  
✅ Memudahkan username validation & uniqueness  
✅ Leaderboard lookup lebih cepat  

**Tradeoff:**
❌ Centralized (dependent on Firebase uptime)  
❌ Requires trust in data persistence  

---

## Player Lifecycle

### 1. New Player - Registration Flow
```
User Connects Wallet
    ↓
GameFlowManager shows MainMenu
    ↓
User clicks "New Game"
    ↓
UsernameSetup screen appears
    ↓
handleUsernameSet(username) triggered:
    ├─ Check if player already registered on-chain
    ├─ If NOT registered: Call registerPlayer() → transaction
    ├─ After registration, call setPlayerUsername() → Firebase
    └─ Move to game
    ↓
Character Selection
    ↓
DungeonGame starts
    ↓
On Death Event:
    └─ Game emits 'nullstate-player-death' event
    └─ DungeonGameWrapper catches event
    └─ Calls updatePlayerProgress(xp, level, kills) → executeAction() → Celo
    ↓
Progress saved on-chain!
```

### 2. Returning Player - Continue Flow
```
User Connects Wallet
    ↓
GameFlowManager checks playerProfile
    ↓
If playerProfile.isRegistered === true:
    ├─ Show "Continue Game" button
    ├─ Show username (from Firebase)
    ├─ Show stats (from on-chain)
    └─ Fetch latest data
    ↓
User clicks "Continue"
    ├─ Load on-chain profile (XP, level, kills, HP)
    ├─ Load username from Firebase
    └─ Game resumes with latest state
```

### 3. Legacy Player (Registered but No Username)
```
Old Player registered on-chain but no username in Firebase
    ↓
When they connect wallet:
    ├─ getOrCreateUsername() called
    ├─ NOT found in Firebase
    ├─ Auto-generate: "Player_0x1234" (last 4 chars of wallet)
    ├─ Save to Firebase with isAutoAssigned=true
    └─ They can change username anytime (setPlayerUsername)
    ↓
Leaderboard shows: "Player_0x1234" (or custom if they changed it)
```

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                  NullState Game Client                   │
└─────────────────────────────────────────────────────────┘
         │                              │
         │ useContractPlayer hook       │
         │ (orchestrator)               │
         ↓                              ↓
    ┌────────────┐              ┌──────────────────┐
    │   Celo    │              │ Firebase         │
    │ Blockchain│              │ Firestore        │
    └────────────┘              └──────────────────┘
         │                              │
    getPlayer()              getOrCreateUsername()
    executeAction()          setUsername()
    register()               isUsernameAvailable()
         │                              │
    ┌────────────────────┐  ┌─────────────────────┐
    │ On-Chain Data      │  │ Off-Chain Data      │
    ├────────────────────┤  ├─────────────────────┤
    │ XP: 1250           │  │ username: "Aku"     │
    │ Level: 7           │  │ isAutoAssigned: false
    │ Kills: 45          │  │ wallet: 0xabcd..   │
    │ HP: 80             │  │ createdAt: timestamp
    │ Deaths: 3          │  │ updatedAt: timestamp
    └────────────────────┘  └─────────────────────┘
         Immutable                   Mutable
         Decentralized               Centralized
         Gas Cost                    Free
```

---

## Username System Details

### Auto-Assignment (Legacy Players)
Pemain lama yang registered di kontrak tapi tidak punya username di Firebase akan mendapat:
- Format: `Player_{LAST_4_CHARS_OF_WALLET}`
- Contoh: `Player_1234` (if wallet = 0x...1234)
- Marked with `isAutoAssigned: true`
- Dapat diubah kapan saja dengan `setPlayerUsername()`

### Custom Username Rules
```javascript
✅ Valid:
  - 3-32 characters
  - Only: a-z, A-Z, 0-9, _, -
  - Examples: "Aku", "Player_123", "shadow-knight"

❌ Invalid:
  - Too short: "ab" (< 3 chars)
  - Too long: 33+ characters
  - Special chars: "Aku@", "Player#1", "shadow!"
  - Already taken by other wallet
```

### Username Changes
- User dapat ubah username kapan saja (no gas cost)
- Cek availability dengan `isUsernameAvailable()`
- Tidak bisa pakai username yang sudah taken
- Update langsung ke Firebase

---

## Leaderboard Strategy

**Current:** Empty placeholder
**Reason:** Contract tidak punya `getAllPlayers()` view function

**Future Solutions:**
1. **Event Indexing** (recommended)
   - Index `PlayerRegistered` events
   - Keep cache of active players
   - Query cache for leaderboard

2. **The Graph / Dune Analytics**
   - Subgraph untuk NullState contract
   - Real-time queryable data

3. **Central Backend**
   - Backend server track player registrations
   - Expose `/api/leaderboard` endpoint
   - Better filtering & pagination

**For Now:**
```typescript
const fetchLeaderboard = useCallback(async (): Promise<LeaderboardEntry[]> => {
  console.warn('[v0] Leaderboard requires event indexing - not yet implemented')
  return []
}, [])
```

---

## Technical Implementation

### Files
- `lib/contract.ts` - Contract ABIs & types
- `lib/usernameService.ts` - Firebase username operations
- `lib/useContractPlayer.ts` - React hook (orchestrator)
- `components/game/GameFlowManager.tsx` - Game state machine
- `components/game/DungeonGameWrapper.tsx` - Game engine wrapper
- `components/game/UsernameSetup.tsx` - Username input UI

### Flow Example: Player Dies

```typescript
// 1. Game engine detects death
function gameOver() {
  window.dispatchEvent(new CustomEvent('nullstate-player-death', {
    detail: { xp: 350, level: 5, kills: 15 }
  }))
}

// 2. DungeonGameWrapper catches event
window.addEventListener('nullstate-player-death', async (event) => {
  const { xp, level, kills } = event.detail
  await updatePlayerProgress(xp, level, kills)
})

// 3. updatePlayerProgress calls contract.executeAction()
await walletClient.writeContract({
  functionName: 'executeAction',
  args: [1, 0, 0, BigInt(xp), kills > 0],
  value: BigInt(10000000000000000) // 0.01 CELO
})

// 4. Contract updates player on-chain
// Player.xp += xpGained
// checkLevelUp()
// emit ActionExecuted event
```

---

## Security Considerations

1. **Username Uniqueness**
   - Validated on-chain via Firestore query
   - No duplicate usernames across all players

2. **Data Integrity**
   - On-chain progress is immutable
   - Firebase has backup/recovery
   - Wallet address = proof of ownership

3. **Gas Protection**
   - Fixed 0.01 CELO per action (no surprises)
   - Player must have minimum balance to play

---

## Future Improvements

1. ✅ Event indexing for leaderboard
2. ✅ Profile pictures (stored in Blob or IPFS)
3. ✅ Achievements / badges (on-chain NFTs)
4. ✅ Trading system (artifacts on-chain)
5. ✅ Guilds / multiplayer raids (coordinated via smart contract)
6. ✅ Mobile-first optimizations for MiniPay

---

## Summary

- **On-Chain:** XP, Level, Kills (immutable, decentralized)
- **Off-Chain:** Username (mutable, instant, free)
- **Hybrid:** Best of both worlds
- **Zero username registrations:** Auto-assigned from wallet address
- **Returning players:** Auto-load from both sources
- **Leaderboard:** Awaiting event indexing implementation
