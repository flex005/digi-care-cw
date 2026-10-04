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

/**
 * The dose beside the form, without saying the strength twice.
 *
 * **"10mg · 10mg · modified release tablets" is what the register printed**,
 * for five of its six controlled drugs. `Medication.form` carries the strength
 * and the presentation — "10mg · modified release tablets" — and the row put
 * `dose` in front of it, which repeats the strength whenever the dose is one
 * unit of the thing. A clinical value stated twice invites a reader to wonder
 * which is the dose, which is the last thing a controlled drug register should
 * make anybody wonder.
 *
 * **Both are kept when they differ, because then they are two facts**: a 1g
 * dose of 500mg tablets is two tablets, and 2.5mg of a 10mg/5ml solution is a
 * volume somebody has to measure. It is only the repetition that goes.
 *
 * One owner, because the right rendering depends on the pair rather than on
 * either value (§6) — and the call site that got it wrong was reading two
 * fields that each looked correct on its own.
 */
export function doseAndForm(medication: { dose: string; form: string }): string {
  return medication.form.startsWith(`${medication.dose} ·`)
    ? medication.form
    : `${medication.dose} · ${medication.form}`
}
