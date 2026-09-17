import { useId, type ChangeEvent } from 'react'
import styles from './DigitField.module.css'

/**
 * A fixed number of digits: the 4-digit medication PIN, the 6-digit code sent
 * to an email address.
 *
 * **One real input, drawn as boxes.** The boxes are what the design shows and
 * are hidden from assistive technology; the input underneath is what a screen
 * reader, a password manager and a phone's one-time-code suggestion all reach.
 * Six inputs with focus hopping between them breaks every one of those.
 *
 * `masked` draws a dot per digit rather than the digit, for the medication PIN.
 * The PIN is named as what it is everywhere it is asked for — a medication PIN
 * — including where it signs a handover or a risk assessment rather than a dose.
 */
export interface DigitFieldProps {
  label: string
  length: 4 | 6
  value: string
  onValueChange: (value: string) => void
  masked?: boolean
  /** One line under the field: what the digits are for, or why they failed. */
  hint?: string
  autoFocus?: boolean
}

export function DigitField({
  label,
  length,
  value,
  onValueChange,
  masked = false,
  hint,
  autoFocus = false,
}: DigitFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const digits = value.slice(0, length).split('')

  const change = (event: ChangeEvent<HTMLInputElement>) =>
    onValueChange(event.target.value.replace(/\D/g, '').slice(0, length))

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div className={styles.boxes} data-length={length}>
        {Array.from({ length }, (_, index) => {
          const digit = digits[index]
          const current = index === Math.min(digits.length, length - 1)
          return (
            <span
              key={index}
              aria-hidden="true"
              className={[
                styles.box,
                digit === undefined ? '' : styles.filled,
                current ? styles.current : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {digit === undefined ? (
                ''
              ) : masked ? (
                <span className={styles.dot} />
              ) : (
                digit
              )}
            </span>
          )
        })}
        <input
          id={id}
          className={styles.input}
          type={masked ? 'password' : 'text'}
          inputMode="numeric"
          autoComplete={masked ? 'off' : 'one-time-code'}
          maxLength={length}
          value={value}
          onChange={change}
          aria-describedby={hint === undefined ? undefined : hintId}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- the code screen has one field and nothing else to do; AUTH-03 asks for it
          autoFocus={autoFocus}
        />
      </div>
      {hint === undefined ? null : (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
