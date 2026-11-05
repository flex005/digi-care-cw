import { useId, useLayoutEffect, useRef, useState } from 'react'
import { submitCareNote } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import type { IsoDateTime, MoodScore, Shift } from '@/data/types'
import { CARE_NOTE_CATEGORIES, MOOD_LABELS } from '@/data/types'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { Icon } from '@/components/icon/Icon'
import { Checkbox } from '@/components/primitives'
import {
  discardDraft,
  keepDraft,
  keptDraft,
  type KeptDraft,
} from '@/features/notes/composer/draft-store'
import {
  EMPTY_FIELDS,
  listInWords,
  stillNeeded,
  toSubmission,
  type NoteFields,
} from '@/features/notes/composer/note-fields'
import {
  refusalOf as refusalOfFailure,
  type Refusal,
} from '@/features/notes/composer/NoteForm'
import { SUGGESTED_PHRASES } from '@/features/notes/composer/suggested-phrases'
import { SHIFTS, SHIFT_NAMES, shiftAt, shiftHours } from '@/lib/shift'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { listName, type Person } from '../phone-data'
import { phoneIcons } from '../phone.icons'
import { Sheet } from '../shell/Sheet'
import shell from '../shell/shell.module.css'
import { SubjectHeader } from '../SubjectHeader'
import styles from '../phone.module.css'

/** What the record says once a note is saved. */
export interface SavedNote {
  name: string
  flagged: boolean
}

const NO_REFUSAL: Refusal = { at: 'none' }
const MOODS: MoodScore[] = [1, 2, 3, 4, 5]

/**
 * Writing a care note on the phone. CW PRD CN-02, the desktop's composer in a
 * full-height sheet over the record it is about.
 *
 * **The subject is the record behind it**, whose resident came from the
 * address (CLAUDE.md §2), and the sheet pins them in its head. **When the
 * keyboard is up, iOS can slide that head off the top of the screen**, so the
 * save button names the subject in its own words; docs/DEPARTURES.md records
 * the weakening.
 *
 * **Every rule is the desktop's, asked of the same owners**: what is still
 * needed and what is saved (`note-fields.ts`), the draft kept as somebody types
 * (`draft-store.ts`), and the write (`submitCareNote`). Nothing is chosen when
 * it opens, the author and the time are never fields, and a changed shift needs
 * a reason. Save sits at the end of the form and scrolls with it, so it is
 * further down with the keyboard up, never under it.
 */
