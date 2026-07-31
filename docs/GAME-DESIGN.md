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

**Mid-run save fidelity — `[TODAY]`, separate concern.** Fixed; see §8.

---

## 3. The four time layers

A live game needs an answer at every timescale. Miss one and the player
falls out of the loop there. NullState today has layers 1, 3, and a broken
4. **Layer 2 is empty, and that is the whole problem.**

### Layer 1 — Session: "why play right now" — `[TODAY]`

A raid is 3–10 minutes: descend, fight, loot, extract. This layer works.
Combat, procedural floors, loot rarity, the lift, containers — all shipped.

### Layer 2 — Daily: "why come back tomorrow" — `[TODAY]`

This was the empty layer, and the whole problem. Energy (5/day) is a
*limiter*, not a *reason* — you limit what people want more of, and there
was nothing they wanted more of once the vault was claimed. Three of the
four mechanics in §5 now fill it: Vault Fragments, Daily Contracts and the
surfaced craft timer. Only the login streak (§5.3) is still open.

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

Measured with the real generator (`npm run measure:bunker`, which mounts the
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
> containers opened. Re-run `npm run measure:bunker` whenever `props.js` gains or loses
> an interactive type, and revisit once real weeks exist.

**Why this is the top priority:** it fixes the dead-end, the unlucky-week
churn, and the empty day 2 — with one mechanic, at zero cost.

### 5.2 Daily Contracts — `[TODAY]`

Three objectives, reset 00:00 UTC, drawn deterministically from a six-entry
pool by a hash of the day id — so everyone gets the same three that day, no
state is needed to remember the roll, and two players can compare notes.
**Targets are sized against a measured bunker, not a guessed one.**
`npm run measure:bunker` mounts the real engine at every depth and prints the
arithmetic. A full five-floor clear yields roughly **7 lockable containers and
30 enemies** — and that second number is the one that caught the first draft
out, because **floor 5 is the boss floor and holds exactly one enemy**, so
almost every kill comes from floors 1–4.

The pool originally asked for 40 and 80 kills. Measured, those are 1.3 and 2.7
bunkers: a day rolling the 80 would have had the player clear a whole bunker
and finish **one contract out of three**, which reads as punishment, not a
nudge. Retuned:

| Contract | Bunkers of effort |
|---|---|
| `floors3` | 0.6 |
| `cont5` | 0.7 |
| `kills30` | 1.0 |
| `cont8` | 1.2 |
| `kills60` | 2.0 — the deliberate stretch |

Three metrics are picked per day and never repeat, so at most one kills
contract can appear. On most days a thorough bunker finishes two of the three.
**On the day that rolls the 60-kill stretch alongside `cont8` it takes two
bunkers to clear everything** — said plainly rather than claimed away, because
two of five daily runs for a full sweep is a fair price and pretending
otherwise is how a target ends up wrong in the first place.

Rewards are Glitch Shards and NullState Point, credited **the instant a bar
fills** — no claim step, matching how burning already works. Deliberately
**not** USDT (owner decision, consistent with the cancelled daily drip in
`GROWTH-BLUEPRINT.md` §1A). Both currencies already exist and are off-chain,
so the feature costs the operator nothing.

**On trust.** Container progress is credited server-side off the same call that
awards a vault fragment, so it cannot be inflated. Kills, floors and burns
cannot be — the server has no view of combat, so the client reports them. That
is a real limitation, bounded three ways: a per-metric ceiling on any single
request, a per-day ceiling that is the contract's own target, and rewards that
are off-chain and non-withdrawable. It is the same trust level the burn route
already runs at (it takes the client's word for which items were destroyed).
Nothing here touches USDT.

**Where the player sees it:** a `◇ 1/3` chip on the map, ahead of fragments
because it is the thing that resets tonight. Tapping it — or the map's DAILY
rail button, which until now was a `SOON` badge promising exactly this feature
— opens today's three with per-contract progress.

**Shipped in:** `lib/server/dailyContracts.ts`, `app/api/contracts/route.ts`,
`reportContract()` in `game.js`, `DailyStatusBar.tsx`. Locked down by
`npm run test:contracts`.

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
| Daily Contracts | Daily | Reason to open the app | `[TODAY]` |
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

## 7c. Fixed: a floor could be generated with no way out

**`[TODAY]`.** Reported from a real MiniPay session: entered Bunker 1 floor 1,
could not move out of the spawn area, could not test anything else.

The cause is geometric, not a placement mistake. A corridor is one tile
(`TILE = 40`) and the player's radius is 14, so **anything with a solid
footprint wider than 12px seals one** — which is every prop in the game.
`spawnDecorInto` keeps props off doorways and hugging room walls, but a room
whose only exit is narrow, or two props landing either side of a gap, can still
close the last opening.

Flood-filling from the spawn across generated floors, using the engine's own
wall test and its own `NS_solidDecorAt` footprint:

| | Floors with the lift unreachable |
|---|---|
| crate 44×44 (as shipped in #197) | **5 in 60** |
| crate 34×34 (before #197) | 2 in 60 |
| no decor at all | **0 in 100** — walls are never the problem |

So **widening the crate for the art turned a latent bug into a common one**,
and shrinking it again would only have hidden it.

The fix is therefore a guarantee rather than a size: `_ensureFloorTraversable`
runs at the end of `ensureFloor`, walks the floor from the spawn, and if the
lift cannot be reached deletes whichever props sit on the frontier of the
reachable region, then walks it again. That is the minimal set that can be
responsible, so it converges in a pass or two and rarely removes more than one
prop. Vault doors and sealed/premium caches are never removed — they are
content and are placed inside rooms.

**0 in 150 after the fix**, at every depth. Locked down by
`npm run test:traversable`.

> Two things this exposed about measuring: the first version of the check
> required the player to reach the lift's *exact* pixel, which is often
> wall-adjacent and unreachable for a 14px body — it reported walkable floors
> as sealed. And the first version of the fix probed only a blocked cell's
> centre when deciding which prop was guilty, while the reachability walk had
> probed the body's left and right edges too, so it kept "finding nothing to
> remove" on 2 floors in 100.

### 7c-2. The same bug, one level in: props sealing the *side rooms*

**`[TODAY]`.** After 7c shipped, the owner played again: *"masih banyak yang
menghalangi jalan, taruh nya yg betul jangan dekat lorong untuk barang yang
tidak bisa di pecahkan."*

Correct, and the distinction they drew is the one that matters. `props.js`
`hit()` refuses damage to anything `ambient` or `interactive`, so:

- a **barrel** in a doorway costs a moment — you smash it;
- a **cabinet or scenery crate** in the same doorway is a wall.

7c only guaranteed *spawn → lift*. A prop could still seal a side room
entirely, and side rooms are where the lockable containers live — which is to
say, where the weekly reward comes from. So the guarantee is now two:

| | Guarantee |
|---|---|
| **A** | With every **unbreakable** prop in place, each room the walls allow, the lift, and **every lockable container** must still be reachable. |
| **B** | With **everything** in place, the lift must still be reachable. Breakables may narrow a path; they may not seal the run. |

Removal is minimal and targeted: flood a second region outward from whatever is
stranded, then remove only the props standing on **both** frontiers — the ones
literally in the doorway between the two. Intersecting at the *prop* level
rather than the cell level matters, because a wide cabinet blocks three lattice
cells in a row and each side may touch only one of them.

**0 in 150** for sealed rooms, sealed containers, and unreachable lifts.

> **The mistake this nearly shipped, and the measurement that caught it.** The
> first version of guarantee A compared the reachable *cell count* against the
> walls-only count and deleted whatever sat on the frontier. But a prop standing
> in an open room always costs a few cells simply by occupying them — so that
> rule condemned every prop on the floor. `npm run measure:bunker` put lockable
> containers per bunker at **1.4, down from 7.5**: it would have quietly emptied
> the Vault Fragment economy while every traversability check reported success.
> Connectivity, not area, is the right question. Both numbers are re-measurable;
> neither was guessed.

---

## 7d. Fixed: the inventory grew a new fragment bar on every render

**`[TODAY]`.** From the same session, with screenshots: the stash filled with
dozens of identical `FRAGMENTS → OLD PAPER` bars, so burning an item meant
scrolling past all of them — *"sampe2 aku harus scroll hanya untuk burn item di
dalam game"*.

`renderStashPanel()` does not empty its host. It removes children by an
**explicit list of class names** and rebuilds those. The fragment bar (§5.1)
shipped with a class that was never added to that list, so each of the sixteen
call sites appended one more and nothing ever removed them. Reproduced exactly:
**17 renders → 17 bars.**

One line fixes it. `npm run test:inventory` drives the real panel through 17
renders and fails on the pre-fix engine, so it is a regression test rather than
a description of the fix.

> **The rule this leaves behind, written in the code:** anything added to that
> panel must be named in its removal list. A panel that clears itself by
> enumeration will silently accumulate whatever it was not told about.

The owner also asked whether burning should move out of the inventory entirely
— *"atau ga buat menu terpisah saja di dibawah volume???"*. Open question, not
a bug: the scrolling was this defect, not the layout. Worth revisiting on its
own merits once the panel is behaving.

---

## 7e. Fixed: burning on the Rewards screen did not count toward contracts

**`[TODAY]`.** *"kenapa burn items di menu rewards tidak terhitung juga ke
daily????"* — because there are **two** ways to burn and only one of them is
the engine. The in-run inventory dispatches `nullstate-items-burned`; the
out-of-game Rewards screen posts to `/api/burn/record` directly and never runs
`game.js`. The contract was credited from the engine, so it saw only the first.

Both paths already pass through `/api/burn/record`, so the credit moved there —
one call site that sees every burn, using a quantity the route has already
validated, which makes it *harder* to inflate than the client report it
replaced.

Auditing that turned up the same mistake next door: `dailyContracts.ts` claimed
container progress was credited server-side, and it was not — the engine was
posting the count. It now rides on `/api/vault/fragments`, off the same POST
that awards the fragment (one request per container, first open only).

| Metric | Credited by | Client-authoritative? |
|---|---|---|
| `containers` | `/api/vault/fragments` | no |
| `burns` | `/api/burn/record` | no |
| `kills` | engine → `/api/contracts` | yes — the server has no view of combat |
| `floors` | engine → `/api/contracts` | yes — same |

Completion is still announced on every path: the two server-side routes return
the contract state, the engine logs it through one shared `announceContracts()`,
and the Rewards screen appends it to the burn confirmation it already shows.

---

## 8. Fixed: Save & Exit no longer regenerates floors

**`[TODAY]`.** It used to. `getSaveSnapshot()` persisted 14 fields — act,
depth, maxDepthReached, xp/level/kills/hp, equipment, inventory, weekly run
caps — but **not `G.floors`**, and `dungeon.js` generated from bare
`Math.random()` with no seed, so the same floor could not be reproduced at all.

Save & Exit on floor 3 → Continue → `ensureFloor(3)` found an empty cache and
built a **new** floor: different layout, monsters back on their feet, looted
containers refilled, smashed props whole. At risk were XP, ordinary items
(→ NullState Point via burn) and Glitch Shards, which are also sold at $1 per
5. Never at risk: the weekly Paper and Golden Key, guarded both by the saved
run caps and by the server's 1-per-wallet-per-week records.

### The fix, in two halves

Either half alone fixes nothing.

**1. The layout is a pure function of a seed.** One `runSeed` is chosen at
`newGame()` and saved with the run; a floor's seed is
`hash(runSeed, cycle, act, abyss, depth)`. Same seed, same floor, forever — so
the map itself costs **zero bytes** to persist.

**2. What the player did to it is a delta** against that layout: which enemies
died, which props broke, which containers were opened and what is still inside
them, which rooms are lit. Indices into the generated arrays — sound only
*because* of (1).

Measured: **2.6 KB** for a whole five-floor bunker with every prop smashed and
every container opened. Firestore's limit is 1 MB.

### Why `Math.random` is swapped rather than threaded

Randomness for one floor is spread across four files — `dungeon.js` lays out
rooms, `game.js` picks archetypes and elites, `props.js` places and rolls
decor, `entities.js` jitters each enemy. The engine is plain `<script>` tags
with no module system (rule 1, §10), so there is no shared rng to import and
threading one would mean touching every constructor. Generation is synchronous
and finishes inside one call, so the global is swapped for exactly that window
and restored in a `finally`.

### Two guards, both of which earned their place

**A snapshot does not always keep describing the run it was taken from.** The
shell rewrites `campaignActIndex`/`depth` on it when a bunker is cleared (so
ENTER points at the *next* bunker) and again when a raid finishes (so the
campaign resumes where the raid left it). Replaying the old floors into the new
bunker would start it with the monsters already dead and the containers already
emptied. So the save records a `floorsKey` — cycle, act, abyss, raid — and the
delta is dropped unless it still matches.

**Regeneration can legitimately differ.** A Premium Sector cache appears only
while that act's blueprint is owned, and ownership lives outside this save. So
each floor stores the array lengths its indices were taken from; a mismatch
drops the delta rather than killing the wrong monsters.

> **A pre-existing bug this surfaced.** The snapshot written when a raid
> finishes was cached *during* the raid, so it still said `raid: true`.
> `enterSavedSession()` restores `RAID_MODE` from that flag — so the next
> Continue resumed as a raid, and clearing that bunker took the raid branch
> again, fired `nullstate-raid-cleared`, and advanced nothing. **The campaign
> silently stopped progressing.** Fixed in the same place the campaign path
> already fixed up its own snapshot, for the same reason.

Locked down by `npm run test:seeded` (15 assertions), which fails on the old
engine.

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
4. ~~§5.2 Daily Contracts~~ — **shipped**
5. ~~Delete the dead blocks in `game-config.ts`~~ — **shipped**

**After the listing**
6. §5.3 Login streak
7. §7 Bunker differentiation (time vs risk)
8. ~~§8 Seeded dungeon → fixes Save & Exit~~ — **shipped**
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
