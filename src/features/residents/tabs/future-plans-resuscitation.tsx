import type { ResuscitationStatus } from '@/data/types'
import { staffLabel } from '@/data/access/team-store'
import { Unrecorded } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import styles from './people-and-plans.module.css'

/**
 * The resuscitation decision, as a full-width panel rather than one row of
 * eight.
 *
 * For a DNAR the same ambiguity is catastrophic in both directions: a missing
 * decision must never read as "for resuscitation" and never as "DNAR". So
 * there are three states and the third is rendered loudly:
 *
 *   DNAR in place          brand purple: a signed clinical decision
 *   For resuscitation      green: recorded, and CPR is to be attempted
 *   No decision recorded   hatched: nobody has recorded one, and CPR is the default
 *
 * DNAR is brand rather than red or green because it is neither good news nor
 * bad; a care worker who hesitates over red loses the seconds the decision
 * exists to save.
 *
 * The hatched state says what happens without a decision, because that is the
 * part a reader cannot infer: an unrecorded decision is an outcome nobody chose.
 */
export function ResuscitationPanel({
  status,
  residentName,
}: {
  status: ResuscitationStatus
  residentName: string
}) {
  const format = useSiteFormat()

  switch (status.kind) {
    case 'no_decision_recorded':
      return (
        <div className={styles.bannerSlot} data-resuscitation="no_decision_recorded">
          <Unrecorded
            variant="panel"
            caption="Resuscitation"
            label="No decision recorded"
            detail={`Nobody has recorded whether CPR should be attempted for ${residentName}; in the absence of a decision CPR is attempted.`}
          />
        </div>
      )

    case 'dnar_in_place':
      return (
        <div className={styles.bannerSlot} data-resuscitation="dnar_in_place">
          <div className={styles.bannerBrand}>
            <p className={styles.bannerCaption}>Resuscitation</p>
            <p className={styles.bannerHeadline}>DNAR in place</p>
            <p className={styles.bannerDetail}>
              Do not attempt cardiopulmonary resuscitation. This is a signed clinical
              decision and applies wherever {residentName} is.
            </p>
            <p className={styles.bannerAttribution}>
              Signed by {status.signedBy},{' '}
              <span data-numeric>{formatDate(status.signedOn)}</span>
            </p>
          </div>
        </div>
      )

    case 'for_resuscitation':
      return (
        <div className={styles.bannerSlot} data-resuscitation="for_resuscitation">
          <div className={styles.bannerSettled}>
            <p className={styles.bannerCaption}>Resuscitation</p>
            <p className={styles.bannerHeadline}>For resuscitation</p>
            <p className={styles.bannerDetail}>CPR is to be attempted.</p>
            <p className={styles.bannerAttribution}>
              Recorded by {staffLabel(status.recordedBy)},{' '}
              <span data-numeric>{format.instantDate(status.recordedAt)}</span>
            </p>
          </div>
        </div>
      )

    default:
      return assertNever(status)
  }
}
