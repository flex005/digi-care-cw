import { useCallback, useState } from 'react'
import Link from 'next/link'
import type { Resident, RiskTemplateId } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { notOnYourListLine } from '@/app/session/resident-scope'
import { ActionCard } from '@/components/layout/ActionCard'
import { ActPoint } from '@/components/layout/ActPoint'
import { PageHead } from '@/components/layout/PageHead'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  Select,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NotYourHome, Settled, StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatCount, formatDate, formatLateness, pluralise } from '@/lib/format'
import { PlaceholderBanner } from './PlaceholderBanner'
import {
  NEVER_ASSESSED_IS_NOT_LOW_RISK,
  RISK_VIEWS,
  countBy,
  inReadingOrder,
  ofView,
  rowsFor,
  type RiskRow,
  type RiskStanding,
  type RiskView,
} from './risk-list'
import styles from './risk-list.module.css'

/** What the screen counts over, said once. */
export const COUNTED_LINE =
  'Every resident at this home against every template the home uses, whether or not anybody has opened one.'

/**
 * Which risk assessments the home has never done. CW PRD RA-01.
 *
 * The sentence: **nobody has looked at these risks.**
 *
 * **A row is a template against a resident, not an assessment**, so the list
 * cannot shrink to the work that has been done. Never assessed is the default
 * tab and the dark card, because it is the finding — and because *never
 * assessed is not low risk*, which is RA-01's own copy and has to appear on the
 * page.
 *
 * **Reach is the whole home**, which is Table 3's rule for this screen rather
 * than the per-resident pattern: a care worker is meant to be aware of
 * unassessed risks at the home they are working in. What their list does decide
 * is whether they can open the record behind a row, and where it does not, the
 * row says so as scope rather than going missing.
 */
export function RiskListRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [view, setView] = useState<RiskView>('never_assessed')
  const [template, setTemplate] = useState<RiskTemplateId | 'any'>('any')

  const load = useCallback(() => getResidentsBySite(activeSite.id), [activeSite.id])
  const resource = useResource<Resident[]>(load, [activeSite.id])

  const head = (
    <PageHead
      title="Risk assessments"
      lines={[activeSite.name, 'never assessed first, then longest overdue']}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading the risk assessments…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <EmptyState
            title="The risk assessments could not be loaded"
            body="Nothing has been lost: this is a read."
            actions={
              <Button variant="secondary" onClick={resource.retry}>
                Try again
              </Button>
            }
          />
        </Card>
      </div>
    )

  const residents = resource.data
  const all = rowsFor(residents)
  const counts = countBy(all)
  const byTemplate =
    template === 'any' ? all : all.filter((row) => row.templateId === template)
  const shown = inReadingOrder(ofView(byTemplate, view))
  const scoreAnswer = viewer.ask('score_risk_assessment')

  return (
    <div className={styles.page}>
      {head}

      <PlaceholderBanner />

      <ActionCard
        gap
        kicker="Risks that have never been assessed"
        figure={formatCount(counts.never_assessed)}
        of={`of ${formatCount(all.length)} assessments this home is expected to hold`}
        detail={
          <div className={styles.bannerDetail} data-risk-banner>
            <p>
              Across {pluralise(residents.length, 'resident')} and{' '}
              {pluralise(RISK_ASSESSMENT_TEMPLATES.length, 'template')} at{' '}
              {activeSite.name}. <b>{NEVER_ASSESSED_IS_NOT_LOW_RISK}</b>
            </p>
            <p>{COUNTED_LINE}</p>
          </div>
        }
        footLabel="Read in this order"
        footValue="Never assessed first"
        action={
          /* No button while they are already the view: Never assessed is the
             default tab, and a control that does nothing when pressed looks
             reachable and is not. */
          counts.never_assessed === 0 ? (
            <span className={styles.bannerQuiet}>
              Every template this home uses has been assessed for everybody
            </span>
          ) : view === 'never_assessed' && template === 'any' ? (
            <span className={styles.bannerQuiet} data-already-shown>
              Listed below, never assessed first
            </span>
          ) : (
            <button
              type="button"
              className={buttonClassName({ variant: 'secondary' })}
              onClick={() => {
                setView('never_assessed')
                setTemplate('any')
              }}
              data-show-never-assessed
            >
              Show the {counts.never_assessed} never assessed
            </button>
          )
        }
      />

      <Card>
        <CardHead
          title="Past their review date"
          subtitle="Assessed once and not since."
          expand={{ kind: 'whole' }}
        />
        <p className={styles.figure} data-review-figure>
          <span className={styles.figureNumber} data-numeric>
            {formatCount(counts.review_overdue)}
          </span>{' '}
          of {formatCount(all.length)} expected assessments at {activeSite.name}
        </p>
        {/* Assessed with nobody deciding when the next review is due. It has
            passed no date, so it belongs under no "overdue" tab — and it is
            named here rather than left for a reader to find in All. */}
        {counts.no_review_date > 0 ? (
          <div className={styles.aside} data-no-review-date>
            <Unrecorded
              variant="chip"
              label={`${formatCount(counts.no_review_date)} with no review date`}
            />
            <p className={styles.asideLine}>
              Assessed, and nobody has decided when the next review is due. They have
              passed no date, so they are in All and in no other tab.
            </p>
          </div>
        ) : null}
      </Card>

      {scoreAnswer.kind === 'yes' ? null : (
        <Card>
          <CardHead
            title="Scoring an assessment"
            subtitle="Who may score a risk assessment, and record that they did."
            expand={{ kind: 'whole' }}
          />
          {/* Once, at the head. A refusal repeated down 252 rows is the same
              refusal 252 times, and it would bury what the rows are for. */}
          <div className={styles.acts}>
            <ActPoint
              answer={scoreAnswer}
              label="Score now"
              notBuilt="Scoring is not built."
            />
          </div>
        </Card>
      )}

      <Card>
        <CardHead
          title="Assessments"
          subtitle={COUNTED_LINE}
          expand={{ kind: 'whole' }}
        />

        <div className={styles.pills} role="group" aria-label="Which assessments">
          {RISK_VIEWS.map((entry) => {
            const chosen = entry.id === view
            const count =
              entry.id === 'all'
                ? byTemplate.length
                : ofView(byTemplate, entry.id).length
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => setView(entry.id)}
                data-risk-view={entry.id}
              >
                <SelectedMark selected={chosen} />
                <span data-numeric>
                  {entry.label} · {formatCount(count)}
                </span>
              </button>
            )
          })}
        </div>

        <div className={styles.filter}>
          <Select
            label="Template"
            placeholder="Any template"
            value={template}
            onValueChange={(next) => setTemplate(next as RiskTemplateId | 'any')}
            options={[
              { value: 'any', label: 'Any template' },
              ...RISK_ASSESSMENT_TEMPLATES.map((entry) => ({
                value: entry.id,
                label: entry.name,
              })),
            ]}
          />
        </div>

        <p className={styles.claim} data-risk-claim>
          <span data-numeric>
            {shown.length} of {all.length}
          </span>{' '}
          shown
          {template === 'any' ? '' : ', one template only'}
        </p>

        {shown.length === 0 ? (
          <p className={styles.empty}>Nothing in this view is waiting.</p>
        ) : (
          <Rows rows={shown} viewer={viewer} canScore={scoreAnswer.kind === 'yes'} />
        )}
      </Card>
    </div>
  )
}

