import type { HandoverSession } from '@/data/types'
import { Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { SHIFT_NAMES } from '@/lib/shift'
import { formatDate } from '@/lib/format'
import styles from './handover.module.css'

/**
 * An earlier handover that never got both signatures. CW PRD HO-01: "30/08/2026,
 * early to late, never countersigned — Somebody handed over; nobody recorded
 * receiving it."
 *
 * **Hatched, because a missing countersignature is an absence.** Somebody
 * handed a home over and there is no evidence anybody took it. The half that
 * *was* signed is stated in full, author and time included, because it is a
 * complete record and the reader needs to know which end is missing: a gap that
 * does not say which half sends somebody to ask both shifts.
 */
export function UnsignedHandover({ session }: { session: HandoverSession }) {
  const format = useSiteFormat()

  const outgoingShift = SHIFT_NAMES[session.outgoingShift].toLowerCase()
  const incomingShift = SHIFT_NAMES[session.incomingShift].toLowerCase()
  const when = `${formatDate(session.date)}, ${outgoingShift} to ${incomingShift}`

  // Three ways a handover can be short of a signature, and they are three
  // different failures. One label across all three would lose the worst inside
  // the mildest.
  const { missing, detail } =
    session.outgoing.kind === 'signed' && session.incoming.kind === 'not_signed'
      ? {
          missing: 'never countersigned',
          detail: `Handed over by ${session.outgoing.by.displayName} at ${format.time(session.outgoing.at)}, and never accepted by the ${incomingShift} shift. Somebody handed over; nobody recorded receiving it.`,
        }
      : session.outgoing.kind === 'not_signed' && session.incoming.kind === 'signed'
        ? {
            missing: 'never handed over',
            detail: `Accepted by ${session.incoming.by.displayName} at ${format.time(session.incoming.at)}, but the ${outgoingShift} shift never signed to say what they were handing over.`,
          }
        : {
            missing: 'neither shift signed',
            detail: `Neither the ${outgoingShift} shift nor the ${incomingShift} shift signed.`,
          }

  return (
    <li
      className={styles.unsignedRow}
      data-unsigned={session.id}
      data-missing={missing}
    >
      <Unrecorded variant="row" label={`${when}, ${missing}`} detail={detail} />
    </li>
  )
}
