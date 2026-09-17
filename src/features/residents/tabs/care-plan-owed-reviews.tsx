import { useCallback } from 'react'
import type { Incident, IncidentTypeId, IsoDateTime, ResidentId } from '@/data/types'
import { INCIDENT_TYPES } from '@/data/types'
import { getResidentIncidents } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { carePlanDomainName } from '@/data/access/review-flags'
import { NotYourHome } from '@/components/status'
import { useSiteFormat } from '@/app/session/use-session'
import { assertNever } from '@/lib/assert-never'
import styles from './risk-and-plan.module.css'

const INCIDENT_PHRASE = Object.fromEntries(
  INCIDENT_TYPES.map((type) => [type.id, type.phrase]),
) as Record<IncidentTypeId, string>

/**
 * What this care plan owes, from incidents somebody else reported.
 *
 * Read through this session's clearings rather than from the fixtures, so a
 * review somebody discharged stops being owed on the screen that says it is
 * owed.
 *
 * **Said, not done, from here.** Nobody on this tab can write the plan, so the
 * block names what is owed and by when, and the act at the head of the tab says
 * who writes it.
 *
 * Renders nothing when nothing is owed: a block that says "no reviews
 * outstanding" on nearly every record is volume that drowns the one that has
 * them.
 */
export function OwedReviews({
  residentId,
  now,
}: {
  residentId: ResidentId
  now: IsoDateTime
}) {
  const load = useCallback(() => getResidentIncidents(residentId), [residentId])
  const resource = useResource<Incident[]>(load, [residentId])
  const format = useSiteFormat()

  switch (resource.kind) {
    case 'loading':
      return (
        <p className={styles.note} role="status">
          Checking post-incident reviews…
        </p>
      )

    case 'refused':
      return <NotYourHome refusal={resource} />

    case 'error':
      // Said rather than swallowed. Silence here reads as "nothing is owed",
      // which is the one thing this block must never accidentally claim.
      return (
        <div className={styles.owed} data-owed-error>
          <p className={styles.owedTitle}>
            Post-incident reviews could not be read for this resident
          </p>
          <p className={styles.owedItem}>
            Whether this care plan owes a review is unknown, not settled.
          </p>
        </div>
      )

    case 'ready': {
      const owed = resource.data.flatMap((incident) =>
        incident.reviewFlags.flatMap((flag) =>
          flag.state.kind === 'awaiting' && flag.target.kind === 'care_plan_domain'
            ? [{ incident, flag, domainId: flag.target.domainId }]
            : [],
        ),
      )
      if (owed.length === 0) return null

      return (
        <div className={styles.owed} data-owed={owed.length}>
          <p className={styles.owedTitle}>
            {owed.length === 1
              ? 'This care plan owes a post-incident review'
              : 'This care plan owes post-incident reviews'}
          </p>
          {owed.map(({ incident, flag, domainId }) => (
            <p
              key={`${incident.id}-${domainId}`}
              className={styles.owedItem}
              data-owed-incident={incident.id}
            >
              {carePlanDomainName(domainId)}, {INCIDENT_PHRASE[incident.type]} of{' '}
              <span data-numeric>{format.instantDate(incident.occurredAt)}</span>.{' '}
              {flag.dueBy < now
                ? 'Already past its 48 hours.'
                : `Due by ${format.dateTime(flag.dueBy)}.`}
            </p>
          ))}
        </div>
      )
    }

    default:
      return assertNever(resource)
  }
}
