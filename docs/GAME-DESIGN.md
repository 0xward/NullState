# NullState — Game Design

**Read this before touching anything.** This is the document that answers
"what game is this, and why would anyone open it tomorrow." Every other doc
in this folder describes a *system*; this one describes the *game those
systems are supposed to add up to*.

It exists because they stopped adding up. `lib/constants/game-config.ts`
carried a `bunkers` block claiming 6 bunkers of 3 floors and a `specialItems`
block placing the Golden Key at "bunker 1, floor 3". Neither was true, and
neither was read by a single line of source — the engine is a static
`<script>`, it cannot import from `lib/`. Those numbers reached the
player-facing docs. Nine dead blocks have since been deleted from that file
and it now carries the rule that kept them out; this doc is the thing to
trust for anything above the level of a price.

---

## How to read the status markers

Every claim below is tagged. Nothing here is allowed to be ambiguous about
whether it is real:

- **`[TODAY]`** — built, shipped, true right now.
- **`[TARGET]`** — agreed design, not built yet.
- **`[CHANGE]`** — built, but the agreed design differs from what exists.

If you implement a `[TARGET]`, flip it to `[TODAY]` in the same PR. A
design doc that drifts from the code is worse than no design doc — that is
exactly how `game-config.ts` became a liability.

---

## 1. What NullState is

> A short-session mobile dungeon crawler on Celo where **playing this week
> is what earns you real USDT at the end of it.**

Three words that decide every argument:

**Short.** One raid is 3–10 minutes. MiniPay players are on mid-range
phones, often on the move. If a loop needs a 20-minute sitting, it is
wrong for this audience regardless of how good it is.

**Repeatable.** The campaign is not the content. The campaign is the
tutorial. The content is raiding a world you already unlocked, forever.

**Real.** Money actually moves. That is the differentiator against every
other pixel roguelite, and it means the *cadence* of payout matters more
than the *size* of it.

### What it is NOT

- **Not a story game you finish.** The story is the wrapper, not the goal.
- **Not a daily-payout game.** Daily play pays *progress*. Money is weekly.
- **Not an idle/tap game.** There is real combat under this. Tap-loops fade;
  the depth is the moat (see `GROWTH-BLUEPRINT.md`, market grounding).

---

## 2. The structural decision (2026-07-30)

**Campaign = tutorial. The world map = the game.**

The old structure was a linear campaign that ends — `campaignActIndex` only
ever increments (`game.js:5244`), and `WorldMapHub.tsx:234` says out loud
that re-entering a cleared bunker "would need an engine entry point that
doesn't exist yet." A finite campaign and a forever-weekly-payout are two
different genres bolted together, and the seam is exactly where players got
stuck: bunker cleared, ✓ on the map, no way back in.

The agreed shape:

| Stage | What it is |
|---|---|
| First playthrough | 5 bunkers, story beats, ~2–3 sessions. Onboarding. |
| After the campaign | **All five bunkers permanently open.** The map is home. |
| Forever after | Daily and weekly loops run *inside* those bunkers. |

**`[CHANGE]`** Cleared bunkers must become re-enterable. See §7.

### Persistence: what actually needs to persist

This was nearly over-engineered, so it is written down plainly.

**Within one visit — `[TODAY]`, works correctly.** `G.floors[depth]` caches
`{dun, enemies, decor, bossAlive, visited}` (`game.js:463`), and `descend()`
writes the live floor back before leaving (`game.js:754-758`). Kill a
monster on floor 2, ride the lift to floor 4 and back — it is still dead.
Opened containers stay empty, smashed props stay smashed. No duplicates.
**Do not "fix" this. It is already right.**

**Across visits — deliberately NOT persistent.** A raid on a cleared bunker
generates a fresh floor. This is not a compromise, it is the correct design:
a permanently-looted bunker is a bunker nobody returns to. Farming needs
respawn. LDOE ships respawn timers for precisely this reason.

The consequence is that re-entry needs **no serialization at all** — just a
new engine entry point. `mount({ startMode })` already accepts
`'new' | 'continue' | 'cycle' | 'abyss'` (`game.js:5442-5452`); this is one
more mode, not surgery.

**Mid-run save fidelity — `[CHANGE]`, separate concern.** See §8.

---

## 3. The four time layers

