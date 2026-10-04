import type { AsyncResource } from '@/data/access/resource'
import styles from './NotYourHome.module.css'

/**
 * A record in a home this viewer is not appointed to. Phase 29.
 *
 * **It names both homes, and it is not a finding.** Nothing is missing and
 * nothing failed: the record exists, it loaded, and the reader is not
 * appointed to the home it belongs to. So it takes neither the hatch, which
 * says nobody has looked, nor the caution treatment, which says something is
 * wrong. It says what is true and stops.
 */
export function NotYourHome({
  refusal,
}: {
  refusal: Extract<AsyncResource<unknown>, { kind: 'refused' }>
}) {
  return (
    <div className={styles.panel} data-not-your-home={refusal.home}>
      <p className={styles.title}>This record belongs to {refusal.home}</p>
      <p className={styles.body}>
        {refusal.what} is held there. You are appointed to{' '}
        {refusal.yours.length > 0
          ? refusal.yours.join(' and ')
          : 'no home on this record'}
        .
      </p>
      <p className={styles.body}>
        {refusal.yours.length > 0
          ? /*
             * **Reworded rather than asked for, because "staff" is attributive
             * here.** The term declares six forms and none of them is the one
             * this sentence wanted: `many` gives "your team members record" and
             * `one` gives "your staff member record", both broken English. A
             * seventh form for a word used as an adjective would be a form per
             * grammatical position, which is the derivation the whole module
             * refuses in the other direction. The sentence does not need the
             * word — the reader it addresses is the person whose record it is.
             */
            'Which homes you are appointed to is on your own record, and an admin changes it on the team screen.'
          : 'Nobody has recorded which home you work in.'}
      </p>
    </div>
  )
}
