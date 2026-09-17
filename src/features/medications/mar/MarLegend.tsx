import type { MarCellLook } from './mar-grid'
import { MarCellFace } from './MarGridCell'
import styles from './mar.module.css'

/**
 * Every state the grid can draw, in words, always on the page. Never a tooltip:
 * the grid means the opposite of what it looks like to somebody who has not
 * been told what a hatched cell is.
 *
 * **Drawn by the grid's own face**, from a look rather than a made-up record,
 * so no member of staff is named on a legend and the swatch cannot drift from
 * the cell it explains. A swatch is a `<span>`, hidden from assistive
 * technology: the words beside it are the explanation, and every cell already
 * says its state in its own sentence.
 */
const ENTRIES: { look: MarCellLook; title: string; note: string }[] = [
  {
    look: { kind: 'given', prn: false, secondSignature: 'not_missing' },
    title: 'Given',
    note: 'Recorded as given, with who and when.',
  },
  {
    look: { kind: 'given', prn: true, secondSignature: 'not_missing' },
    title: 'PRN',
    note: 'An as-required dose, recorded as given.',
  },
  {
    look: { kind: 'given', prn: false, secondSignature: 'missing' },
    title: 'Given, no second signature',
    note: 'A controlled drug given, and its second signature not recorded.',
  },
  {
    look: { kind: 'not_given' },
    title: 'Not given',
    note: 'Recorded as not given, with a reason. Tap for the reason.',
  },
  {
    look: { kind: 'omitted', closure: 'open' },
    title: 'No record',
    note: 'The window closed and nothing was recorded.',
  },
  {
    look: { kind: 'omitted', closure: 'closed' },
    title: 'No record, closed',
    note: 'Still no record. Somebody closed the omission, and says why.',
  },
  {
    look: { kind: 'due' },
    title: 'Due',
    note: 'The window is still open and nothing is recorded yet.',
  },
  {
    look: { kind: 'not_due' },
    title: 'Not due',
    note: 'No dose was expected at this round.',
  },
  {
    look: { kind: 'not_prescribed_yet' },
    title: 'Not started',
    note: 'Before the prescription started.',
  },
  {
    look: { kind: 'not_held' },
    title: 'Not held',
    note: 'No record of this round is held here. Not a missed dose.',
  },
]

export function MarLegend() {
  return (
    <ul className={styles.legend} aria-label="What each cell means">
      {ENTRIES.map(({ look, title, note }) => (
        <li key={title} className={styles.legendItem} data-legend={title}>
          <MarCellFace look={look} />
          <span className={styles.legendText}>
            <span className={styles.legendTitle}>{title}</span>
            <span className={styles.legendNote}>{note}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