A live game needs an answer at every timescale. Miss one and the player
falls out of the loop there. NullState today has layers 1, 3, and a broken
4. **Layer 2 is empty, and that is the whole problem.**

### Layer 1 — Session: "why play right now" — `[TODAY]`

A raid is 3–10 minutes: descend, fight, loot, extract. This layer works.
Combat, procedural floors, loot rarity, the lift, containers — all shipped.

### Layer 2 — Daily: "why come back tomorrow" — `[TARGET]`, **empty today**

Nothing currently answers this. Energy (5/day) is a *limiter*, not a
*reason* — you limit what people want more of, and right now there is
nothing they want more of once the vault is claimed. Four mechanics fill
it, all built from systems that already exist (§5).

### Layer 3 — Weekly: "why care this week" — `[TODAY]`, needs §5.1

The Vault. One shared 4-digit code per ISO week (Monday 00:00 UTC), Old
Paper carries the code, Golden Key opens the door, 3 attempts per wallet,
correct code pays USDT on-chain immediately.

This layer works mechanically. What is wrong is *how you get in*: pure luck.

### Layer 4 — Seasonal: "why care this month" — `[CHANGE]`, half-broken

Season = `YYYYMM` UTC. Season Pass SBT, leaderboard, top-3 USDm bonus.
Three real problems, §9.

---

## 4. The player's week (the target)

This is the acceptance test. If a change does not make one of these rows
better, it is not a priority.

| Day | What the player does | What pulls them back |
|---|---|---|
| 1 | Raid, 3 daily contracts, fragments 6/12, start a 6h craft | Craft timer |
| 1 pm | Collect the craft — weapon is tier 2 | Stronger now |
| 2 | Deeper bunker, fragments 12/12 → **Paper granted**, streak 2 | Key still 9/28 |
| 3 | Grind the Key, contracts, streak 3 | Streak + fragments |
| 4–5 | Fragments 28/28 → **Golden Key granted** | The vault is now open |
| 6 | Enter the vault → **USDT** | Leaderboard still moving |
| 7 | Week resets — but the weapon is tier 3, so next week is faster | Ratchet |

The load-bearing sentence: **playing on day 2 must visibly buy the day-6
payout.** Today it buys nothing. That is the single biggest fix in this doc.

---

## 5. Layer 2 mechanics (the daily loop)

All four run on systems already in the repo. No new currency, no new
contract, no new vendor.

### 5.1 Vault Fragments — `[TODAY]` — **highest priority**

**The problem.** Old Paper and Golden Key are pure 16% rolls on rare
containers, capped 1 per wallet per week (`props.js` `rollLootSlots`).
Two bad outcomes, both common:

- **Lucky player** gets both on day 1 → days 2–7 have no purpose.
- **Unlucky player** grinds all week and goes home with nothing → and a
  player who earned nothing for a week's effort does not come back.

It also produced the dead-end that started this: reach the vault holding
only one of the two, and there is no recourse.

**The design.** Effort becomes a guaranteed path, luck stays as a shortcut.

- Opening any **interactive container** grants **+1 Vault Fragment**. That is
  the nine types carrying `interactive: true` in `props.js` — `cabinet_s`,
  `wardrobe`, `chest`, `safe`, `plaque_coin`, `footlocker`, `shelf_stocked`,
  `dresser`, `cabinet_ornate`.
- The sealed and premium caches and the vault door are **excluded for free**:
  `onOpenButtonTap` routes those to `grantCacheLoot`/`openVaultWindow` and
  never reaches `openContainerWindow`, which is where the credit fires.
  `Decor.open()` guards on `this.opened`, so a container cannot be farmed
  twice.
- Fragments are per-wallet at `vaultFragments/{weekId}/{wallet}` and reset
  with the ISO week alongside everything else.
- **8 fragments → Old Paper granted.** **18 fragments → Golden Key granted.**
- The existing 16% roll stays untouched on top, so luck still shortcuts the
  grind — it just no longer *gates* it.
- Grants write the **same** `paperClaims/` and `goldenKeyClaims/` records that
  `/api/paper/claim` and `/api/goldenkey/claim` write and `/api/vault/submit`
  gates on, through the same abort-if-present transaction. So the
  1-per-wallet-per-week cap holds for free, the two award paths can never both
  pay out, and no other route needed changing.
