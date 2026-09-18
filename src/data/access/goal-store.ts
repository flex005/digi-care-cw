import { held, type SessionHolding } from './session-holding'
import type {
  GoalId,
  GoalProgressNote,
  GoalProgressNoteId,
  IsoDateTime,
  StaffRef,
} from '../types'

/**
 * Progress notes written this session. CW PRD GOAL-02.
 *
 * **Held whole, never merged into the fixtures**, the same shape every other
 * write in this build takes: in memory, gone on reload, and listed among what
 * signing out would lose.
 *
 * **A progress note is immutable, like a care note**, so this store has no
 * edit and no delete. It is somebody's account of a moment, and rewriting it
 * would rewrite what they saw.
 *
 * **Nothing here decides whether a goal is still open.** Progress is derived
 * from the notes by `goal-timing.ts`, which is why `GoalOutcome` has no
 * `in_progress` member: a stored status set once is the stalest claim in the
 * product, and a note is dated evidence instead.
 */

const notes: GoalProgressNote[] = []

/** Everything written this session, oldest first, as the fixtures are. */
export function progressNotesThisSession(): GoalProgressNote[] {
  return [...notes]
}

export const noteWrittenThisSession = (id: GoalProgressNoteId): boolean =>
  notes.some((note) => note.id === id)

/**
 * Keeps a progress note for the session.
 *
 * The id is drawn from a counter that starts above anything in the fixtures, so
 * a session's note can never collide with one somebody else wrote.
 */
export function keepProgressNote(input: {
  goalId: GoalId
  body: string
  recordedBy: StaffRef
  recordedAt: IsoDateTime
}): GoalProgressNote {
  const note: GoalProgressNote = {
    id: `gpn-session-${String(notes.length + 1).padStart(3, '0')}` as GoalProgressNoteId,
    goalId: input.goalId,
    body: input.body,
    recordedBy: input.recordedBy,
    recordedAt: input.recordedAt,
  }
  notes.push(note)
  return note
}

export function goalHoldings(): SessionHolding[] {
  return [...held('goal progress notes you wrote', notes.length)]
}

/** Emptied on sign out, and by tests. */
export function resetSessionGoals(): void {
  notes.length = 0
}
