import { held, type SessionHolding } from '@/data/access/session-holding'
import type { IsoDateTime, ResidentId, StaffId } from '@/data/types'
import { isUntouched, type NoteFields } from './note-fields'

/**
 * Care note drafts, kept for this session as somebody types. CW PRD CN-02.
 *
 * **Decided: kept automatically, per person and per resident, with no dialog
 * on leaving.** The PRD asks for a navigate-away dialog and a "Save as draft"
 * link. A dialog that interrupts somebody called to another room is a dialog
 * they dismiss, and a draft that is always kept needs no button to keep it.
 * Returning to the composer restores the draft and says so.
 *
 * **In memory, in this tab, and nowhere else** (CLAUDE.md §6). Record data is
 * never written to browser storage, so a reload loses a draft, and signing out
 * destroys it: `resetNoteDrafts` is called when the session ends, and
 * `draftHoldings` puts a line on the sign-out screen, because a draft is work
 * somebody would lose. docs/DEPARTURES.md: no draft survives a sign-out.
 *
 * It lives beside the composer rather than in `src/data`, for the same reason
 * the medication PINs live in `src/app/session`: `src/data` is shared with the
 * Admin build, which has no drafts, and the two builds' session-loss lists stay
 * identical.
 */

export interface KeptDraft {
  fields: NoteFields
  /** When it was last kept, as somebody typed. */
  keptAt: IsoDateTime
}

const drafts = new Map<string, KeptDraft>()

const key = (viewer: StaffId, resident: ResidentId) => `${viewer}|${resident}`

export function keptDraft(viewer: StaffId, resident: ResidentId): KeptDraft | 'none' {
  return drafts.get(key(viewer, resident)) ?? 'none'
}

/**
 * Keeps what has been entered. A form with nothing in it is not a draft, so
 * emptying the form removes the draft rather than keeping a blank one.
 */
export function keepDraft(
  viewer: StaffId,
  resident: ResidentId,
  fields: NoteFields,
  at: IsoDateTime,
): void {
  if (isUntouched(fields)) {
    drafts.delete(key(viewer, resident))
    return
  }
  drafts.set(key(viewer, resident), { fields, keptAt: at })
}

/** Throws the draft away: on "Discard draft", and once the note is saved. */
export function discardDraft(viewer: StaffId, resident: ResidentId): void {
  drafts.delete(key(viewer, resident))
}

/** What signing out would lose. */
export const draftHoldings = (): SessionHolding[] =>
  held('care note drafts you had not saved', drafts.size)

/** Called when the session ends, with every other store. */
export function resetNoteDrafts(): void {
  drafts.clear()
}
