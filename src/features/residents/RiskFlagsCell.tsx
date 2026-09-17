import type { Resident } from '@/data/types'
import { RISK_FLAG_SOURCES } from './risk-flag-sources'

/**
 * Whether this resident's risk picture is entirely settled: nothing unrecorded
 * and nothing notable.
 *
 * **It lives under the cell's name because the guard in `fixtures.test.ts` has
 * to ask the question the screen asks**, not a hand-written approximation of
 * it. The residents list that renders the cell is not built in this repository
 * yet; when it is, the cell belongs in this file and reads this predicate,
 * so the screen and the guard cannot drift apart.
 */
export function hasNoRiskFlags(resident: Resident): boolean {
  return RISK_FLAG_SOURCES.every(
    (source) =>
      !source.isUnrecorded(resident) && source.renderNotable(resident).length === 0,
  )
}
