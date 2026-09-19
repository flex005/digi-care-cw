import { Icon } from '@/components/icon/Icon'
import { assertNever } from '@/lib/assert-never'
import { lookName, type MarCellLook } from './mar-grid'
import { marIcons } from './mar.icons'
import styles from './mar.module.css'

/**
 * One cell of the MAR grid. Ported from the Admin build's `MarGridCell`, with
 * the word added to every state.
 *
 * **Every distinction is a shape, and colour only reinforces it.** At grid
 * density, on a mediocre monitor, in greyscale, hue is the first thing to go —
 * and the pair most at risk is the one that matters most:
 *
 *   Given        a tick, on the settled tint
 *   PRN          a pill glyph, plain: a recorded dose, never amber
 *                (docs/DEPARTURES.md)
 *   Not given    a bar: ALSO recorded and complete, a decision somebody signed
 *                with a reason. It must read as settled, because it is not a
 *                gap
 *   No record    the hatch and no glyph: the window closed and nobody wrote
 *                anything. The only patterned cell in the grid, and the only
 *                one with nothing in it
 *   Due          an open ring inside an info outline: the window is still open
 *   Not due      empty, and empty because nothing was scheduled — not because
 *                nobody recorded
 *
 * **The words were here and are now in the legend, which is on the page above
 * the grid and never a tooltip.** They were added when this was ported, and a
 * week of them is a wall of text in which the one hatched cell is harder to
 * find than it is among glyphs. Every cell is still a button carrying the full
 * sentence as its accessible name, and the detail panel states everything.
 *
 * **Two facts stay two marks, and neither is small print.** A controlled drug
 * given without its second signature keeps the settled fill and takes the
 * unrecorded dashed underline — never a third fill averaging a record and a
 * gap into a state that is neither (CLAUDE.md §1). A closed omission keeps its
 * hatch and takes a glyph: closing records a decision about the gap and does
 * not fill it.
 *
 * The button is the cell: a real control inside a real table cell, so the grid
 * is reachable by keyboard and every cell is announced whole.
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

/**
 * The glyph, written at the call site rather than looked up in a table.
 *
 * The icon usage scanner only finds names statically visible on the element
 * itself; a name assembled elsewhere typechecks and then fails at runtime
 * (CLAUDE.md §3).
 */
function Face({ look }: { look: MarCellLook }) {
  switch (look.kind) {
    case 'given':
      return look.prn ? (
        <Icon name={marIcons.prn} size={16} />
      ) : (
        <Icon name={marIcons.given} size={16} />
      )
    case 'not_given':
      return <Icon name={marIcons.notGiven} size={16} />
    case 'omitted':
      /* No glyph unless somebody closed it: every mark in this grid means
         somebody acted, and an unmarked hatched cell means nobody has. */
      return look.closure === 'closed' ? (
        <Icon name={marIcons.closed} size={16} />
      ) : null
    case 'due':
      return <Icon name={marIcons.due} size={16} />
    case 'not_due':
    case 'not_prescribed_yet':
    case 'not_held':
      /* Nothing was expected here, and the cell is empty because of that
         rather than because nobody wrote anything. The sentence says which. */
      return null
    default:
      return assertNever(look)
  }
}

function classFor(look: MarCellLook): string {
  switch (look.kind) {
    case 'given': {
      /* Two facts, two marks: the settled fill for the dose, the unrecorded
         edge for the signature nobody recorded. Never a third fill. */
      const base = look.prn ? styles.cellPrn : styles.cellGiven
      return look.secondSignature === 'missing'
        ? `${base} ${styles.cellNoWitness}`
        : base
    }
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
