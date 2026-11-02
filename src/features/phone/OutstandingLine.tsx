import { useSiteFormat } from '@/app/session/use-session'
import { StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { pluralise } from '@/lib/format'
import type { Outstanding } from './outstanding'
import styles from './phone.module.css'

/**
 * One outstanding thing, in words, at two sizes: a row's one line, and the
 * record's list, where it has room to say what is missing.
 *
 * **Nobody recorded it, so it takes the hatch**: a dose whose window closed and
 * a care note nobody wrote. **A dose still in its window is not a gap yet**, so
 * it is plain words: the reader has time, and hatching it would say the record
 * had already failed. **A given dose waiting for its witness is two facts**,
 * drawn as two (CLAUDE.md §1): the dose is given, and the second signature is
 * not recorded.
 */
export function OutstandingLine({
  item,
  size,
}: {
  item: Outstanding
  size: 'row' | 'record'
}) {
  const format = useSiteFormat()
  const record = size === 'record'

  switch (item.kind) {
    case 'doses_missed':
      return (
        <Unrecorded
          variant={record ? 'row' : 'badge'}
          label={`${item.round} round: ${item.missed} of ${pluralise(item.due, 'dose')} not recorded`}
          detail={
            record
              ? 'The window has closed and nobody has recorded them given or not given.'
              : undefined
          }
        />
      )
    case 'second_signature':
      return (
        <span className={styles.itemFacts}>
          <StatusPill
            tone="positive"
            label={`Given, ${item.round} round`}
            detail={
              record ? `${item.unsigned} of ${pluralise(item.due, 'dose')}` : undefined
            }
          />
          <Unrecorded variant="badge" label="Second signature not recorded" />
        </span>
      )
    case 'doses_due':
      return (
        <span>
          <strong>
            {item.waiting} of {pluralise(item.due, 'dose')}{' '}
            {item.window === 'open' ? 'due now' : `due at ${item.round}`}
          </strong>
          {item.window === 'open'
            ? `, ${item.round} round, until ${format.time(item.closesAt)}`
            : `, from ${format.time(item.opensAt)}`}
        </span>
      )
    case 'no_note_today':
      return (
        <Unrecorded
          variant={record ? 'row' : 'badge'}
          label="No care note today"
          detail={
            !record
              ? undefined
              : item.last === 'never'
                ? 'Nobody has ever written a care note for them.'
                : `Last one: ${format.attributionOn(item.last.recordedBy.displayName, item.last.recordedAt)}.`
          }
        />
      )
    default:
      return assertNever(item)
  }
}

/**
 * What a list with nothing outstanding says, naming the four things it looked
 * at, because "nothing outstanding" alone would claim more than was checked.
 * Plain words, never a green mark: nothing is green because it is empty.
 */
export const NOTHING_OUTSTANDING =
  'No dose due, missed or waiting for a second signature. A care note written today.'