- The client never names an amount. It reports "a container was opened" and
  the server decides what that is worth — a client-supplied quantity would let
  anyone mint the weekly reward in one request.

**Where the player sees it:** a progress bar in the inventory directly beneath
the Golden Key and Old Paper rows (it disappears once both are held), a run-log
line every fifth fragment, and an exact "open N more" count in the vault door's
requirements line.

**Shipped in:** `lib/server/vault-fragments.ts`, `app/api/vault/fragments/route.ts`,
`creditVaultFragment()` in `game.js`.

**The numbers, and how they were arrived at.** They started at 12 and 28,
*estimated* from `spawnDecorInto` at 8–15 interactive containers per bunker.

Measured with the real generator (`npm run measure:containers`, which mounts the
actual engine at each depth and counts what it builds), a bunker holds about
**7** — two runs of 200 floors landed at 6.3 and 7.4. The estimate was 1.3–2.4×
too high.

That mattered, because **the vault needs both items**. At 28 the Golden Key took
~4.4 fully-cleared bunkers; a player opening a realistic ~70% of what they find
had to play nearly every day of the week to reach it. Anyone playing three to
five sessions got the Paper, missed the Key, and therefore earned **nothing** —
precisely the outcome this mechanic exists to make impossible.

| Thresholds | 3 sessions | 4 | 5 | 7 |
|---|---|---|---|---|
| 12 / 28 (old) | Paper | Paper | Paper | both |
| **8 / 18** | Paper | **both** | both | both |

At 8 and 18 the Paper lands on day one, so the mechanic teaches itself early,
and the Key falls mid-week — the arc in §4.

> Still a model, not player data: it assumes one bunker per session and ~70% of
> containers opened. Re-run the measurement whenever `props.js` gains or loses
> an interactive type, and revisit once real weeks exist.

**Why this is the top priority:** it fixes the dead-end, the unlucky-week
churn, and the empty day 2 — with one mechanic, at zero cost.

### 5.2 Daily Contracts — `[TARGET]`

Three objectives, reset 00:00 UTC. Examples: *clear 2 floors*, *kill 40
enemies*, *open 5 containers*. Rewards are Glitch Shards, NullState Point,
and elixir charges — all existing, all off-chain, all free to the operator.

Deliberately **not** USDT (owner decision, and consistent with the earlier
cancellation of the daily drip in `GROWTH-BLUEPRINT.md` §1A).

### 5.3 Login streak — `[TARGET]`

Seven escalating days; breaking it resets to day 1. Loss aversion is the
strongest retention force available and it costs nothing.

Half of this already exists: the Season Pass daily claim grants +1 energy
and +3 t1 shards per UTC day (`game-config.ts:50-51`) — a login reward that
was never framed as one.

### 5.4 Surface the craft timer — `[TODAY]`

Weapon crafting is already time-gated: 6h into tier 2, 12h into tier 3,
server-authoritative (`game-config.ts` `weaponEvolution.craft`). It is a
self-set appointment — one of the most reliable return mechanics there is —
and today nothing tells the player about it unless they open the Crafting
screen.

Now a chip in the map's daily status bar (§5.5): **⏳ 3h 20m** while it runs,
and a bright **✦ WEAPON READY** the moment it is done — tappable, straight into
the Crafting screen. The countdown corrects for client clock skew against the
server's `serverNow`, so the timer reads true even on a phone with a wrong
clock.

### 5.5 The map must show the hook in five seconds — `[TODAY]`

Opening the app shows, above the ENTER button and without a tap:

| Chip | Source | Shown when |
|---|---|---|
| **✦ WEAPON READY** / **⏳ 2h 14m** | `/api/weapons/craft` | a craft is running |
| **◈ 7/12** | `/api/vault/fragments` | something is still to earn |
| **⚡ 4** | `/api/energy` | always, once loaded |

It sits in the bottom bar's own container, in the path the eye already takes
toward the only action on the screen — read rather than discovered.

**Contracts and streak have no chip yet, on purpose.** They are in the build
order and not built, and a chip showing a number nobody tracks is exactly how
`game-config.ts` happened (rule 2, §10). Each chip appears when its system
does; with all three quiet the bar renders nothing rather than an empty frame.

Every fetch runs after first paint and degrades to a hidden chip, never to an
error — a status bar that can show an error is one that can make the home
screen look broken.

