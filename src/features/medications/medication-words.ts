import type { NotGivenReason } from '@/data/types'

/**
 * How the medication records' closed answers read on screen. One owner, so the
 * round that records a reason and the MAR that shows it cannot word it twice.
 *
 * **A record, not a free choice of phrasing**: CW PRD MED-02's six Not given
 * reasons, in the PRD's words.
 */
export const NOT_GIVEN_REASON_LABEL = {
  resident_refused: 'Resident refused',
  resident_asleep: 'Resident asleep',
  resident_in_hospital: 'Resident in hospital',
  medication_unavailable: 'Medication not available',
  resident_vomiting: 'Resident vomiting',
  other: 'Other',
} as const satisfies Record<NotGivenReason, string>

/** The order the round offers them, the PRD's order. */
export const NOT_GIVEN_REASONS: NotGivenReason[] = [
  'resident_refused',
  'resident_asleep',
  'resident_in_hospital',
  'medication_unavailable',
  'resident_vomiting',
  'other',
]
