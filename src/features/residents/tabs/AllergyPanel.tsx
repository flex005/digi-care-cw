import type { AllergyStatus } from '@/data/types'
import { assertNever } from '@/lib/assert-never'
import { Icon } from '@/components/icon/Icon'
import { Unrecorded } from '@/components/status'
import { Attribution } from './FieldList'
import { generalAndNeedsIcons } from './general-and-needs.icons'
import styles from './AllergyPanel.module.css'

/**
 * Allergies, as a full-width panel at the top of Clinical rather than as row
 * twelve of sixteen.
 *
 * This is the one field on the tab where being easy to miss has a body count,
 * and it is also the sharpest illustration of the Evidence Invariant in the
 * whole product: the reason `AllergyStatus` has three members and not a
 * nullable array. Each renders as a visibly different kind of answer:
 *
 *   Penicillin, anaphylaxis           a recorded value, critical
 *   No known allergies                a recorded NEGATIVE, settled and green
 *   Not recorded                      a gap, hatched
 *
 * Green for the recorded negative here and blue for the recorded negative on
 * the care team lists is not an inconsistency. "Somebody asked, and there are
 * no allergies" is genuinely good news that makes the next medication round
 * safer; "somebody asked, and there are no consultants" is neutral news nobody
 * is better off for.
 *
 * The hatched state goes through <Unrecorded>, which is the only component
 * permitted to apply the hatch. It therefore carries that component's border
 * rather than the thicker left edge the other two have: the alternative was
 * composing the hatch into a second stylesheet, which is precisely the hole
 * scripts/check-hatch.mjs exists to keep shut.
 *
 * **Read-only in this build.** Recording or changing an allergy is not an act
 * either role has here; the tab draws that once, at its top, from the role
 * table, rather than a control on the panel that could only refuse.
 */

const CAPTION = 'Allergies and adverse reactions'

const SEVERITY: Record<'mild' | 'moderate' | 'severe' | 'anaphylaxis', string> = {
  mild: 'mild reaction',
  moderate: 'moderate reaction',
  severe: 'severe reaction',
  anaphylaxis: 'anaphylaxis',
}

export function AllergyPanel({ status }: { status: AllergyStatus }) {
  switch (status.kind) {
    case 'not_recorded':
      return (
        <div className={styles.slot} data-allergies={status.kind}>
          <Unrecorded
            variant="panel"
            caption={CAPTION}
            label="Not recorded"
            detail="Nobody has recorded whether this person has allergies, and medication must not be given on the assumption there are none."
          />
        </div>
      )

    case 'none_known':
      return (
        <div className={styles.slot} data-allergies={status.kind}>
          <div className={styles.settled}>
            <p className={styles.caption}>{CAPTION}</p>
            <p className={styles.headline}>No known allergies</p>
            <p className={styles.detail}>
              Somebody asked and confirmed there are none. This is a complete record,
              not a gap.
            </p>
            <Attribution by={status.recordedBy} at={status.recordedAt} onTint />
          </div>
        </div>
      )

    case 'allergies':
      return (
        <div className={styles.slot} data-allergies={status.kind}>
          <div className={styles.critical}>
            <p className={styles.caption}>
              <Icon name={generalAndNeedsIcons.allergy} size={16} />
              {CAPTION}
            </p>
            <ul className={styles.list}>
              {status.items.map((allergy) => (
                <li key={allergy.substance} className={styles.item}>
                  <span className={styles.headline}>{allergy.substance}</span>
                  <span className={styles.detail}>
                    {allergy.reaction} · {SEVERITY[allergy.severity]}
                  </span>
                </li>
              ))}
            </ul>
            <Attribution by={status.recordedBy} at={status.recordedAt} onTint />
          </div>
        </div>
      )

    default:
      return assertNever(status)
  }
}