---

## 6. What every existing system is FOR

Cross-check for future work. If a system has no row here, question why it
exists.

| System | Layer | Role | Status |
|---|---|---|---|
| Combat, floors, lift | Session | The game | `[TODAY]` |
| Campaign (5 acts) | Onboarding | Teach + unlock the map | `[TODAY]` |
| Bunker raids | Session→Daily | Repeatable content; the map's whole point | `[TODAY]` |
| Energy (5/day) | Daily | Pace sessions, drive refill sales | `[TODAY]` |
| Daily Contracts | Daily | Reason to open the app | `[TARGET]` |
| Streak | Daily | Loss aversion | `[TARGET]` |
| Craft timers (6h/12h) | Daily | Self-set appointment | `[TODAY]` |
| Glitch Shards | Daily→Weekly | Power ratchet | `[TODAY]` |
| NullState Point | Daily→Weekly | Gear ratchet (faucet-only) | `[TODAY]` |
| Vault Fragments | Daily→Weekly | **Connects daily play to money** | `[TODAY]` |
| The Vault | Weekly | The jackpot | `[TODAY]` |
| Leaderboard | Seasonal | Competition | `[CHANGE]` §9 |
| Season Pass | Seasonal | Subscription | `[TODAY]` |
| Referrals | Growth | Acquisition | `[TODAY]` |
| Null Abyss | Endgame | Skill ceiling + season metric | `[TODAY]` |
| Null Cycles (NG+) | Endgame | Difficulty mode, **not** a replay gate | `[CHANGE]` |

Two notes on that last column:

**Money in vs money out.** In: energy refill $1, elixir $1, shard pack $1,
blueprints $1×5, gear $0.5–2, craft skip $1–2, Season Pass (price is
on-chain). Out: the weekly vault, and the monthly top-3 bonus. Daily play
must stay free to operate — that is why layer 2 pays progress, not money.

**NG+ changes meaning.** Once the map is the game, NEW GAME+ stops being
"replay to reach the vault again" and becomes purely an optional difficulty
tier. Nobody should ever be forced through it to reach a weekly reward.

---

## 7. Bunker re-entry (raids)

**`[TODAY]`.** The map used to promise a world the engine did not have.

- Cleared bunkers are selectable on the map and enter as a **fresh raid**
  (`RAID ▸`). The engine reaches them through `mount({ startMode:'raid',
  raidActIndex })` → `startRaid()`.
- **A raid costs 1 energy** (owner decision). Continuing a saved run stays
  free. Grinding having a price is what makes the $1 refill meaningful —
  this is the natural transaction point, and it is money *in*. The cost is
  charged by routing a raid through the existing outdoor strip, so
  `onOutdoorReachedDoor` handles the spend, the retreat-from-the-door and the
  refill modal with no second copy of that logic.
- Raids do not advance the campaign, replay story beats, or show the tutorial.
- Fragments, shards, loot, XP and kills all accrue normally in a raid.

**Three ways a raid could have destroyed the player's campaign, all closed:**

1. **Progress regression.** The map read `currentAct` straight off the saved
   session, so raiding Bunker 1 would have shown a five-bunker veteran a map
   with 3-5 locked. Progress is now its own monotonic high-water mark
   (`lib/campaignProgress.ts`), seeded from the save on first read.
2. **Save deletion.** `DungeonGame`'s Continue branch *consumes* the session it
   loads. A raid now touches neither — it builds its run from scratch.
3. **Lost floor position.** A raid shares the same session document, so farming
   Bunker 1 would have reset a Bunker 3 run to floor 1. The campaign's
   act/depth is stashed on the way in and restored on the way out, in
   localStorage rather than a ref so it survives a save-and-exit mid-raid.

A raid saved mid-run carries `raid: true` in its snapshot and resumes as a
raid — otherwise the resumed run would clear as a campaign bunker and move the
player's resume point to one they had already beaten.

**Locked down by `npm run test:raid`** (`scripts/test-raid-campaign-resume.js`),
which drives the real map in headless Chromium: it seeds a player midway through
Bunker 3, checks the cleared bunkers offer `RAID`, taps it, and asserts the
campaign's act *and floor* come back while everything the raid earned is kept.

