import { useState } from 'react'
import type { CarePlanDomainRecord, CarePlanText, IsoDateTime } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { now as appNow } from '@/data/fixtures/clock'
import { staffLabel } from '@/data/access/team-store'
import {
  Accordion,
  AccordionSection,
  Card,
  CardHead,
  buttonClassName,
} from '@/components/primitives'
import { Settled, StatusPill, SupportLevelBadge, Unrecorded } from '@/components/status'
import Link from 'next/link'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { assertNever } from '@/lib/assert-never'
import { formatCount, formatLateness, pluralise } from '@/lib/format'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { carePlanGaps } from '@/features/residents/profile/record-gaps'
import { configuredState } from '@/data/access/site-config-store'
import { OwedReviews } from './care-plan-owed-reviews'
import { PLAN_FIELDS, currentVersion, versionCount } from './plan-fields'
import { reviewTiming, type ReviewTiming } from './review-timing'
import styles from './risk-and-plan.module.css'

/**
 * A resident's care plan, read-only for both roles. CPLN-01.
 *
 * The sentence: **these parts of this person's care have never been written
 * down.**
 *
 * **Every domain always renders**, iterated from the domain constant and never
 * from the resident's record. A list of only the written domains would read as
 * a complete plan, and a plan is exactly the document where an absence has to
 * be visible: staff follow what it says, so what it does not say is what nobody
 * is doing.
 *
 * **Nobody writes from here.** A manager writes and finalises the plan, so the
 * one act drawn is refused with the role table's reason, and each domain opens
 * to be read rather than edited.
 */
