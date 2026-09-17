import type { HandoverStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'

/**
 * A resident's status on this handover. CW PRD HO-01.
 *
 * Four states, and the fourth is why the screen exists:
 *
 *   All well          quiet — recorded, and somebody's name on it
 *   Needs attention   the caution tint and ink, with what for beside it
 *   Urgent            critical, with what for beside it
 *   Not reviewed      hatched — nobody looked
 *
 * **All well is not a filled pill.** Recorded and unremarkable renders quietly,
 * or twenty rows of green compete with the hatch on the one screen whose whole
 * job is finding the residents nobody looked at. Quiet is not hidden: the
 * author and the time are on the row either way.
 *
 * **A resident nobody looked at is not all well.** Without the fourth state the
 * pressure at 20:58 with four residents left is to mark them well and go home,
 * and nothing afterwards could tell that from four people who were checked.
 */
export function HandoverStatusBadge({ status }: { status: HandoverStatus }) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'not_reviewed':
      // Label only. What differs row to row is the silence beneath it, which
      // `LastNoteLine` carries; a detail here would repeat "nobody looked" on
      // every hatched row between the reader and the rows they are ranking.
      return <Unrecorded variant="chip" label="Not reviewed" />
    case 'all_well':
      return (
        <Settled
          label="All well"
          detail={format.attribution(status.recordedBy.displayName, status.recordedAt)}
        />
      )
    case 'needs_attention':
      return (
        <StatusPill
          tone="caution"
          label="Needs attention"
          detail={format.attribution(status.recordedBy.displayName, status.recordedAt)}
        />
      )
    case 'urgent':
      return (
        <StatusPill
          tone="critical"
          label="Urgent"
          detail={format.attribution(status.recordedBy.displayName, status.recordedAt)}
        />
      )
    default:
      return assertNever(status)
  }
}