That test found a fourth hazard the three above had missed — the resume stash
was consumed inside the snapshot guard, so any path where the engine had no
snapshot to give left it on disk for the *next* raid to restore. Its own first
run was also a false green: with no engine mounted the whole write block was
skipped and the assertions passed against the untouched seeded draft. The
engine stub and the "raid keeps what it earned" assertion exist to make that
impossible to repeat.

**Bunkers need a reason to choose between them — `[TARGET]`.** With all five
open, "which one?" needs an answer, and today the only difference is theme
and monster roster. The intended axis is **time vs risk**: bunker 1 short,
easy, lower tier; bunker 5 long, hard, top tier. The scaling half-exists
already (roster widens per act, `game.js:630`; enemy stats scale with
depth) — what is missing is the player-facing reason to pick.

> **Open question:** how long is one bunker in real play? This cannot be
> measured from a sandbox and it decides whether a separate short-raid mode
> is needed. If a full 5-floor clear is over ~10 minutes, add a "raid one
> floor and extract" option, because that is the shape a MiniPay session
> actually has.

---

## 7b. Fixed: opened things could never be opened again

**`[TODAY]`.** Found while wiring §5.1, and it was the floor under the reported
vault dead end.

`Decor.open()` marks a prop `opened`, and `updateActionButton` skipped anything
opened when picking a target. Two consequences:

- **The vault door became unreachable after one tap.** `closeVaultWindow`'s own
  comment promised "the vault door stays interactive, so you can check your
  Paper and re-open it to enter the code" — and it was false. Tapping *back to
  the bunker* to go read the code locked the player out of the vault for the
  rest of the run. The only remaining control was *leave without opening*,
  which **ends the campaign**. The invisible exit buttons fixed earlier were
  one layer; this was the one underneath.
- **Container loot left behind was destroyed.** Close the window with slots
  untaken — one mis-tap on a phone — and it was gone, silently.

Now `_canReopenDecor()` lets the vault door always be re-targeted, and lets a
container be re-targeted while it still holds untaken slots (the button reads
`REOPEN`). Closing a container with loot inside says so in the run log.

Neither can be farmed: `rollLootSlots()` memoises on `this.lootSlots`, so a
reopened container shows the *same* remaining slots rather than a fresh roll,
and the vault fragment is credited on the first open only.

---

## 8. Known bug: Save & Exit regenerates floors

**`[CHANGE]`.** Real, and worth writing down because it looks like the
persistence question but is a separate defect.

`getSaveSnapshot()` (`game.js:5581-5621`) persists 14 fields — act, depth,
maxDepthReached, xp/level/kills/hp, equipment, inventory, weekly run-caps —
but **not `G.floors`**. `applyRestoredState()` (`game.js:305-343`) does not
restore it either. Both verified line by line.

So: Save & Exit on floor 3 → Continue → `ensureFloor(3)` finds an empty
cache → `makeDungeon(3)` builds a **new** floor. Killed monsters are alive,
looted containers are lootable, smashed props are whole, and the layout is
different — `dungeon.js` uses bare `Math.random()` with no seed, so the same
floor cannot be reproduced at all.

**Not at risk:** the weekly Paper and Golden Key. Guarded twice — the run
caps are saved, *and* the server enforces 1 per wallet per week. The USDT
reward cannot be farmed through this.

**At risk:** XP, ordinary items (→ NullState Point via burn), and Glitch
Shards. The last one has real revenue impact, since shards are also sold at
$1 per 5.

**Severity: medium, and mostly about feel.** A player who saves mid-bunker
and returns to a different map with resurrected monsters concludes the game
is broken. The economic leak is real but small, and partly damped by
`clearGameSession()` consuming the save on load (single-use by design —
`gameSessionService.ts:11-14`).

> Not verified empirically — this is read from source, not reproduced in a
> running game. How *exploitable* it is remains an educated guess.

**Fix:** seed the generator — `seed = hash(wallet, cycle, actIndex, depth)`
— and persist only the deltas (which enemies died, which containers opened,
which loot slots taken). A few KB instead of hundreds. Lower priority than
everything in §5: this annoys players who save mid-run, while §5 decides
whether they come back at all.

---

## 9. Known problems in the seasonal layer

**`[CHANGE]` Two leaderboards that disagree.**
1. Firestore `leaderboard`, written client-side, sorted by **XP** — this is
   what the player sees (`Leaderboard.tsx`).
