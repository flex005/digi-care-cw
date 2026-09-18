import { formatCount } from '@/lib/format'
import styles from './CompletionBar.module.css'

/**
 * One module's completeness: what is recorded, what is expected and missing,
 * and — on one bar only — what is recorded and wrong. CW PRD DASH-01.
 *
 * **Solid is recorded, hatched is expected and missing.** The same two
 * treatments as every other bar and chart in this build, for the same reason:
 * the hatch means nobody has recorded this, and it appears nowhere else.
 *
 * **A finding is not a gap, and is drawn apart from one.** The incidents bar's
 * unacknowledged segment is the only one: somebody wrote the incident down and
 * nobody has picked it up, which is a thing that happened rather than a record
 * that is missing. DASH-01 says so itself, and it takes the critical fill.
 *
 * **Straight, never a ring.** The hatch has to survive a Figma import, and a
 * CSS gradient cannot follow a curve (`docs/DEPARTURES.md`).
 *
 * **No proportion stands alone.** The bar states its counts beside it and
 * carries the whole sentence as its accessible name.
 */
export interface CompletionBarProps {
  label: string
  recorded: number
  expected: number
  /** Recorded, and something is owed on it. Drawn apart from the gap. */
  finding?: { count: number; words: string }
  /** What the denominator is, in words: "of 28 residents". */
  of: string
}

const share = (part: number, total: number) => (total === 0 ? 0 : (part / total) * 100)

export function CompletionBar({
  label,
  recorded,
  expected,
  finding,
  of,
}: CompletionBarProps) {
  const found = finding?.count ?? 0
  const missing = Math.max(0, expected - recorded - found)
  const spoken = [
    `${label}: ${formatCount(recorded)} recorded`,
    found > 0 ? `${formatCount(found)} ${finding?.words ?? ''}` : '',
    missing > 0 ? `${formatCount(missing)} expected and missing` : '',
    `${of}.`,
  ]
    .filter((part) => part !== '')
    .join(', ')

  return (
    <div className={styles.bar} data-bar={label}>
      <p className={styles.head}>
        <span className={styles.label}>{label}</span>
        <span className={styles.count} data-numeric>
          {formatCount(recorded)} of {formatCount(expected)}
        </span>
      </p>
      <div className={styles.track} role="img" aria-label={spoken}>
        {recorded > 0 ? (
          <span
            className={styles.done}
            style={{ width: `${share(recorded, expected)}%` }}
            data-segment="recorded"
          />
        ) : null}
        {found > 0 ? (
          <span
            className={styles.finding}
            style={{ width: `${share(found, expected)}%` }}
            data-segment="finding"
          />
        ) : null}
        {missing > 0 ? (
          <span
            className={styles.gap}
            style={{ width: `${share(missing, expected)}%` }}
            data-segment="missing"
          />
        ) : null}
      </div>
      <p className={styles.of}>
        {of}
        {found > 0 ? ` · ${formatCount(found)} ${finding?.words ?? ''}` : ''}
      </p>
    </div>
  )
}
