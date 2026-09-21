import { useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import type { MoodScore, Resident, Shift, Site } from '@/data/types'
import { CARE_NOTE_CATEGORIES, MOOD_LABELS } from '@/data/types'
import { Button, Checkbox, RadioGroup, Select } from '@/components/primitives'
import { SHIFTS, SHIFT_NAMES, shiftHours } from '@/lib/shift'
import { SubjectStrip } from './SubjectStrip'
import { SUGGESTED_PHRASES } from './suggested-phrases'
import { listInWords, stillNeeded, type NoteFields } from './note-fields'
import styles from './composer.module.css'

/**
 * The fields a care note is written with. CW PRD CN-02.
 *
 * Shared by the composer and a correction, because they write the same record
 * and a correction that captured less than the note it corrects would be a
 * downgrade dressed as a fix.
 *
 * **Controlled.** The fields live with whoever renders the form, so the
 * composer can keep them as a draft as they change and a correction can throw
 * them away. The form holds nothing but the caret it is about to place.
 *
 * Three things it will not do:
 *
 *  1. **Pre-answer anything.** No category, no mood and no shift change until
 *     somebody chooses one. "Not recorded" is a mood somebody picks.
 *  2. **Let the author or the time be typed.** Both come from the session and
 *     the clock when the note is saved.
 *  3. **Accept a changed shift without a reason.**
 */

/** A refusal, drawn at the field it is about, never as a generic error. */
export type Refusal = { at: 'none' } | { at: 'body' | 'shift' | 'act'; message: string }

export const NO_REFUSAL: Refusal = { at: 'none' }

/**
 * Where a loader's refusal belongs. The loader's own words are kept: they say
 * what was refused. A refusal the form does not recognise is drawn at the act,
 * which is still the point it happened, rather than dropped.
 */
export function refusalOf(failure: unknown): Refusal {
  const message = failure instanceof Error ? failure.message : String(failure)
  if (message === 'A care note cannot be empty') return { at: 'body', message }
  if (message === 'Changing the shift needs a reason') return { at: 'shift', message }
  return { at: 'act', message }
}

export function NoteForm({
  resident,
  site,
  title,
  clockShift,
  fields,
  onChange,
  phrases,
  bodyLabel,
  submitLabel,
  refusal,
  saving,
  onSubmit,
  notice,
  secondaryAct,
}: {
  resident: Resident
  site: Site
  /** The form's heading: "Care note for Emmanuel". */
  title: string
  /** What the home's clock said when the form opened, in the home's zone. */
  clockShift: Shift
  fields: NoteFields
  onChange: (fields: NoteFields) => void
  /**
   * `not_offered` on a correction. The openers exist for the blank page at the
   * end of a shift, and somebody correcting a note already knows what was
   * wrong and is there to say so.
   */
  phrases: 'offered' | 'not_offered'
  bodyLabel: string
  submitLabel: string
  refusal: Refusal
  saving: boolean
  onSubmit: () => void
  /** One line beneath the heading, such as the kept draft. */
  notice: ReactNode
  /** Beside the submit, such as a correction's "Cancel". */
  secondaryAct: ReactNode
}) {
  const id = useId()
  const textarea = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | 'none'>('none')
  const needed = stillNeeded(fields)
  const category = fields.category

  /* After a phrase goes in, the caret goes after it and focus stays in the text. */
  useLayoutEffect(() => {
    const element = textarea.current
    const at = caret.current
    if (element === null || at === 'none') return
    caret.current = 'none'
    element.focus()
    element.setSelectionRange(at, at)
  }, [fields.body])

  const set = (patch: Partial<NoteFields>) => onChange({ ...fields, ...patch })

  const insertPhrase = (phrase: string) => {
    const element = textarea.current
    const body = fields.body
    const start = element === null ? body.length : element.selectionStart
    const end = element === null ? body.length : element.selectionEnd
    const before = body.slice(0, start)
    const joiner = before === '' || /\s$/.test(before) ? '' : ' '
    const inserted = `${joiner}${phrase}`
    caret.current = start + inserted.length
    set({ body: `${before}${inserted}${body.slice(end)}` })
  }

  const refusedAt = (field: Exclude<Refusal['at'], 'none'>) =>
    refusal.at === field ? (
      <p className={styles.refusal} role="alert" data-refusal={field}>
        {refusal.message}
      </p>
    ) : null

  return (
    <form
      className={styles.composer}
      noValidate
      aria-labelledby={`${id}-title`}
      onSubmit={(event) => {
        event.preventDefault()
        if (needed.length === 0 && !saving) onSubmit()
      }}
      data-note-form
    >
      <SubjectStrip resident={resident} site={site} />

      <section className={styles.surface}>
        <div className={styles.heading}>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          {notice}
        </div>

        {/* ---- Category, first: the text waits for it (CN-02). ---- */}
        <div className={styles.field}>
          <Select
            label="Category"
            labelVisible
            placeholder="Choose a category"
            value={category === 'not_chosen' ? undefined : category}
            onValueChange={(value) => {
              const chosen = CARE_NOTE_CATEGORIES.find((entry) => entry.id === value)
              if (chosen !== undefined) set({ category: chosen.id })
            }}
            options={CARE_NOTE_CATEGORIES.map((entry) => ({
              value: entry.id,
              label: entry.name,
            }))}
          />
        </div>

        {/* ---- The note ---- */}
        <div className={styles.field}>
          <span className={styles.sectionLabel}>Note</span>
          <label className={styles.bodyLabel} htmlFor={`${id}-body`}>
            {bodyLabel}
          </label>
          {phrases === 'offered' && category !== 'not_chosen' ? (
            /* Openers, never finished sentences and never a judgement. See
               suggested-phrases.ts. */
            <div
              className={styles.phrases}
              role="group"
              aria-label="Suggested openers, inserted where the cursor is"
              data-phrases={category}
            >
              {SUGGESTED_PHRASES[category].map((phrase) => (
                <button
                  key={phrase}
                  type="button"
                  className={styles.phrase}
                  /* Keeps the caret where it is in the text. */
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertPhrase(phrase)}
                  data-phrase={phrase}
                >
                  {phrase.trim()}…
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            id={`${id}-body`}
            ref={textarea}
            className={styles.textarea}
            rows={6}
            placeholder="What you found, what you saw, what the resident said."
            value={fields.body}
            disabled={category === 'not_chosen'}
            aria-describedby={category === 'not_chosen' ? `${id}-body-hint` : undefined}
            onChange={(event) => set({ body: event.target.value })}
          />
          {category === 'not_chosen' ? (
            <p id={`${id}-body-hint`} className={styles.hint}>
              Choose a category first.
            </p>
          ) : null}
          {refusedAt('body')}
        </div>

        {/* ---- Shift ---- */}
        <div className={styles.field} data-shift={fields.shift.kind}>
          <span className={styles.sectionLabel}>Shift</span>
          {fields.shift.kind === 'clock' ? (
            <div className={styles.shiftAnswer}>
              <p className={styles.answer}>
                {SHIFT_NAMES[clockShift]} shift{' '}
                <span className={styles.quiet}>{shiftHours(clockShift)}</span>
              </p>
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  set({ shift: { kind: 'changing', value: 'not_chosen', reason: '' } })
                }
              >
                Change shift
              </Button>
            </div>
          ) : (
            <div className={styles.shiftChange}>
              <Select
                label={`Shift this note is recorded on, instead of ${SHIFT_NAMES[clockShift].toLowerCase()}`}
                labelVisible
                placeholder="Choose a shift"
                value={
                  fields.shift.value === 'not_chosen' ? undefined : fields.shift.value
                }
                onValueChange={(value) => {
                  const chosen = SHIFTS.find((shift) => shift.id === value)
                  if (chosen === undefined || fields.shift.kind !== 'changing') return
                  set({ shift: { ...fields.shift, value: chosen.id } })
                }}
                options={SHIFTS.filter((shift) => shift.id !== clockShift).map(
                  (shift) => ({
                    value: shift.id,
                    label: `${shift.name} shift, ${shiftHours(shift.id)}`,
                  }),
                )}
              />
              <div className={styles.field}>
                <label className={styles.bodyLabel} htmlFor={`${id}-shift-reason`}>
                  Why is this not the {SHIFT_NAMES[clockShift].toLowerCase()} shift?
                  (required)
                </label>
                <textarea
                  id={`${id}-shift-reason`}
                  className={styles.reason}
                  rows={2}
                  value={fields.shift.reason}
                  aria-required="true"
                  onChange={(event) => {
                    if (fields.shift.kind !== 'changing') return
                    set({ shift: { ...fields.shift, reason: event.target.value } })
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="small"
                onClick={() => set({ shift: { kind: 'clock' } })}
              >
                Keep the {SHIFT_NAMES[clockShift].toLowerCase()} shift
              </Button>
            </div>
          )}
          <p className={styles.hint}>
            The shift comes from the home’s clock, because there is no clock-in to read
            it from.
          </p>
          {refusedAt('shift')}
        </div>

        {/* ---- Mood: words, not faces, and nothing chosen for you. ---- */}
        <div className={styles.field} data-mood={fields.mood.kind}>
          <span className={styles.sectionLabel}>Mood</span>
          <RadioGroup
            legend="Mood"
            value={
              fields.mood.kind === 'not_chosen'
                ? undefined
                : fields.mood.kind === 'not_recorded'
                  ? 'not_recorded'
                  : String(fields.mood.score)
            }
            onValueChange={(value) =>
              set({
                mood:
                  value === 'not_recorded'
                    ? { kind: 'not_recorded' }
                    : { kind: 'score', score: moodScoreOf(value) },
              })
            }
            options={[
              ...MOOD_SCORES.map((score) => ({
                value: String(score),
                label: MOOD_LABELS[score],
              })),
              { value: 'not_recorded', label: 'Not recorded' },
            ]}
          />
        </div>

        {/* ---- Flag for review: placed by the author (DEPARTURES.md). ---- */}
        <div className={styles.field} data-flag={fields.flag.kind}>
          <span className={styles.sectionLabel}>Flag for review</span>
          <Checkbox
            label="Flag for a senior to review"
            checked={fields.flag.kind === 'flagged'}
            onCheckedChange={(checked) =>
              set({
                flag: checked
                  ? { kind: 'flagged', reason: '' }
                  : { kind: 'not_flagged' },
              })
            }
          />
          {fields.flag.kind === 'flagged' ? (
            <div className={styles.field}>
              <label className={styles.bodyLabel} htmlFor={`${id}-flag-reason`}>
                Why are you flagging this? (optional)
              </label>
              <textarea
                id={`${id}-flag-reason`}
                className={styles.reason}
                rows={2}
                value={fields.flag.reason}
                onChange={(event) =>
                  set({ flag: { kind: 'flagged', reason: event.target.value } })
                }
              />
            </div>
          ) : null}
        </div>

        {/* ---- Saving. The immutability line is read before, never after. ---- */}
        <div className={styles.actions}>
          <p className={styles.immutable} data-immutable>
            A note cannot be changed once saved. A mistake is fixed with a correction,
            which keeps both.
          </p>
          {refusedAt('act')}
          <div className={styles.actionRow}>
            {secondaryAct}
            <Button
              type="submit"
              size="large"
              disabled={needed.length > 0 || saving}
              data-submit-note
            >
              {submitLabel}
            </Button>
          </div>
          {needed.length > 0 ? (
            <p className={styles.hint} data-still-needed>
              Still needed: {listInWords(needed)}.
            </p>
          ) : null}
        </div>
      </section>
    </form>
  )
}

const MOOD_SCORES: MoodScore[] = [1, 2, 3, 4, 5]

function moodScoreOf(value: string): MoodScore {
  const score = MOOD_SCORES.find((entry) => String(entry) === value)
  if (score === undefined) throw new Error(`No mood score ${value}`)
  return score
}
