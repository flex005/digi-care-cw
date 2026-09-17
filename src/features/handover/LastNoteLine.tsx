import type { CareNote, IsoDateTime } from '@/data/types'
import { now } from '@/data/fixtures/clock'
import { NeverWrittenUp } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { elapsedMinutesBetween, formatDuration } from '@/lib/shift'
import styles from './handover.module.css'

/**
 * How long a resident has gone unwritten-about, on a row nobody reviewed.
 *
 * "Not reviewed" says nobody looked at them for this handover. On its own it is
 * true and flat: six of them are identical, and somebody with ten minutes has
 * no way to choose. The silence measured against the record is what separates
 * them, and it is already in the fixtures.
 *
 * Two answers, and they are different failures:
 *
 *   never   nobody has ever written this person up. Hatched: a hole in the
 *           record itself rather than in this handover.
 *   a gap   how long since the last note, with who wrote it and when. Plain
 *           text: the note is a complete record and only its age is a finding.
 */
export function LastNoteLine({ last }: { last: CareNote | 'never' }) {
  const format = useSiteFormat()

  if (last === 'never')
    return (
      <p className={styles.rowSilence} data-silence="never">
        <NeverWrittenUp variant="quiet" />
      </p>
    )

  const since = elapsedMinutesBetween(
    last.recordedAt,
    now().toISOString() as IsoDateTime,
  )

  return (
    <p className={styles.rowSilence} data-silence="gap">
      No care note recorded for{' '}
      <span className={styles.rowSilenceFigure}>{formatDuration(since)}</span>. Last
      written by {last.recordedBy.displayName} at{' '}
      <span data-numeric>{format.dateTime(last.recordedAt)}</span>.
    </p>
  )
}