export function NoteComposerSheet({
  person,
  open,
  onOpenChange,
  onSaved,
}: {
  person: Person
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (saved: SavedNote) => void
}) {
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Care note for ${person.preferredName}`}
      height="full"
      head={<SubjectHeader person={person} name="here" />}
    >
      <ComposerBody person={person} onSaved={onSaved} />
    </Sheet>
  )
}

/** Mounted when the sheet opens, so the shift is read as it opens. */
function ComposerBody({
  person,
  onSaved,
}: {
  person: Person
  onSaved: (saved: SavedNote) => void
}) {
  const id = useId()
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | 'none'>('none')
  const [clockShift] = useState<Shift>(() =>
    shiftAt(now().toISOString() as IsoDateTime, activeSite.timeZone),
  )
  const [restored, setRestored] = useState<KeptDraft | 'none'>(() =>
    keptDraft(member.id, person.id),
  )
  const [fields, setFields] = useState<NoteFields>(() =>
    restored === 'none' ? EMPTY_FIELDS : restored.fields,
  )
  const [refusal, setRefusal] = useState<Refusal>(NO_REFUSAL)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const needed = stillNeeded(fields)
  const category = fields.category
  const name = listName(person)

  /* After an opener goes in, the caret goes after it and focus stays in the text. */
  useLayoutEffect(() => {
    const element = textarea.current
    const at = caret.current
    if (element === null || at === 'none') return
    caret.current = 'none'
    element.focus()
    element.setSelectionRange(at, at)
  }, [fields.body])

  const set = (patch: Partial<NoteFields>) => {
    const next = { ...fields, ...patch }
    setFields(next)
    setRefusal(NO_REFUSAL)
    keepDraft(member.id, person.id, next, now().toISOString() as IsoDateTime)
  }

  const insertOpener = (phrase: string) => {
    const element = textarea.current
    const body = fields.body
    const start = element === null ? body.length : element.selectionStart
    const end = element === null ? body.length : element.selectionEnd
    const before = body.slice(0, start)
    const joiner = before === '' || /\s$/.test(before) ? '' : ' '
    caret.current = start + joiner.length + phrase.length
    set({ body: `${before}${joiner}${phrase}${body.slice(end)}` })
  }

  const save = async () => {
    if (needed.length > 0 || saving) return
    const at = now().toISOString() as IsoDateTime
    const submission = toSubmission(fields, clockShift, member.ref, at)
    if (submission === 'incomplete') return
    setSaving(true)
    try {
      const note = await submitCareNote({
        residentId: person.id,
        ...submission,
        author: member.ref,
        at,
      })
      discardDraft(member.id, person.id)
      onSaved({ name, flagged: note.review.kind === 'flagged_not_reviewed' })
    } catch (failure) {
      setRefusal(refusalOfFailure(failure))
      setSaving(false)
    }
  }

  const refusedAt = (field: Exclude<Refusal['at'], 'none'>) =>
    refusal.at === field ? (
      <p className={styles.refusal} role="alert" data-refusal={field}>
        {refusal.message}
      </p>
    ) : null

  const keptAtWords = (kept: KeptDraft) =>
    format.instantDate(kept.keptAt) ===
    format.instantDate(now().toISOString() as IsoDateTime)
      ? format.time(kept.keptAt)
      : format.dateTime(kept.keptAt)

  const chosenName = CARE_NOTE_CATEGORIES.find((entry) => entry.id === category)?.name

  return (
    <form
      className={styles.composer}
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      data-note-form
    >
      {restored === 'none' ? null : (
        <p className={styles.draftLine} data-draft-restored>
          <span>Draft from {keptAtWords(restored)} kept for this session.</span>
          <button
            type="button"
            className={`${styles.textAct} ${shell.press}`}
            onClick={() => {
              discardDraft(member.id, person.id)
              setRestored('none')
              setFields(EMPTY_FIELDS)
              setRefusal(NO_REFUSAL)
            }}
          >
            Discard draft
          </button>
        </p>
      )}

      {/* ---- Category: nothing chosen until somebody chooses. ---- */}
      <div className={styles.field} data-category={category}>
        <span className={styles.fieldLabel} id={`${id}-category`}>
          Category
        </span>
        <button
          type="button"
          className={`${styles.choiceRow} ${shell.press}`}
          aria-haspopup="dialog"
          aria-labelledby={`${id}-category ${id}-category-value`}
          onClick={() => setPicking(true)}
        >
          <span
            id={`${id}-category-value`}
            className={chosenName === undefined ? styles.choiceEmpty : undefined}
          >
            {chosenName ?? 'Choose a category'}
          </span>
          <Icon name={phoneIcons.choose} size={16} className={styles.rowChevron} />
        </button>
      </div>

      {/* ---- What you found, with openers once a category is chosen. ---- */}
      <div className={styles.field}>
        <label className={styles.fieldLabel} htmlFor={`${id}-body`}>
          Written for whoever reads this next: a {VOCABULARY.manager.one} tonight, an
          inspector in a year.
        </label>
        {category === 'not_chosen' ? null : (
          <div
            className={styles.openers}
            role="group"
            aria-label="Suggested openers, inserted where the cursor is"
            data-phrases={category}
          >
            {SUGGESTED_PHRASES[category].map((phrase) => (
              <button
                key={phrase}
                type="button"
                className={`${styles.opener} ${shell.press}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => insertOpener(phrase)}
              >
                {phrase.trim()}
              </button>
            ))}
          </div>
        )}
        <textarea
          id={`${id}-body`}
          ref={textarea}
          className={styles.textField}
          rows={6}
          value={fields.body}
          placeholder={`What you found, what you saw, what the ${VOCABULARY.subject.one} said.`}
          disabled={category === 'not_chosen'}
          aria-describedby={category === 'not_chosen' ? `${id}-body-hint` : undefined}
          onChange={(event) => set({ body: event.target.value })}
        />
        {category === 'not_chosen' ? (
          <p className={styles.hint} id={`${id}-body-hint`}>
            Choose a category first.
          </p>
        ) : null}
        {refusedAt('body')}
      </div>

      {/* ---- Shift: the home's clock, or a change with a reason. ---- */}
      <div className={styles.field} data-shift={fields.shift.kind}>
        <span className={styles.fieldLabel}>Shift</span>
        {fields.shift.kind === 'clock' ? (
          <div className={styles.shiftLine}>
            <span>
              {SHIFT_NAMES[clockShift]} shift{' '}
              <span className={styles.quiet}>{shiftHours(clockShift)}</span>
            </span>
            <button
              type="button"
              className={`${styles.textAct} ${shell.press}`}
              onClick={() =>
                set({ shift: { kind: 'changing', value: 'not_chosen', reason: '' } })
              }
            >
              Change shift
            </button>
          </div>
        ) : (
          <>
            <div role="radiogroup" aria-label="Shift" className={styles.items}>
              {SHIFTS.filter((shift) => shift.id !== clockShift).map((shift) => {
                const chosen =
                  fields.shift.kind === 'changing' && fields.shift.value === shift.id
                return (
                  <button
                    key={shift.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    className={[
                      styles.choiceRow,
                      shell.press,
                      chosen ? styles.choiceChosen : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => {
                      if (fields.shift.kind !== 'changing') return
                      set({ shift: { ...fields.shift, value: shift.id } })
                    }}
                  >
                    <span>
                      {shift.name} shift, {shiftHours(shift.id)}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className={styles.fieldLabel} htmlFor={`${id}-shift-reason`}>
              Why is this not the {SHIFT_NAMES[clockShift].toLowerCase()} shift?
              (required)
            </label>
            <textarea
              id={`${id}-shift-reason`}
              className={styles.textField}
              rows={2}
              value={fields.shift.reason}
              aria-required="true"
              onChange={(event) => {
                if (fields.shift.kind !== 'changing') return
                set({ shift: { ...fields.shift, reason: event.target.value } })
              }}
            />
            <button
              type="button"
              className={`${styles.textAct} ${shell.press}`}
              onClick={() => set({ shift: { kind: 'clock' } })}
            >
              Keep the {SHIFT_NAMES[clockShift].toLowerCase()} shift
            </button>
          </>
        )}
        <p className={styles.hint}>
          The shift comes from the home’s clock, because there is no clock-in to read it
          from.
        </p>
        {refusedAt('shift')}
      </div>

      {/*
       * ---- Mood: five words, and "Not recorded" apart from them. ----
       * It is not a sixth mood but the absence of one, so it is drawn as the
       * absence is drawn everywhere: the hatch, never a mood button's look.
       */}
      <div className={styles.field} data-mood={fields.mood.kind}>
        <span className={styles.fieldLabel} id={`${id}-mood`}>
          Mood
        </span>
        <div role="radiogroup" aria-labelledby={`${id}-mood`} className={styles.moods}>
          <div className={styles.moodGrid}>
            {MOODS.map((score) => {
              const chosen = fields.mood.kind === 'score' && fields.mood.score === score
              return (
                <button
                  key={score}
                  type="button"
                  role="radio"
                  aria-checked={chosen}
                  className={[
                    styles.moodCell,
                    shell.press,
                    chosen ? styles.moodChosen : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => set({ mood: { kind: 'score', score } })}
                >
                  {MOOD_LABELS[score]}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            role="radio"
            aria-checked={fields.mood.kind === 'not_recorded'}
            className={`${styles.moodNone} ${shell.press}`}
            data-state="unrecorded"
            onClick={() => set({ mood: { kind: 'not_recorded' } })}
          >
            {fields.mood.kind === 'not_recorded' ? (
              <Icon name={phoneIcons.chosen} size={16} />
            ) : null}
            Not recorded
          </button>
        </div>
      </div>

      {/* ---- Flag for a senior, placed by the author. ---- */}
      <div className={styles.field} data-flag={fields.flag.kind}>
        <span className={styles.fieldLabel}>Flag for review</span>
        <Checkbox
          label="Flag for a senior to review"
          checked={fields.flag.kind === 'flagged'}
          onCheckedChange={(checked) =>
            set({
              flag: checked ? { kind: 'flagged', reason: '' } : { kind: 'not_flagged' },
            })
          }
        />
        {fields.flag.kind === 'flagged' ? (
          <>
            <label className={styles.fieldLabel} htmlFor={`${id}-flag-reason`}>
              Why are you flagging this? (optional)
            </label>
            <textarea
              id={`${id}-flag-reason`}
              className={styles.textField}
              rows={2}
              value={fields.flag.reason}
              onChange={(event) =>
                set({ flag: { kind: 'flagged', reason: event.target.value } })
              }
            />
          </>
        ) : null}
      </div>

      {/* ---- Saving, at the end of the form: further down with the keyboard
          up, never under it. The immutability line is read before. ---- */}
      <div className={styles.field}>
        <p className={styles.quiet} data-immutable>
          A note cannot be changed once saved. A mistake is fixed with a correction,
          which keeps both.
        </p>
        {refusedAt('act')}
        <button
          type="submit"
          className={shell.primary}
          aria-disabled={needed.length > 0 || saving}
          data-submit-note
        >
          Save note for {name}
        </button>
        {needed.length > 0 ? (
          <p className={styles.hint} data-still-needed>
            Still needed: {listInWords(needed)}.
          </p>
        ) : null}
      </div>

      <Sheet open={picking} onOpenChange={setPicking} title="Category" cancel="Done">
        <ul className={styles.items}>
          {CARE_NOTE_CATEGORIES.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={[
                  styles.option,
                  shell.press,
                  entry.id === category ? styles.optionChosen : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={entry.id === category}
                onClick={() => {
                  set({ category: entry.id })
                  setPicking(false)
                }}
              >
                <span>{entry.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </form>
  )
}
