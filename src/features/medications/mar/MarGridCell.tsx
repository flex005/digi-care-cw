import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { lookName, type MarCellLook } from './mar-grid'
import { marIcons } from './mar.icons'
import styles from './mar.module.css'

/**
 * One cell of the MAR grid. Ported from the Admin build's `MarGridCell`, with
 * the word added to every state.
 *
 * **Each state is carried three ways: a shape, a word and a full sentence**, so
 * any one can go and the state survives. Colour reinforces and never carries:
 *
 *   Given        a tick and "Given", positive ink on its tint
 *   PRN          a pill and "PRN", plain: a recorded dose, never amber
 *                (docs/DEPARTURES.md)
 *   Not given    a cross and "Not given", critical ink: a decision somebody
 *                signed, with a reason behind the tap
 *   No record    the hatch and "No record": the window closed and nobody wrote
 *                anything. The only patterned state in the grid
 *   Due          an open ring and "Due" inside an info outline: the window is
 *                still open
 *   Not due      "Not due", quiet: nothing was expected
 *
 * **Two facts stay two marks.** A controlled drug given without its second
 * signature keeps "Given" and takes a hatched "No 2nd signature" beneath it. A
 * closed omission keeps its hatch and "No record", and takes a small plain
 * "Closed": closing records a decision about the gap and does not fill it.
 *
 * The button is the cell: a real control inside a real table cell, with the
 * sentence as its accessible name, so the grid is reachable by keyboard and
 * every cell is announced whole.
 */
export function MarCellFace({ look }: { look: MarCellLook }) {
  return (
    <span className={classFor(look)} data-mar={lookName(look)} aria-hidden>
      <Face look={look} />
    </span>
  )
}

export function MarGridCell({
  look,
  sentence,
  onOpen,
}: {
  look: MarCellLook
  /** The full sentence: the accessible name. */
  sentence: string
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      className={classFor(look)}
      aria-label={sentence}
      aria-haspopup="dialog"
      data-mar={lookName(look)}
      data-second-signature={look.kind === 'given' ? look.secondSignature : undefined}
      data-closure={look.kind === 'omitted' ? look.closure : undefined}
      onClick={onOpen}
    >
      <Face look={look} />
    </button>
  )
}

function Face({ look }: { look: MarCellLook }) {
  switch (look.kind) {
    case 'given':
      return (
        <>
          <span className={styles.cellWord}>
            {look.prn ? (
              <Icon name={marIcons.prn} size={12} />
            ) : (
              <Icon name={marIcons.given} size={12} />
            )}
            {look.prn ? 'PRN' : 'Given'}
          </span>
          {look.secondSignature === 'missing' ? (
            <span className={styles.cellSignatureGap} data-state="unrecorded">
              No 2nd signature
            </span>
          ) : null}
        </>
      )
    case 'not_given':
      return (
        <span className={styles.cellWord}>
          <Icon name={marIcons.notGiven} size={12} />
          Not given
        </span>
      )
    case 'omitted':
      return (
        <>
          <span className={styles.cellWord}>No record</span>
          {look.closure === 'closed' ? (
            <span className={styles.cellClosed} data-closed-mark>
              Closed
            </span>
          ) : null}
        </>
      )
    case 'due':
      return (
        <span className={styles.cellWord}>
          <Icon name={marIcons.due} size={12} />
          Due
        </span>
      )
    case 'not_due':
      return <span className={styles.cellWord}>Not due</span>
    case 'not_prescribed_yet':
      return <span className={styles.cellWord}>Not started</span>
    case 'not_held':
      return <span className={styles.cellWord}>Not held</span>
    default:
      return assertNever(look)
  }
}

function classFor(look: MarCellLook): string {
  switch (look.kind) {
    case 'given':
      return look.prn ? styles.cellPrn : styles.cellGiven
    case 'not_given':
      return styles.cellNotGiven
    case 'omitted':
      return styles.cellOmitted
    case 'due':
      return styles.cellDue
    case 'not_due':
      return styles.cellNotDue
    case 'not_prescribed_yet':
    case 'not_held':
      return styles.cellQuiet
    default:
      return assertNever(look)
  }
}
