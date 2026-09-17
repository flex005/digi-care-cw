import type { HandoverStatus } from '@/data/types'
import type { HandoverRow } from '@/data/access/handover-store'

/**
 * The four groups the handover list is read in. CW PRD HO-01.
 *
 * **Not reviewed leads**, above urgent, and that ordering is deliberate. Urgent
 * is information the reader has received either way, and reading it a minute
 * later costs nothing. Not reviewed is the only group still fixable before the
 * signature goes on, and once it is signed the chance is gone.
 *
 * **The denominators differ between the groups, on purpose.** "Not reviewed, 6
 * of 28" is counted over everybody living at the home. "Urgent, 2 of 22" is
 * counted over the residents somebody actually looked at, because the other six
 * were never assessed and counting them would claim a coverage nobody has.
 */

export type GroupId = HandoverStatus['kind']

export interface HandoverGroup {
  id: GroupId
  title: string
  /** Said in place of the rows when the group is empty, so zero is an answer. */
  emptyNote: string
  /** Which population the count is out of. */
  denominator: 'all_residents' | 'reviewed'
  rows: HandoverRow[]
}

const ORDER: Omit<HandoverGroup, 'rows'>[] = [
  {
    id: 'not_reviewed',
    title: 'Not reviewed',
    emptyNote: 'Everybody living here has been looked at for this handover.',
    denominator: 'all_residents',
  },
  {
    id: 'urgent',
    title: 'Urgent',
    emptyNote: 'Nobody who was reviewed is urgent.',
    denominator: 'reviewed',
  },
  {
    id: 'needs_attention',
    title: 'Needs attention',
    emptyNote: 'Nobody who was reviewed needs attention.',
    denominator: 'reviewed',
  },
  {
    id: 'all_well',
    title: 'All well',
    emptyNote: 'Nobody has been recorded as well.',
    denominator: 'reviewed',
  },
]

/**
 * All four groups, always, in reading order.
 *
 * An empty group keeps its place and states its zero. Dropping it would make
 * "nobody is urgent" and "nobody has checked whether anybody is urgent" the
 * same absence, which is the blank-cell failure one level up.
 */
export function groupRows(rows: HandoverRow[]): HandoverGroup[] {
  return ORDER.map((group) => ({
    ...group,
    rows: rows.filter((row) => row.status.kind === group.id),
  }))
}