export function CarePlanTab() {
  const { resident, site } = useOpenRecord()
  const viewer = useViewer()
  const reviewAnswer = viewer.ask('conduct_review', resident.id)
  // One instant for the whole tab, so the owed block and a row cannot disagree
  // about whether a date has passed.
  const [now] = useState<IsoDateTime>(() => appNow().toISOString() as IsoDateTime)

  const byDomain = new Map(resident.carePlan.map((entry) => [entry.domainId, entry]))
  const rows = CARE_PLAN_DOMAINS.map((domain) => {
    const record = byDomain.get(domain.id)
    return {
      domain,
      record,
      state: configuredState(
        resident.siteId,
        domain.id,
        record !== undefined && record.status.kind !== 'not_started',
      ),
    }
  })

  /*
   * **Counted over the domains this home keeps**, by the same function the risk
   * templates and consent types have beside it, so three counts on one record
   * mean one thing by a denominator. A retired domain stays on the list below.
   *
   * Part-written and unsigned is not counted in the figure, and is not nothing
   * either. "Never been written down" is a precise claim and a draft breaks it,
   * but a domain nobody has signed gives staff nothing to follow, so the count
   * is named in the sentence instead of becoming a second figure competing with
   * the first.
   */
  const { asked, neverWritten, unsigned } = carePlanGaps(resident)
  const retired = rows.length - asked

  return (
    <div className={styles.tab} data-tab-body="care-plan">
      <Card>
        <CardHead
          title={`${resident.preferredName}’s care plan`}
          subtitle={
            retired > 0
              ? `Counted over the ${asked} of ${rows.length} domains ${site.name} keeps.`
              : `Counted over all ${rows.length} care plan domains.`
          }
          expand={{ kind: 'whole' }}
        />
        <div className={styles.stack}>
          <OwedReviews residentId={resident.id} now={now} />
          <div
            className={neverWritten > 0 ? styles.leadGap : styles.leadPlain}
            data-never-written={neverWritten}
          >
            <span className={styles.leadFigure} data-numeric>
              {formatCount(neverWritten)}
            </span>
            <span className={styles.leadBody}>
              <span className={styles.leadTitle}>
                of <span data-numeric>{formatCount(asked)}</span> parts of{' '}
                {resident.preferredName}&rsquo;s care have never been written down
              </span>
              <span className={styles.leadDetail}>
                Never written down is not &ldquo;no needs here&rdquo;.
                {unsigned > 0 ? (
                  <>
                    {' '}
                    A further <span data-numeric>
                      {pluralise(unsigned, 'domain')}
                    </span>{' '}
                    of {formatCount(asked)} started, not signed, and nothing staff can
                    follow yet.
                  </>
                ) : null}
              </span>
            </span>
          </div>
          {retired > 0 ? (
            <p className={styles.note} data-retired-note>
              {formatCount(retired)} of the {formatCount(rows.length)} domains are not
              kept at {site.name} and are not counted above; anything already written
              for them is still below.
            </p>
          ) : null}
          <div className={styles.acts}>
            <ActPoint
              answer={viewer.ask('write_care_plan', resident.id)}
              label="Edit care plan"
              notBuilt="Editing a care plan is not built."
              residentName={resident.preferredName}
            />
            {/*
             * Conducting a review is a different act from writing the plan:
             * it is the meeting, and it records which parts were still gaps.
             */}
            {reviewAnswer.kind === 'yes' ? (
              <Link
                href={`/residents/${resident.id}/care-plan/review`}
                className={buttonClassName({ variant: 'secondary' })}
                data-open-review
              >
                Conduct a whole care plan review
              </Link>
            ) : (
              <ActPoint
                answer={reviewAnswer}
                label="Conduct a whole care plan review"
                notBuilt="Conducting a review is not built."
                residentName={resident.preferredName}
              />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Every domain"
          subtitle={`All ${rows.length}, whether or not anybody has written them.`}
          expand={{ kind: 'whole' }}
        />
        <ul className={styles.list}>
          {rows.map(({ domain, record, state }) => (
            <li
              key={domain.id}
              className={styles.domain}
              data-domain={domain.id}
              data-plan-state={record === undefined ? 'no_record' : record.status.kind}
            >
              <div className={styles.row}>
                <div className={styles.rowAbout}>
                  <p className={styles.rowName}>{domain.name}</p>
                  <ResidentVoice record={record} />
                  {record === undefined || state === 'retired_unanswered' ? null : (
                    <div className={styles.rowSupport}>
                      <SupportLevelBadge level={record.supportLevel} />
                    </div>
                  )}
                </div>

                <div className={styles.rowState} data-state-cell>
                  {state === 'retired_unanswered' ? (
                    /* Plain, never hatched: the home does not keep this part of
                       the plan, so nothing here is a gap anybody can close. */
                    <p data-not-kept>
                      <Settled label="Not kept at this home" />
                    </p>
                  ) : record === undefined ? (
                    <Unrecorded
                      variant="chip"
                      label="No record for this domain"
                      detail="the plan does not hold this domain at all"
                    />
                  ) : (
                    <>
                      <DomainState timing={reviewTiming(record.status, now)} />
                      <DraftFact record={record} />
                      {versionCount(record) > 0 ? (
                        <p className={styles.rowMeta}>
                          Version <span data-numeric>{versionCount(record)}</span>
                        </p>
                      ) : null}
                      {state === 'retired_answered' ? (
                        <p className={styles.rowMeta} data-retired>
                          This home no longer keeps this part of the plan. What was
                          written stays.
                        </p>
                      ) : null}
                    </>
                  )}
                </div>
              </div>

              {state === 'retired_unanswered' ? null : (
                <DomainReading name={domain.name} record={record} />
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

/**
 * The first line of what this person said, beneath the domain name.
 *
 * **Their voice, from the signed version**, never from a draft: an unsigned
 * sentence is not what the plan says. It is also what the record's summary
 * holds for a signed domain. Where nothing has been signed the line is
 * **absent** rather than replaced by a placeholder: the state beside it already
 * says so, and a second grey line repeating it is volume drowning the
 * distinction.
 */
function ResidentVoice({ record }: { record: CarePlanDomainRecord | undefined }) {
  if (record === undefined) return null
  const version = currentVersion(record)
  if (version === 'none' || version.currentNeeds.trim() === '') return null

  return (
    <p className={styles.rowQuote} data-quote>
      &ldquo;{version.currentNeeds}&rdquo;
    </p>
  )
}

/**
 * Where the plan has got to. **An exhaustive switch, not a chain of ifs.**
 *
 * The chain's last branch is the fullest case, and the fullest case is the one
 * where everything is recorded, so a member that fell through would render as a
 * signed, in-date plan. `assertNever` makes a sixth timing a compile error.
 */
function DomainState({ timing }: { timing: ReviewTiming }) {
  const format = useSiteFormat()

  switch (timing.kind) {
    case 'not_started':
      return (
        <Unrecorded
          variant="chip"
          label="Never written"
          detail="nobody has written what this person needs here"
        />
      )

    case 'in_progress':
      // Started, nothing signed. Not the hatch: somebody has looked, and what
      // is missing is a signature rather than the work. The words say so.
      return (
        <span data-state-chip>
          <StatusPill
            tone="info"
            label="Draft in progress"
            detail={`${format.attributionOn(staffLabel(timing.updatedBy), timing.updatedAt)} · not signed`}
          />
        </span>
      )

    case 'overdue':
      return (
        <span data-state-chip>
          <StatusPill
            tone="critical"
            label="Review overdue"
            detail={`${formatLateness(timing.daysOverdue)} late · last signed ${format.date(timing.signed.on)} by ${staffLabel(timing.signed.by)}`}
          />
        </span>
      )

    case 'due_soon':
      /*
       * No chip. A recorded plan approaching a date is the least urgent of the
       * unsettled states and the one most likely to crowd the two that matter:
       * the signature is plain text and only the date takes the caution ink.
       */
      return (
        <p className={styles.settled} data-due-soon={timing.daysUntil}>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <span className={styles.settledDetail}>{staffLabel(timing.signed.by)}</span>
          <span className={styles.settledDueSoon}>
            review due <span data-numeric>{format.date(timing.dueOn)}</span>
          </span>
        </p>
      )

    case 'settled':
      // Recorded and unremarkable renders quietly. Ten green pills would drown
      // the rows that are the reason to open this tab.
      return (
        <p className={styles.settled} data-settled>
          Signed <span data-numeric>{format.date(timing.signed.on)}</span>
          <span className={styles.settledDetail}>
            {staffLabel(timing.signed.by)} · next review{' '}
            <span data-numeric>{format.date(timing.nextReviewOn)}</span>
          </span>
        </p>
      )

    default:
      return assertNever(timing)
  }
}

/**
 * A draft sitting on top of a signed plan, as its own fact.
 *
 * **Two facts, two treatments.** There is an instruction staff are following
 * today *and* somebody has started rewriting it and has not signed. Rendered as
 * one chip it becomes either "nothing is in force" or "this is settled", and
 * both are wrong in the direction that matters.
 *
 * Nothing renders where the draft is the only thing there: `in_progress`
 * already says it.
 */
function DraftFact({ record }: { record: CarePlanDomainRecord }) {
  const format = useSiteFormat()
  if (record.draft.kind !== 'draft') return null
  if (record.status.kind === 'in_progress') return null

  return (
    <span data-draft-over-signed>
      <StatusPill
        tone="info"
        label="Draft in progress"
        detail={`${format.attributionOn(staffLabel(record.draft.updatedBy), record.draft.updatedAt)} · not signed, and the signed version above is what staff follow`}
      />
    </span>
  )
}

/**
 * What the domain says, opened to be read.
 *
 * **Detail behind the disclosure, never status.** The row above already says
 * whether the domain is written, signed, late or drafted; this is the words
 * themselves, and the draft beside the signed version where there is one, so
 * a reader can see what is proposed and see that it is not what they follow.
 */
function DomainReading({
  name,
  record,
}: {
  name: string
  record: CarePlanDomainRecord | undefined
}) {
  const format = useSiteFormat()
  const version = record === undefined ? 'none' : currentVersion(record)
  const draft =
    record === undefined || record.draft.kind !== 'draft' ? undefined : record.draft

  if (version === 'none' && draft === undefined) {
    return (
      <p className={styles.rowMeta} data-not-written-note>
        This section of the care plan has not been written yet. Contact your manager.
      </p>
    )
  }

  return (
    <Accordion type="multiple" className={styles.reading}>
      <AccordionSection value="reading" title={`Read ${name}`}>
        <div className={styles.readingBody}>
          {version === 'none' ? null : (
            <section className={styles.version} data-signed-version>
              <h3 className={styles.versionTitle}>What staff follow</h3>
              <p className={styles.rowMeta}>
                Signed <span data-numeric>{format.date(version.finalisedOn)}</span> by{' '}
                {staffLabel(version.finalisedBy)}
              </p>
              <PlanText text={version} empty="Not written in the signed version" />
            </section>
          )}
          {draft === undefined ? null : (
            <section className={styles.version} data-draft-reading>
              <h3 className={styles.versionTitle}>Draft, not signed</h3>
              <p className={styles.rowMeta}>
                {format.attributionOn(staffLabel(draft.updatedBy), draft.updatedAt)}.
                Not what staff follow until a manager signs it.
              </p>
              <PlanText text={draft} empty="Not written in this draft" />
            </section>
          )}
        </div>
      </AccordionSection>
    </Accordion>
  )
}

/**
 * The three fields, each under the label that says whose words they are.
 *
 * A draft can hold an empty field, and a signed version should not, because
 * finalising refuses one. Either way an empty field is somebody not having
 * written it, so it takes the hatch rather than a blank that reads as "nothing
 * to say", and the words say which document it is missing from.
 */
function PlanText({ text, empty }: { text: CarePlanText; empty: string }) {
  return (
    <dl className={styles.fields}>
      {PLAN_FIELDS.map((field) => (
        <div key={field.id} className={styles.field} data-field={field.id}>
          <dt className={styles.fieldLabel}>{field.label}</dt>
          <dd className={styles.fieldText}>
            {text[field.id].trim() === '' ? (
              <Unrecorded variant="chip" label={empty} />
            ) : (
              text[field.id]
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
