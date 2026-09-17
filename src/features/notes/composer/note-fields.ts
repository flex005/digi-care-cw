import type {
  CareNoteCategoryId,
  FlagReason,
  IsoDateTime,
  MoodRecord,
  MoodScore,
  NoteShift,
  Shift,
  StaffRef,
} from '@/data/types'

/**
 * What somebody has entered into a care note so far, before it is a note.
 *
 * **Every field says whether it has been answered.** A form that opened on a
 * category, a mood or a shift change would record an answer nobody gave, so
 * nothing here has a default that is also an answer: a mood nobody chose is
 * `not_chosen`, which cannot be submitted, and "Not recorded" is a choice
 * somebody makes.
 *
 * Author and time are not fields. Both come from the session and the clock at
 * the moment of saving; a field for either would be a forgery surface.
 */
export interface NoteFields {
  category: CareNoteCategoryId | 'not_chosen'
  body: string
  mood: MoodChoice
  shift: ShiftChoice
  flag: FlagChoice
}

export type MoodChoice =
  | { kind: 'not_chosen' }
  | { kind: 'not_recorded' }
  | { kind: 'score'; score: MoodScore }

/**
 * The home's clock, or a change somebody is making to it.
 *
 * A change starts with no shift chosen and no reason: opening the control is
 * not an answer, and "editable with reason" is not editable with an optional
 * reason.
 */
export type ShiftChoice =
  { kind: 'clock' } | { kind: 'changing'; value: Shift | 'not_chosen'; reason: string }

/** The reason is optional to give; an empty one is sent as `not_given`. */
export type FlagChoice = { kind: 'not_flagged' } | { kind: 'flagged'; reason: string }

export const EMPTY_FIELDS: NoteFields = {
  category: 'not_chosen',
  body: '',
  mood: { kind: 'not_chosen' },
  shift: { kind: 'clock' },
  flag: { kind: 'not_flagged' },
}

/** A form with nothing entered, so there is nothing to keep as a draft. */
export function isUntouched(fields: NoteFields): boolean {
  return (
    fields.category === 'not_chosen' &&
    fields.body.trim() === '' &&
    fields.mood.kind === 'not_chosen' &&
    fields.shift.kind === 'clock' &&
    fields.flag.kind === 'not_flagged'
  )
}

/**
 * What is still needed before the note can be saved, in the order the form
 * asks for it. Empty when it can be saved.
 */
export function stillNeeded(fields: NoteFields): string[] {
  const needed: string[] = []
  if (fields.category === 'not_chosen') needed.push('a category')
  if (fields.body.trim() === '') needed.push('what you found')
  if (fields.shift.kind === 'changing') {
    if (fields.shift.value === 'not_chosen') needed.push('the shift')
    if (fields.shift.reason.trim() === '') needed.push('why the shift changed')
  }
  if (fields.mood.kind === 'not_chosen') needed.push('a mood, or Not recorded')
  return needed
}

/** "a category, what you found and a mood". */
export function listInWords(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

export interface NoteSubmission {
  category: CareNoteCategoryId
  body: string
  mood: MoodRecord
  shift: NoteShift
  flag: { kind: 'not_flagged' } | { kind: 'flagged'; reason: FlagReason }
}

/**
 * The fields as the record they become, or `incomplete` if anything is still
 * needed. Author and time are the signed-in person and the moment of saving.
 */
export function toSubmission(
  fields: NoteFields,
  clockShift: Shift,
  author: StaffRef,
  at: IsoDateTime,
): NoteSubmission | 'incomplete' {
  if (stillNeeded(fields).length > 0) return 'incomplete'
  if (fields.category === 'not_chosen' || fields.mood.kind === 'not_chosen')
    return 'incomplete'

  const shift = shiftOf(fields.shift, clockShift)
  if (shift === 'incomplete') return 'incomplete'

  return {
    category: fields.category,
    body: fields.body.trim(),
    mood:
      fields.mood.kind === 'not_recorded'
        ? { kind: 'not_recorded' }
        : {
            kind: 'recorded',
            score: fields.mood.score,
            recordedBy: author,
            recordedAt: at,
          },
    shift,
    flag:
      fields.flag.kind === 'not_flagged'
        ? { kind: 'not_flagged' }
        : { kind: 'flagged', reason: flagReasonOf(fields.flag.reason) },
  }
}

function shiftOf(choice: ShiftChoice, clockShift: Shift): NoteShift | 'incomplete' {
  if (choice.kind === 'clock') return { kind: 'auto', value: clockShift }
  if (choice.value === 'not_chosen') return 'incomplete'
  return {
    kind: 'overridden',
    value: choice.value,
    clockSaid: clockShift,
    reason: choice.reason.trim(),
  }
}

/** A blank reason is a reason not given, never a given reason with no words. */
export function flagReasonOf(text: string): FlagReason {
  return text.trim() === ''
    ? { kind: 'not_given' }
    : { kind: 'given', text: text.trim() }
}
