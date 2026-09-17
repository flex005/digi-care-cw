import type { Resident } from '@/data/types'
import { Settled } from '@/components/status'
import { RISK_FLAG_SOURCES } from './risk-flag-sources'
import styles from './residents.module.css'

/**
 * Whether this resident's risk picture is entirely settled: nothing unrecorded
 * and nothing notable.
 *
 * **It lives under the cell's name because the guard in `fixtures.test.ts` has
 * to ask the question the screen asks**, not a hand-written approximation of
 * it. The cell below reads this same list, so the screen and the guard cannot
 * drift apart.
 */
export function hasNoRiskFlags(resident: Resident): boolean {
  return RISK_FLAG_SOURCES.every(
    (source) =>
      !source.isUnrecorded(resident) && source.renderNotable(resident).length === 0,
  )
}

/**
 * The Risk flags column. RES-01.
 *
 * **Every contributing status renders something when unrecorded**, which is
 * what lets the column run on one rule: anything not shown has been recorded
 * and is unremarkable. A resident with nothing to show gets that claim in
 * words, quietly, rather than an empty cell that could mean nobody looked.
 */
export function RiskFlagsCell({ resident }: { resident: Resident }) {
  const flags = RISK_FLAG_SOURCES.flatMap((source) =>
    source.isUnrecorded(resident)
      ? [source.renderUnrecorded()]
      : source.renderNotable(resident),
  )

  if (flags.length === 0)
    return (
      <div className={styles.flags}>
        <Settled label="All assessed, no flags" />
      </div>
    )

  return <div className={styles.flags}>{flags}</div>
}
