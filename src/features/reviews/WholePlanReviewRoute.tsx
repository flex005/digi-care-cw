import { useCallback, useId, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import type {
  CarePlanDomainId,
  CompletedAgainst,
  IsoDate,
  IsoDateTime,
  Resident,
} from '@/data/types'
import { getResident, recordWholePlanReview } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  ActLine,
  Button,
  Card,
  CardHead,
  EmptyState,
  buttonClassName,
} from '@/components/primitives'
import { NotYourHome, Settled, Unrecorded } from '@/components/status'
import { formatDate, pluralise, zonedDate } from '@/lib/format'
import { nextReviewFrom } from '@/lib/review-interval'
import { SubjectStrip } from '@/features/notes/composer/SubjectStrip'
import { domainRows, gapWords, isGap } from './review-queue'
import styles from './reviews.module.css'

/** Said at the act: a completed review is told to nobody in this build. */
export const NOTHING_SENT_LINE =
  'Nothing is sent: no manager is told, and no family sees that a review happened.'

/** Said where the discussion is written, because the record holds no field for it. */
export const DISCUSSION_LINE =
  'What was discussed is not kept: the review record both products share holds who completed it, when, what it was against, and which domains were outstanding — and no account of the meeting. Adding a field for one is a change to their shared data.'

/**
 * The whole care plan review — the meeting, not the plan. Table 3: "Reviews —
 * conduct", senior carers, and the CW PRD draws no screen for it.
 *
 * The sentence: **this is the plan as it stands, and completing this records
 * which parts of it were still gaps.**
 *
 * **It can be completed while domains are gaps, and the record carries which
 * ones** — the handover signature's shape exactly. Refusing would mean the
 * meeting happened and nothing holds evidence of it, and a review meeting
 * happens *because* there are gaps; permitting it silently would let "care plan
 * reviewed" sit over three domains nobody has written.
 *
 * **It writes nothing about the plan itself.** Writing a domain is a manager's
 * act, and two screens that can both write one domain is two ways to do one
 * thing.
 */
export function WholePlanReviewRoute() {
  const { activeSite } = useSession()
  const params = useParams<{ residentId: string }>()
  const residentId = params.residentId as Resident['id']
  const [written, setWritten] = useState(0)
  const [done, setDone] = useState('')

  const load = useCallback(() => getResident(residentId), [residentId])
  const resource = useResource<Resident>(load, [residentId, written])

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        <Card>
          <p className={styles.status} role="status">
            Loading the care plan…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        <Card>
          <EmptyState
            title="The care plan could not be loaded"
            body="Nothing has been lost: nothing was recorded."
            actions={
              <Link
                href={`/residents/${residentId}/care-plan`}
                className={buttonClassName({ variant: 'secondary' })}
              >
                Back to the care plan
              </Link>
            }
          />
        </Card>
      </div>
    )

  return (
    <Review
      resident={resource.data}
      site={activeSite}
      done={done}
      onRecorded={(words) => {
        setDone(words)
        setWritten((count) => count + 1)
      }}
    />
  )
}

