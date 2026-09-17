import type { ReactNode } from 'react'
import type { CarePlanDomainId, CarePlanDomainRecord } from '@/data/types'
import { Card, CardHead } from '@/components/primitives'
import { DomainStatusBadge, SupportLevelBadge, Unrecorded } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { staffLabel } from '@/data/access/team-store'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { NEEDS_SECTIONS, domainName } from './needs-sections'
import styles from './needs.module.css'

/**
 * The Needs tab: read-only, generated from the care plan's domains, with the
 * support level per domain. A domain with no care plan content shows the
 * unrecorded treatment.
 *
 * Built in the same visual language as General Information, deliberately: the
 * same card head, the same label-left value-right rhythm, the same three answer
 * types. Two tabs on the same record that answer questions in two different
 * shapes make the reader re-learn where to look, and the one thing they must be
 * able to do on both without thinking is spot a gap.
 *
 * Each domain is a term; its three facts are its definitions. Care plan status,
 * support level and what the person actually said are separate answers with
 * separate treatments, never merged. A domain that is `not_started` with
 * `not_assessed` support has two gaps, and shows two.
 *
 * Three things this screen must not do:
 *
 *  1. **Omit a domain.** All ten are listed for every resident, whether or not
 *     anybody has written them. A Needs tab showing only the domains somebody
 *     got round to would read as a complete picture of a person's needs.
 *  2. **Let "Independent" and "not assessed" look alike.** They are opposite
 *     claims about somebody's safety, and reading the second as the first is
 *     how a person gets left to manage the stairs alone. Support level is its
 *     own labelled answer for exactly that reason.
 *  3. **Offer to write a domain here.** Writing the care plan is one act, asked
 *     of the role table once at the top of the tab. Each card's expand button
 *     opens the Care Plan tab, where the domains are read in full.
 */

/** One fact about a domain: label left, answer right. The Field rhythm, at
 *  the scale of a row rather than a card. */
function DomainFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.domainFact}>
      <dt className={styles.domainFactLabel}>{label}</dt>
      <dd className={styles.domainFactValue}>{children}</dd>
    </div>
  )
}

/**
 * Somebody is rewriting this domain, said quietly.
 *
 * **It is a fact about the current plan, and this tab is a summary of the
 * current plan.** A reader who sees a domain here and does not know it is under
 * revision may act on a version that is about to be superseded, so silence was
 * not neutral, even though nothing the tab claimed was false.
 *
 * Plain text at the weight the settled facts sit at: no chip, no tint, no
 * hatch. The revision is context, not a call to action, and giving it a
 * treatment would put it above the three facts it sits beside.
 *
 * **It never touches the status.** The signed version is still in force and
 * still what staff follow; only a signature changes that. Rendered only where a
 * signature exists to be in force: with nothing signed, `in_progress` already
 * says it, and saying it twice in one cell is volume drowning a distinction.
 */
function RevisionInProgress({ record }: { record: CarePlanDomainRecord }) {
  const format = useSiteFormat()
  if (record.draft.kind !== 'draft') return null
  if (record.status.kind === 'in_progress') return null

  return (
    <p className={styles.domainRevision} data-revision>
      A revision is in progress, not yet signed,{' '}
      {format.attributionOn(staffLabel(record.draft.updatedBy), record.draft.updatedAt)}
      .
    </p>
  )
}

function DomainRow({
  domainId,
  record,
}: {
  domainId: CarePlanDomainId
  record: CarePlanDomainRecord | undefined
}) {
  const name = domainName(domainId)

  // A domain missing from a resident's care plan array entirely, which the
  // fixtures forbid, but the screen must not assume.
  if (record === undefined) {
    return (
      <li className={styles.domainRow} data-domain={domainId}>
        <h3 className={styles.domainName}>{name}</h3>
        <dl className={styles.domainFacts}>
          <DomainFact label="Care plan">
            <Unrecorded
              variant="chip"
              label={`${name} is not on this care plan`}
              detail="nothing has been written for this domain"
            />
          </DomainFact>
        </dl>
      </li>
    )
  }

  const notStarted = record.status.kind === 'not_started'

  return (
    <li className={styles.domainRow} data-domain={domainId}>
      <h3 className={styles.domainName}>{name}</h3>

      <dl className={styles.domainFacts}>
        <DomainFact label="Care plan">
          <DomainStatusBadge status={record.status} />
          <RevisionInProgress record={record} />
        </DomainFact>

        {/* Its own answer, always. `not_assessed` is a real member of the
            union and renders hatched; it is never a blank and never absent. */}
        <DomainFact label="Support level">
          <SupportLevelBadge level={record.supportLevel} />
        </DomainFact>

        <DomainFact label="In this person's words">
          {notStarted || record.summary === '' ? (
            <Unrecorded
              variant="chip"
              label="No care plan content"
              detail="nothing written"
            />
          ) : (
            // Written in the resident's own voice.
            <p className={styles.domainQuote}>{record.summary}</p>
          )}
        </DomainFact>
      </dl>
    </li>
  )
}

export function NeedsTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()
  const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
  const carePlanHref = `/residents/${resident.id}/care-plan`

  return (
    <div className={styles.tabPanel} data-tab-panel="needs">
      <div className={styles.intro}>
        <p className={styles.tabIntro}>
          Generated from the care plan and read-only. All ten domains are listed, filled
          in or not.
        </p>
        <ActPoint
          answer={viewer.ask('write_care_plan', resident.id)}
          label="Edit care plan"
          notBuilt="Editing a care plan is not built."
          residentName={resident.preferredName}
        />
      </div>

      {NEEDS_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHead
            title={section.name}
            subtitle={section.description}
            expand={{ kind: 'link', href: carePlanHref }}
          />
          <ul className={styles.domainList}>
            {section.domainIds.map((domainId) => (
              <DomainRow
                key={domainId}
                domainId={domainId}
                record={byDomain.get(domainId)}
              />
            ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
