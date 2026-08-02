// How much of a player's career XP belongs to the season currently running.
//
// Pure arithmetic, in its own file with no Firebase import, for one reason:
// this is the calculation that decides who gets paid, and it is the only part
// of the season leaderboard that can be tested without a browser or a database
// (`npm run test:seasonxp`).
//
// ── THE PROBLEM IT SOLVES ───────────────────────────────────────────────────
//
// OWNER: *"pertimbangan rank skrg sudah bagus belum? mengingat hanya dari xp?"*
//
// XP is cumulative and never resets (GAME-DESIGN.md §9.3), so ranking a SEASON
// by it produced an all-time board that merely paid out monthly. July's winner
// opened August already 5,926 XP ahead of second place — earned in a month that
// was over — and a player joining in September could never have won at all.
//
// A season score is therefore a DELTA: career XP now, minus career XP when the
// season started for that wallet.

/** The fields the calculation reads off a stored leaderboard doc. */
export interface SeasonBaselineDoc {
  /** Career XP as of the last write. */
  xp?: number
  /** Which season `seasonBaseXp` was taken for. */
  seasonId?: string
  /** Career XP at the moment that season started, for this wallet. */
  seasonBaseXp?: number
}

/**
 * Where this wallet's season starts.
 *
 * Three cases, and the middle one is the whole point:
 *
 *   1. Baseline already taken for THIS season -> keep it. Re-deriving it on
 *      every write would reset the player's season score to zero each time.
 *   2. Baseline is from a PREVIOUS season (or absent) -> take `doc.xp`, the
 *      career total as of the last write, which by definition was last season.
 *      NOT the incoming figure: that would silently discard whatever the player
 *      earned before their first sync of the new month.
 *   3. No document at all -> the incoming career total. A wallet with no row is
 *      a new player, whose career total is near zero anyway.
 *
 * At rollout every existing doc lands in case 2 with no `seasonId`, so each
 * player is baselined at their current career total and the season starts level
 * for everybody. That is the desired migration, and it needs no backfill.
 */
export function seasonBaseline(
  doc: SeasonBaselineDoc | null | undefined,
  careerXp: number,
  seasonId: string,
): number {
  const d = doc || {}
  if (d.seasonId === seasonId && typeof d.seasonBaseXp === 'number') return d.seasonBaseXp
  return typeof d.xp === 'number' ? d.xp : careerXp
}

/**
 * XP earned this season. Never negative.
 *
 * The clamp is not defensive noise: "New Game" legitimately restarts a run at 0
 * XP, and while the stored career total is kept as a high-water mark, a doc
 * written before that rule existed could still hold a baseline above the
 * current total. A negative score would sort a player to the very bottom of a
 * board they might be winning.
 */
export function seasonXpFrom(
  doc: SeasonBaselineDoc | null | undefined,
  careerXp: number,
  seasonId: string,
): number {
  return Math.max(0, careerXp - seasonBaseline(doc, careerXp, seasonId))
}