function Review({
  resident,
  site,
  done,
  onRecorded,
}: {
  resident: Resident
  site: ReturnType<typeof useSession>['activeSite']
  done: string
  onRecorded: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()
  const id = useId()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const [discussion, setDiscussion] = useState('')
  const [error, setError] = useState('')

  const answer = viewer.ask('conduct_review', resident.id)
  const rows = domainRows(resident)
  const outstanding = rows.filter((row) => isGap(row.record))
  const state = resident.carePlanReview
  const against: CompletedAgainst =
    state.kind === 'scheduled' || state.kind === 'due' || state.kind === 'overdue'
      ? { kind: 'due_on', dueOn: state.dueOn }
      : { kind: 'never_scheduled' }
  const today = zonedDate(at, site.timeZone)
  const nextDueOn: IsoDate = nextReviewFrom(at)

  const complete = () => {
    recordWholePlanReview({
      residentId: resident.id,
      by: member.ref,
      on: today,
      nextDueOn,
      against,
      outstanding: outstanding.map((row) => row.domain.id as CarePlanDomainId),
    })
      .then(() => {
        setError('')
        onRecorded(
          `Whole care plan review recorded for ${resident.fullLegalName} on ${formatDate(today)}, carrying ${
            outstanding.length === 0
              ? 'nothing outstanding'
              : pluralise(outstanding.length, 'outstanding domain')
          }. The next falls due ${formatDate(nextDueOn)}, and nothing was sent.`,
        )
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.'),
      )
  }

  return (
    <div className={styles.page}>
      <PageHead
        title={`Whole care plan review: ${resident.fullLegalName}`}
        lines={[site.name, 'senior carers conduct a review']}
        action={
          <Link
            href={`/residents/${resident.id}/care-plan`}
            className={buttonClassName({ variant: 'secondary' })}
          >
            Back to the care plan
          </Link>
        }
      />

      <Card>
        <SubjectStrip resident={resident} site={site} />
      </Card>

      {done === '' ? null : (
        <p className={styles.done} role="status" data-review-done>
          {done}
        </p>
      )}

      <Card>
        <CardHead
          title="The plan as it stands"
          subtitle="Every domain this home keeps, whether or not anybody has written it. Nothing here is edited: that is the plan's own screen."
          expand={{ kind: 'link', href: `/residents/${resident.id}/care-plan` }}
        />
        <ul className={styles.domains}>
          {rows.map(({ domain, record }) => (
            <li key={domain.id} className={styles.domain} data-domain={domain.id}>
              <p className={styles.domainName}>{domain.name}</p>
              {isGap(record) ? (
                <Unrecorded variant="chip" label={gapWords(record)} />
              ) : (
                <Settled label="In date" detail={gapWords(record)} />
              )}
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHead
          title="What was discussed"
          subtitle="Who was there, what was agreed, what changes."
          expand={{ kind: 'whole' }}
        />
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}-discussion`}>
            What was discussed
          </label>
          <textarea
            id={`${id}-discussion`}
            className={styles.textarea}
            rows={4}
            value={discussion}
            onChange={(event) => setDiscussion(event.target.value)}
            data-discussion
          />
          <ActLine kind="not_built">{DISCUSSION_LINE}</ActLine>
        </div>
      </Card>

      <Card>
        <div className={styles.foot}>
          {outstanding.length === 0 ? (
            <p className={styles.footState} data-outstanding="0">
              <strong>Every domain is written and in date.</strong> Completing this
              records a review with nothing outstanding.
            </p>
          ) : (
            <div className={styles.willStore} data-will-store={outstanding.length}>
              <p className={styles.footState}>
                <strong>
                  Completing this records that {pluralise(outstanding.length, 'domain')}{' '}
                  {outstanding.length === 1 ? 'was a gap' : 'were gaps'} at the time.
                </strong>{' '}
                You can complete a review with parts of the plan unwritten; the record
                carries what was outstanding when you signed it, so it can never later
                read as a review of a complete plan.
              </p>
              <ul className={styles.willStoreList}>
                {outstanding.map(({ domain, record }) => (
                  <li key={domain.id} data-outstanding-domain={domain.id}>
                    {domain.name}, {gapWords(record)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className={styles.footState}>
            The next review falls due <span data-numeric>{format.date(nextDueOn)}</span>
            , and that becomes the date every screen reads.
          </p>

          <ActLine kind="not_performed">{NOTHING_SENT_LINE}</ActLine>

          {answer.kind === 'yes' ? (
            <Button size="large" onClick={complete} data-complete-review>
              {`Complete the review for ${resident.preferredName}`}
            </Button>
          ) : (
            <ActPoint
              answer={answer}
              label="Complete the review"
              notBuilt="Completing a review is not built."
              residentName={resident.preferredName}
            />
          )}

          {error === '' ? null : (
            <p className={styles.formError} role="alert">
              {error}
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}
