import { useId } from 'react'
import styles from './SegmentedControl.module.css'

/**
 * A grey track with a raised white thumb: **one of a small set of mutually
 * exclusive presentations of the same data** (CLAUDE.md §6).
 *
 * The shape language has said what this is since Phase 0 and nothing had
 * needed it: the week and the list on the activities calendar are the first
 * pair that are genuinely one set of records shown two ways.
 *
 * **Never navigation.** Navigation goes to different data, so it takes the
 * grey track with no thumb in the top bar, or an underline strip within a page.
 * A control that carries the thumb is promising the reader that nothing
 * changes but the arrangement.
 *
 * **Never a filter.** A filter narrows a set; this shows the same set.
 *
 * Radio semantics rather than buttons, because that is what it is: a reader on
 * a screen reader hears a group of options with one chosen, and the arrow keys
 * move between them.
 */
export interface SegmentedOption {
  value: string
  label: string
}

export function SegmentedControl({
  label,
  options,
  value,
  onValueChange,
}: {
  /** Names the group. Read out, and never only implied by the options. */
  label: string
  options: SegmentedOption[]
  value: string
  onValueChange: (value: string) => void
}) {
  const name = useId()

  return (
    <div className={styles.track} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const chosen = option.value === value
        return (
          <label
            key={option.value}
            className={chosen ? styles.thumb : styles.segment}
            data-segment={option.value}
            data-chosen={chosen}
          >
            <input
              className={styles.input}
              type="radio"
              name={name}
              value={option.value}
              checked={chosen}
              onChange={() => onValueChange(option.value)}
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}
