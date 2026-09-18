/**
 * Every notification this product sends, typed from the Care Worker PRD's
 * Appendix D (Table 19), which is the only place that lists them.
 *
 * **Copied cell for cell, including the column that disagrees with PROF-01.**
 * PROF-01 names four notifications as the safety-critical ones that cannot be
 * disabled; Table 19's own "Can turn off?" column refuses six and calls two of
 * them safety critical. The two documents agree about the four PROF-01 names
 * and disagree about two more. Neither is quietly preferred: the column
 * decides whether a switch is drawn, the words "safety critical" appear only
 * where Table 19 writes them, and `PREFERENCE_QUESTION` puts the disagreement
 * on the screen for the PRD's author.
 *
 * **Who each one reaches is quoted, never interpreted.** Table 19 names five
 * different populations — "All care workers", "Note author", "Responsible
 * staff", "All care workers at site", "Senior Carers" — and nowhere says
 * whether a senior carer is among "all care workers". A screen that decided
 * would be inventing a rule and comparing roles; the words are rendered as
 * written and the reader can see which apply to them.
 */

export type NotificationId =
  | 'medication_round_due'
  | 'medication_window_closing'
  | 'care_note_not_written'
  | 'your_note_flagged'
  | 'your_flagged_note_reviewed'
  | 'new_handover'
  | 'risk_band_raised'
  | 'goal_date_approaching'
  | 'attendance_not_recorded'
  | 'controlled_drug_discrepancy'
  | 'account_locked'
  | 'session_expiring'

/**
 * Table 19's last column, with its two kinds of "No" kept apart.
 *
 * A refusal the document explains and a refusal it does not are different
 * facts, and flattening them to a boolean would lose the only thing the column
 * says about why.
 */
export type CanTurnOff = 'yes' | 'no' | 'no_safety_critical'

export interface NotificationKind {
  id: NotificationId
  /** The notification, in Table 19's own words. */
  what: string
  channel: string
  /** When it arrives. */
  when: string
  /** Who it reaches, quoted from the table's Role column. */
  reaches: string
  canTurnOff: CanTurnOff
}

export const NOTIFICATIONS: NotificationKind[] = [
  {
    id: 'medication_round_due',
    what: 'Medication round due in 30 minutes',
    channel: 'Push and in-app',
    when: '30 minutes before the round',
    reaches: 'All care workers',
    canTurnOff: 'no_safety_critical',
  },
  {
    id: 'medication_window_closing',
    what: 'Medication window closing in 10 minutes',
    channel: 'Push and in-app',
    when: '10 minutes before the window closes',
    reaches: 'All care workers',
    canTurnOff: 'no_safety_critical',
  },
  {
    id: 'care_note_not_written',
    what: 'Care note not written for an assigned resident for 4 hours',
    channel: 'In-app banner',
    when: '4 hours after the last note',
    reaches: 'All care workers',
    canTurnOff: 'no',
  },
  {
    id: 'your_note_flagged',
    what: 'Your care note flagged by a senior',
    channel: 'Push and in-app',
    when: 'On flag',
    reaches: 'The note’s author',
    canTurnOff: 'yes',
  },
  {
    id: 'your_flagged_note_reviewed',
    what: 'Your flagged note reviewed',
    channel: 'Push and in-app',
    when: 'On being marked reviewed',
    reaches: 'The note’s author',
    canTurnOff: 'yes',
  },
  {
    id: 'new_handover',
    what: 'New handover to read',
    channel: 'Push and in-app',
    when: 'On a new handover',
    reaches: 'All care workers',
    canTurnOff: 'yes',
  },
  {
    id: 'risk_band_raised',
    what: 'A resident’s risk band changed to a higher level',
    channel: 'Push and in-app',
    when: 'On a re-score that changes the band',
    reaches: 'All care workers at the site',
    canTurnOff: 'yes',
  },
  {
    id: 'goal_date_approaching',
    what: 'Goal target date approaching',
    channel: 'In-app',
    when: '7 days before the date',
    reaches: 'Responsible staff',
    canTurnOff: 'yes',
  },
  {
    id: 'attendance_not_recorded',
    what: 'Activity attendance not yet recorded',
    channel: 'In-app',
    when: 'The evening of the activity',
    reaches: 'All care workers',
    canTurnOff: 'yes',
  },
  {
    id: 'controlled_drug_discrepancy',
    what: 'Controlled drug discrepancy recorded',
    channel: 'Push',
    when: 'Immediately',
    reaches: 'Senior carers',
    canTurnOff: 'no',
  },
  {
    id: 'account_locked',
    what: 'Account locked after 5 failed attempts',
    channel: 'Email',
    when: 'On lockout',
    reaches: 'The care worker',
    canTurnOff: 'no',
  },
  {
    id: 'session_expiring',
    what: 'Session expiring in 10 minutes',
    channel: 'In-app banner',
    when: '10 minutes before expiry',
    reaches: 'The care worker',
    canTurnOff: 'no',
  },
]

/** Whether this notification offers a switch at all. */
export const canBeTurnedOff = (kind: NotificationKind): boolean =>
  kind.canTurnOff === 'yes'

/**
 * The four PROF-01 names as safety-critical, by id, so the disagreement is
 * checkable rather than described.
 */
export const PROF_01_SAFETY_CRITICAL: NotificationId[] = [
  'medication_round_due',
  'medication_window_closing',
  'account_locked',
  'session_expiring',
]

/** The ids Table 19's own column refuses, whatever its reason. */
export const cannotBeTurnedOff = (): NotificationId[] =>
  NOTIFICATIONS.filter((kind) => !canBeTurnedOff(kind)).map((kind) => kind.id)

/**
 * The two documents' disagreement, drawn at the preferences as a question
 * rather than settled here.
 *
 * The same treatment as the controlled drug register's silence about how old a
 * dose may be: a quoted disagreement a reader can take to the author, not a
 * refusal that looks decided.
 */
export const PREFERENCE_QUESTION =
  'PROF-01 names four notifications as the safety-critical ones that cannot be turned off; Appendix D’s own column refuses six, and calls two of them safety critical. Both are drawn as written. Which list is right is for the PRD’s author.'

/**
 * What the switches do not do, said once at the act.
 *
 * Nothing in this build sends a notification, so leaving one on promises
 * nothing and turning one off prevents nothing. Every cross-portal push in the
 * PRD is refused the same way.
 */
export const NOTHING_IS_SENT =
  'Nothing is sent either way: this build has no push, no email and nothing to send them from. A switch here changes what this screen remembers, not what arrives.'
