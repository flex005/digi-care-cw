import { formatCount } from '@/lib/format'
import styles from './RoundColumns.module.css'

/**
 * One column per medication round: solid for doses recorded, hatched for doses
 * due and not recorded, and the pale track for doses not yet due.
 *
 * **Straight bars, never rings.** The hatch has to survive a Figma import, and
 * a CSS gradient cannot follow a curve (docs/DEPARTURES.md).
 *
 * **The hatch means one thing here**: nobody has recorded this dose. It is not
 * texture, and nothing else on the chart takes it.
 *
 * **No proportion stands alone.** Each column states its counts under its time,
 * and carries the whole sentence as its accessible name.
 */
export interface RoundColumn {
  /** "20:00". */
  round: string
  recorded: number
  dueNotRecorded: number
  /** Every dose in the round, recorded or not, due or not. */
  total: number
  /** The round running now. */
  current: boolean
}

const share = (part: number, total: number) => (total === 0 ? 0 : (part / total) * 100)

export function RoundColumns({ columns }: { columns: RoundColumn[] }) {
  return (
    <div className={styles.chart}>
      <ul className={styles.columns}>
        {columns.map((column) => {
          const notYetDue = column.total - column.recorded - column.dueNotRecorded
          return (
            <li
              key={column.round}
              className={column.current ? styles.columnCurrent : styles.column}
              data-round={column.round}
            >
              <div
                className={styles.track}
                role="img"
                aria-label={`${column.round} round: ${formatCount(column.recorded)} recorded, ${formatCount(column.dueNotRecorded)} due and not recorded, ${formatCount(notYetDue)} not yet due, of ${formatCount(column.total)} doses.`}
              >
                {column.dueNotRecorded > 0 ? (
                  <span
                    className={styles.gap}
                    style={{ height: `${share(column.dueNotRecorded, column.total)}%` }}
                    data-segment="due-not-recorded"
                  />
                ) : null}
                {column.recorded > 0 ? (
                  <span
                    className={styles.done}
                    style={{ height: `${share(column.recorded, column.total)}%` }}
                    data-segment="recorded"
                  />
                ) : null}
              </div>
              <span className={styles.round}>{column.round}</span>
              <span className={styles.count} data-numeric>
                {formatCount(column.recorded)} of {formatCount(column.total)}
              </span>
            </li>
          )
        })}
      </ul>
      <ul className={styles.legend}>
        <li>
          <span className={styles.swatchDone} aria-hidden="true" />
          Recorded
        </li>
        <li>
          <span className={styles.swatchGap} aria-hidden="true" />
          Due, not recorded
        </li>
      </ul>
    </div>
  )
}
