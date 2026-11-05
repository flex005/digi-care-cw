import styles from './phone.module.css'

/**
 * How wide a share bar's fill is: the figure's share of its denominator, and
 * **never nothing for a figure above zero**.
 *
 * 3 of 165 is under 2%, which at a card's width is under a pixel and draws as an
 * empty track: a bar saying "none" where the record says "some", the false
 * statement the hatch exists to prevent (docs/PHONE_VISUAL_BASELINE.md). So any
 * figure above zero takes at least a sliver, and only an exact zero draws the
 * track empty, because a zero is a finding.
 */
export function shareWidth(value: number, total: number): string {
  if (value <= 0 || total <= 0) return '0%'
  const share = Math.min(100, (value / total) * 100)
  return `max(${Number(share.toFixed(2))}%, var(--space-8))`
}

/**
 * The figure's share of what it is out of, as one thin continuous bar. Drawn
 * only where there is a denominator, and decorative: the figure and the words
 * under it carry the meaning, so the bar is hidden from assistive technology.
 * On a hatched card it takes the hatch's greys rather than purple.
 */
export function ShareBar({
  value,
  total,
  gap,
}: {
  value: number
  total: number
  gap: boolean
}) {
  return (
    <span
      className={gap ? styles.shareGap : styles.share}
      aria-hidden="true"
      data-share
    >
      <span
        className={styles.shareFill}
        style={{ width: shareWidth(value, total) }}
        data-share-fill
      />
    </span>
  )
}
