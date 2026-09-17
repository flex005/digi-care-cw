import { useId } from 'react'
import styles from './TextField.module.css'

/**
 * A labelled single-line field. Its label and input take the password field's
 * classes, so the two fields on a sign-in screen cannot drift apart.
 *
 * `readOnly` draws the value quiet and unfocusable-looking, for a value the
 * person cannot change here, such as the address an invitation was sent to.
 * `hint` is one line beneath: what the field is for, or why it was refused.
 */
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  readOnly = false,
  hint,
  ...rest
}: {
  label: string
  value: string
  onChange?: (next: string) => void
  type?: 'text' | 'email'
  autoComplete?: string
  readOnly?: boolean
  hint?: string
} & Record<`data-${string}`, string | undefined>) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        className={readOnly ? styles.readOnly : styles.input}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.target.value)}
        autoComplete={autoComplete}
        aria-describedby={hint === undefined ? undefined : hintId}
        {...rest}
      />
      {hint === undefined ? null : (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  )
}
