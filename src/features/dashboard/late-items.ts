import type {
  HandoverSession,
  IsoDate,
  IsoDateTime,
  Resident,
  RiskTemplateId,
} from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import type { Omission } from '@/data/access/client'
import { SHIFT_NAMES } from '@/lib/shift'
import { wholeDaysBetween } from '@/lib/review-interval'

/**
 * Already late: what has passed its date, oldest first, each with the record it
 * belongs to. CW PRD DASH-01.
 *
 * **Three kinds, never summed into one figure.** A dose an hour late and a
 * review four hundred days late are not one unit, and the combined "Overdue
 * now" count is refused for that reason (`docs/DEPARTURES.md`). They are drawn
 * together, filtered apart, and each carries its own denominator elsewhere.
 *
 * **Every row reaches the record it is about.** The quick action is the route
 * that already exists for it — the assessment form, the review, the handover,
 * the omissions list — never a new screen built to receive a click.
 */

export type LateKind = 'medication' | 'review' | 'handover'

export interface LateItem {
  id: string
  kind: LateKind
  /** What it is, in a list. "Falls Risk, Emmanuel Okafor". */
  what: string
  /** Who it is about, or the fact that it is about the home. */
  who: string
  /** When it fell due. The sort key, and what "how long ago" measures. */
  dueAt: IsoDateTime
  daysLate: number
  /** The words on the control, and where it goes. */
  action: { label: string; href: string }
}

const asInstant = (date: IsoDate): IsoDateTime => `${date}T00:00:00.000Z` as IsoDateTime

const roomOf = (resident: Resident): string =>
  resident.room.kind === 'recorded'
    ? `Room ${resident.room.value}`
    : 'Room not recorded'

/** A dose that fell due and has nothing recorded against it. */
export function fromOmissions(omissions: Omission[]): LateItem[] {
  return omissions.map((omission) => ({
    id: `dose:${omission.record.medicationId}:${omission.record.date}:${omission.record.roundTime}`,
    kind: 'medication' as const,
    what: `${omission.medication.name} ${omission.medication.dose}, ${omission.record.roundTime} round`,
    who: `${omission.resident.fullLegalName} · ${roomOf(omission.resident)}`,
    dueAt: omission.dueAt,
    daysLate: 0,
    action: { label: 'Open the omissions', href: '/medications' },
  }))
}

/**
 * A risk assessment past its own review date, and a care plan past its.
 *
 * Both are reviews and both are late in the same units, so they share a filter
 * — and each row says which it is, because what somebody does about them
 * differs: one is re-scored, the other is a meeting.
 */
export function fromReviews(residents: Resident[], today: IsoDate): LateItem[] {
  const items: LateItem[] = []

  for (const resident of residents) {
    for (const template of RISK_ASSESSMENT_TEMPLATES) {
      const status = resident.risks[template.id as RiskTemplateId]
      if (status.kind !== 'assessed') continue
      if (status.reviewState.kind !== 'overdue') continue
      items.push({
        id: `risk:${resident.id}:${template.id}`,
        kind: 'review',
        what: `${template.name}, past its review date`,
        who: `${resident.fullLegalName} · ${roomOf(resident)}`,
        dueAt: asInstant(status.reviewState.dueOn),
        daysLate: status.reviewState.daysOverdue,
        action: {
          label: 'Re-score',
          href: `/residents/${resident.id}/risk-assessments/${template.id}`,
        },
      })
    }

    const plan = resident.carePlanReview
    if (plan.kind === 'overdue') {
      items.push({
        id: `plan:${resident.id}`,
        kind: 'review',
        what: 'Whole care plan review, past its date',
        who: `${resident.fullLegalName} · ${roomOf(resident)}`,
        dueAt: asInstant(plan.dueOn),
        daysLate: plan.daysOverdue,
        action: {
          label: 'Start review',
          href: `/residents/${resident.id}/care-plan/review`,
        },
      })
    }
  }

  return items.map((item) => ({
    ...item,
    daysLate:
      item.daysLate > 0
        ? item.daysLate
        : wholeDaysBetween(item.dueAt.slice(0, 10) as IsoDate, today),
  }))
}

/**
 * A handover somebody signed and nobody accepted.
 *
 * **It belongs to a shift, not to a resident**, which is why the combined
 * figure's "across 28 residents" was false of it and why this row names the
 * shift instead of a person.
 */
export function fromHandovers(unsigned: HandoverSession[], today: IsoDate): LateItem[] {
  return unsigned.map((session) => ({
    id: `handover:${session.id}`,
    kind: 'handover' as const,
    what:
      session.outgoing.kind === 'signed'
        ? 'Handed over, never countersigned'
        : session.incoming.kind === 'signed'
          ? 'Accepted, never handed over'
          : 'Neither shift signed',
    who: `${SHIFT_NAMES[session.outgoingShift]} to ${SHIFT_NAMES[session.incomingShift].toLowerCase()}, this home`,
    dueAt: asInstant(session.date),
    daysLate: wholeDaysBetween(session.date, today),
    action: { label: 'Open the handover', href: '/handover' },
  }))
}

/** Oldest first: the wait is the finding, as on every other queue here. */
export const byOldest = (items: LateItem[]): LateItem[] =>
  [...items].sort((a, b) => a.dueAt.localeCompare(b.dueAt))

export const ofKind = (items: LateItem[], kind: LateKind | 'everything'): LateItem[] =>
  kind === 'everything' ? items : items.filter((item) => item.kind === kind)

export const LATE_FILTERS: { id: LateKind | 'everything'; label: string }[] = [
  { id: 'everything', label: 'Everything late' },
  { id: 'medication', label: 'Medication' },
  { id: 'review', label: 'Reviews' },
  { id: 'handover', label: 'Handovers' },
]