/**
 * The rows, a page at a time.
 *
 * **Its own component so the paging hook can live beside the rows it pages**,
 * below the route's early returns for loading, error and a home that is not
 * the viewer's. A hook above those would run on every one of them; a hook
 * below them would not run at all on some.
 *
 * `Pager` says which slice of what, so the count above the list and the rows
 * under it cannot disagree about how many there are.
 */
function Rows({
  rows,
  viewer,
  canScore,
}: {
  rows: RiskRow[]
  viewer: ReturnType<typeof useViewer>
  canScore: boolean
}) {
  const paged = usePaged(rows)
  return (
    <>
      <ul className={styles.rows}>
        {paged.shown.map((row) => (
          <Row
            key={`${row.resident.id}:${row.templateId}`}
            row={row}
            canScore={canScore}
            canOpen={viewer.ask('open_resident_record', row.resident.id).kind === 'yes'}
          />
        ))}
      </ul>
      <Pager paged={paged} total={rows.length} noun="assessments" />
    </>
  )
}

function Row({
  row,
  canScore,
  canOpen,
}: {
  row: RiskRow
  canScore: boolean
  canOpen: boolean
}) {
  const { resident, templateId, templateName, standing } = row
  const href = `/residents/${resident.id}/risk-assessments/${templateId}`
  return (
    <li
      className={styles.row}
      data-risk-row={`${resident.id}:${templateId}`}
      data-standing={standing.kind}
    >
      <div className={styles.rowWho}>
        <p className={styles.rowName}>{resident.fullLegalName}</p>
        <p className={styles.rowMeta}>
          {resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'}
        </p>
      </div>
      <div className={styles.rowWhat}>
        <p className={styles.rowTitle}>{templateName}</p>
      </div>
      <div className={styles.rowState}>
        <Standing standing={standing} />
      </div>
      <div className={styles.rowAct}>
        {canOpen ? (
          canScore ? (
            <Link
              href={href}
              className={buttonClassName({ variant: 'secondary' })}
              data-score-now={`${resident.id}:${templateId}`}
            >
              Score now
            </Link>
          ) : (
            <Link
              href={href}
              className={buttonClassName({ variant: 'ghost' })}
              data-open-assessment={`${resident.id}:${templateId}`}
            >
              Read it
            </Link>
          )
        ) : (
          /* Scope, never blame: the record exists and this reader's list does
             not reach it. The row stays, because the home's gap is the home's
             whether or not this person was given that resident. */
          <p className={styles.notYours} data-not-on-your-list>
            {notOnYourListLine(resident.preferredName)}
          </p>
        )}
      </div>
    </li>
  )
}

function Standing({ standing }: { standing: RiskStanding }) {
  switch (standing.kind) {
    case 'never_assessed':
      return (
        <Unrecorded
          variant="badge"
          label="Never assessed"
          detail="nobody has looked at this risk"
        />
      )
    case 'review_overdue':
      return (
        <StatusPill
          tone="critical"
          label={`Review ${formatLateness(standing.daysOverdue)} overdue`}
          detail={`Was due ${formatDate(standing.dueOn)}`}
        />
      )
    case 'review_due':
      return (
        <StatusPill
          tone="caution"
          label="Review due"
          detail={`Due ${formatDate(standing.dueOn)}`}
        />
      )
    case 'no_review_date':
      return (
        <Unrecorded
          variant="badge"
          label="No review date"
          detail="nobody has decided when the next one is due"
        />
      )
    case 'in_date':
      return <Settled label="Assessed" detail="review in date" />
    default:
      return assertNever(standing)
  }
}
