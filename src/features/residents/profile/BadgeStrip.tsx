import { assertNever } from '@/lib/assert-never'
import { Unrecorded, type StatusTone } from '@/components/status'
import { useTimeZone } from '@/app/session/use-session'
import type { Resident } from '@/data/types'
import { BADGE_STRIP_SOURCES } from './badge-strip-sources'
import styles from './profile.module.css'

/**
 * The five risk flags. RES-02: all five, always, whatever they say.
 *
 * Three lines per flag: the field, the answer, who recorded it. The answer is
 * the largest line and the only one in the status ink.
 *
 * **No coloured edge.** The Admin build drew a bar in the status fill down each
 * card's left side; here the caution fill is below 3:1 by decision and never
 * marks a state alone, so a recorded flag is the status tint with its answer in
 * the status ink, and the words carry it. The unrecorded flag keeps the hatch
 * exactly, through the one component that draws it.
 */
export function BadgeStrip({ resident }: { resident: Resident }) {
  const timeZone = useTimeZone()

  return (
    <ul className={styles.flags} aria-label="Risk flags">
      {BADGE_STRIP_SOURCES.map((source) => {
        const state = source.state(resident, timeZone)
        switch (state.kind) {
          case 'unrecorded':
            return (
              <li key={source.id} className={styles.flagItem} data-badge={source.id}>
                <Unrecorded
                  variant="flag"
                  caption={source.name}
                  label={state.answer}
                  detail={state.attribution}
                />
              </li>
            )
          case 'recorded':
            return (
              <li key={source.id} className={styles.flagItem} data-badge={source.id}>
                <div
                  className={TONE_CLASS[state.tone]}
                  data-state="recorded"
                  data-tone={state.tone}
                >
                  <span className={styles.flagField}>{source.name}</span>
                  <span className={styles.flagAnswer}>{state.answer}</span>
                  <span className={styles.flagAttribution}>{state.attribution}</span>
                </div>
              </li>
            )
          default:
            return assertNever(state)
        }
      })}
    </ul>
  )
}

const TONE_CLASS: Record<StatusTone, string> = {
  positive: styles.flagPositive,
  caution: styles.flagCaution,
  critical: styles.flagCritical,
  info: styles.flagInfo,
  brand: styles.flagBrand,
}