2. RTDB `leaderboards/{seasonId}` + the on-chain `getSeasonLeaderboard` —
   this is what decides **who gets paid** (`/api/leaderboard`).

`LeaderboardDisplay.tsx`, which reads the second one, is **rendered
nowhere**. So the ranking players see is not the ranking that pays. Pick
one and delete the other.

**`[CHANGE]` The season bonus is entirely manual.** `seasonRewards`
($20/$5/$3) in `game-config.ts` is read by nothing. Paying out requires the
owner to run `scripts/deposit-reward.js` to push the top 3 on-chain *and*
deposit the tokens, every month, by hand. No cron, no reminder. Miss it and
the claim button is simply dead for every player.

**`[CHANGE]` Three different "kills" numbers.** On-chain `kills` is
structurally inaccurate — `executeAction()` takes a boolean, so a 40-kill
run increments it by 1. Firestore `totalKills` is the real figure.
`p.kills` is the live per-run counter. The code already admits this
(`leaderboardService.ts:18-26`). Decide which one is canonical.

---

## 10. Rules for future contributors

These are the invariants. Breaking one is how the game drifted the first
time.

1. **The engine cannot import from `lib/`.** `public/game-engine/*.js` are
   static `<script>` files. Shared values cross the boundary through
   `window.__NS`, `mount()` options, or an API call — never an import. If a
   constant must be shared, the engine's copy is authoritative for gameplay
   and the `lib/` copy must say so in a comment.

2. **Config that nothing reads is a lie.** Before adding to
   `game-config.ts`, confirm a line of source will import it. Nine blocks
   there had zero references and actively contradicted the game — `season`,
   `bunkers`, `specialItems`, `loot`, `seasonRewards`, `burnRewards`,
   `persistence`, `ui`, `docNotes` — and their wrong numbers reached the
   player docs before anyone noticed. They are gone; the file's own header
   now states the rule.

3. **Money is weekly. Progress is daily.** Do not add USDT payouts to the
   daily layer.

4. **Never make a real reward reachable only by luck.** Luck may accelerate
   it; effort must guarantee it. §5.1 is the pattern.

5. **Sessions stay short.** If a change makes the minimum useful session
   longer than ~5 minutes, it is wrong for MiniPay.

6. **Content does not fix a missing loop.** More bunkers, monsters and
   weapons will not answer "why come back tomorrow." Content is consumed;
   loops are not. Fix the loop first.

7. **Update this file in the same PR.** Flip `[TARGET]` → `[TODAY]` when you
   ship it.

---

## 11. Build order

**Before the MiniPay listing — required**
1. ~~§5.1 Vault Fragments~~ — **shipped**
2. ~~§7 Bunker raids~~ — **shipped**
3. ~~§5.5 Daily status on the map~~ — **shipped** (absorbed §5.4)

**Before the listing — strongly recommended**
4. §5.2 Daily Contracts
5. ~~Delete the dead blocks in `game-config.ts`~~ — **shipped**

**After the listing**
6. §5.3 Login streak
7. §7 Bunker differentiation (time vs risk)
8. §8 Seeded dungeon → fixes Save & Exit
9. §9 Leaderboard consolidation + automated season payout

---

## Decision log

| Date | Decision | By |
|---|---|---|
| 2026-07-30 | Campaign = tutorial, world map = the game | Owner |
| 2026-07-30 | Paper/Key guaranteed by effort (fragments); luck stays as a shortcut | Owner |
| 2026-07-30 | Raiding a cleared bunker costs 1 energy | Owner |
| 2026-07-30 | Daily rewards pay progress only; USDT stays weekly | Owner |
| 2026-07-22 | Daily USDT drip cancelled — no capital pre-revenue | Owner (`GROWTH-BLUEPRINT.md` §1A) |

---

## Related documents

- [`GROWTH-BLUEPRINT.md`](./GROWTH-BLUEPRINT.md) — acquisition, referrals, endgame
- [`game-mechanics.md`](./game-mechanics.md) — player-facing rules
- [`treasure-vault-quest.md`](./treasure-vault-quest.md) — vault specifics
- [`rewards-system.md`](./rewards-system.md) — payout mechanics
- [`OWNER-RUNBOOK.md`](./OWNER-RUNBOOK.md) — operational tasks
