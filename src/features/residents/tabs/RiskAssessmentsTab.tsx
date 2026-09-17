import type { RiskStatus } from '@/data/types'
import { RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { type ConfiguredState, configuredState } from '@/data/access/site-config-store'
import { staffLabel } from '@/data/access/team-store'
import { Card, CardHead } from '@/components/primitives'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { assertNever } from '@/lib/assert-never'
import { formatCount, formatLateness } from '@/lib/format'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { riskAssessmentGaps } from '@/features/residents/profile/record-gaps'
import { PlaceholderBanner } from '@/features/risk/PlaceholderBanner'
import { LEVEL_LABEL, isScored } from '@/features/risk/instrument'
import { scoreText } from '@/features/risk/score'
import styles from './risk-and-plan.module.css'

/**
 * A resident's risk assessments, read-only. RA-01, on the profile.
 *
 * The sentence: **these risks have never been assessed for this person.**
 *
 * **Every template always renders**, iterated from the template constant and
 * never from the resident's record. A list of only the completed assessments
 * would read as a complete picture, and completing one cannot remove a row,
 * because the row is the template rather than the assessment.
 *
 * Never assessed carries **"No level"** in the hatch. Not blank, and never
 * "low" by default: a risk nobody has looked at is not a low risk, and the
 * cheapest way to make a home look safe is to default the unknown to fine.
 *
 * **Nobody scores from here.** Scoring is one act drawn at the head of the tab,
 * asked of the role table, rather than a button on every row: a care worker
 * sees why they cannot, and a senior carer sees that the form is not built yet.
 */
export function RiskAssessmentsTab() {
  const { resident, site } = useOpenRecord()
  const viewer = useViewer()

  /*
   * **Every template, and what the home decided about it.** The two together
   * are what a row means: an unassessed template this home uses is a gap
   * somebody can close, and an unassessed one it does not use is a question
   * nobody here asks.
   */
  const rows = RISK_ASSESSMENT_TEMPLATES.map((template) => {
    const status = resident.risks[template.id]
    return {
      template,
      status,
      state: configuredState(resident.siteId, template.id, status.kind === 'assessed'),
    }
  })

  /*
   * **The same owner as the tab's name.** The strip above reads "4 of 9 never
   * done" from this function, and a second count here would disagree with it
   * the first time either was touched. Counted over what this home asks: a
   * retired template is not a gap anybody here can close.
   */
  const gaps = riskAssessmentGaps(resident)
  const retired = rows.length - gaps.asked

  return (
    <div className={styles.tab} data-tab-body="risk-assessments">
      <Card>
        <CardHead
          title={`${resident.preferredName}’s risk assessments`}
          subtitle={
            retired > 0
              ? `Counted over the ${gaps.asked} of ${rows.length} templates ${site.name} carries out.`
              : `Counted over the ${gaps.asked} templates ${site.name} carries out.`
          }
          expand={{ kind: 'not_built' }}
        />
        <div className={styles.figures}>
          <div
            className={gaps.neverAssessed > 0 ? styles.leadGap : styles.leadPlain}
            data-never-assessed={gaps.neverAssessed}
          >
            <span className={styles.leadFigure} data-numeric>
              {formatCount(gaps.neverAssessed)}
            </span>
            <span className={styles.leadBody}>
              <span className={styles.leadTitle}>
                of <span data-numeric>{formatCount(gaps.asked)}</span> risks have never
                been assessed for {resident.preferredName}
              </span>
              <span className={styles.leadDetail}>Never assessed is not low risk.</span>
            </span>
          </div>
          {/* A finding, not a gap: assessed once and not looked at since. Kept
              beside the gap and never summed with it, because the two ask for
              different work. */}
          <p
            className={gaps.overdue > 0 ? styles.figureFinding : styles.figurePlain}
            data-overdue={gaps.overdue}
          >
            <span className={styles.figureValue} data-numeric>
              {formatCount(gaps.overdue)}
            </span>{' '}
            of <span data-numeric>{formatCount(gaps.asked)}</span> past their review
            date
          </p>
        </div>
        {retired > 0 ? (
          <p className={styles.note} data-retired-note>
            {formatCount(retired)} of the {formatCount(rows.length)} templates are not
            carried out at {site.name} and are not counted above; anything already
            recorded against them is still below.
          </p>
        ) : null}
        <div className={styles.act}>
          <ActPoint
            answer={viewer.ask('score_risk_assessment', resident.id)}
            label="Score an assessment"
            notBuilt="Scoring is built in Phase 8, senior carer records."
            residentName={resident.preferredName}
          />
        </div>
      </Card>

      <Card>
        <CardHead
          title="Every template"
          subtitle={`All ${rows.length}, whether or not anybody has assessed them.`}
          expand={{ kind: 'not_built' }}
        />
        <div className={styles.banner}>
          <PlaceholderBanner />
        </div>
        <ul className={styles.list}>
          {rows.map(({ template, status, state }) => (
            <li
              key={template.id}
              className={styles.row}
              data-template={template.id}
              data-assessed={status.kind}
              data-configured={state}
            >
              <div className={styles.rowAbout}>
                <p className={styles.rowName}>{template.name}</p>
                <p className={styles.rowMeta}>
                  {isScored(template.id)
                    ? 'Placeholder scored instrument'
                    : 'Unscored: findings recorded'}
                </p>
              </div>
              <StateCell status={status} state={state} />
              <LevelCell status={status} state={state} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function StateCell({ status, state }: { status: RiskStatus; state: ConfiguredState }) {
  /*
   * **Plain, never hatched.** The home does not carry this assessment out and
   * nobody has done one: that is not a gap somebody can close, it is a question
   * nobody here asks. The hatch says nobody has looked, and it would be inviting
   * somebody to answer a question the home has decided not to ask.
   */
  if (state === 'retired_unanswered') {
    return (
      <div className={styles.rowState} data-not-carried-out>
        <Settled label="Not carried out at this home" />
      </div>
    )
  }

  if (status.kind === 'not_assessed') {
    return (
      <div className={styles.rowState}>
        <Unrecorded
          variant="chip"
          label="Never assessed"
          detail="nobody has looked at this risk"
        />
      </div>
    )
  }

  /*
   * **A record on a retired template keeps everything it had, quietly.**
   * Somebody did this assessment, with their name and the date on it, and the
   * home deciding later that it no longer carries this one out does not make
   * that untrue. Hiding it would delete work; the line says why nobody is being
   * asked to redo it.
   */
  return (
    <div className={styles.rowState}>
      <ReviewState status={status} />
      {state === 'retired_answered' ? (
        <p className={styles.rowMeta} data-retired>
          This home no longer carries this assessment out. The record stays.
        </p>
      ) : null}
    </div>
  )
}

/**
 * Where the review has got to. **An exhaustive switch, not a chain of ifs.**
 *
 * Written as if-chains ending in a shared return, two of `ReviewState`'s five
 * members fell into it: a `completed` assessment and one `never_scheduled` both
 * rendered as in date. The fall-through returned something plausible, so it was
 * not a type error and did not look like a bug. `assertNever` makes a sixth
 * member a compile error rather than a reassuring default.
 *
 * Every branch names who assessed and when: a level with no author is a claim
 * nobody can check.
 */
function ReviewState({
  status,
}: {
  status: Extract<RiskStatus, { kind: 'assessed' }>
}) {
  const format = useSiteFormat()
  const assessedOn = format.instantDate(status.assessedAt)
  const by = staffLabel(status.assessedBy)

  switch (status.reviewState.kind) {
    case 'overdue':
      return (
        <StatusPill
          tone="critical"
          label="Review overdue"
          detail={`${formatLateness(status.reviewState.daysOverdue)} late · last assessed ${assessedOn} by ${by}`}
        />
      )

    case 'due':
      return (
        <StatusPill
          tone="caution"
          label="Review due"
          detail={`due ${format.date(status.reviewState.dueOn)} · assessed ${assessedOn} by ${by}`}
        />
      )

    case 'never_scheduled':
      // Assessed, and nobody set a date to look again. Two facts: the
      // assessment, quietly, and the gap beside it.
      return (
        <>
          <Settled label={`Assessed ${assessedOn}`} detail={by} />
          <Unrecorded
            variant="chip"
            label="No review scheduled"
            detail="nobody has set a date to look at this again"
          />
        </>
      )

    case 'scheduled':
    case 'completed': {
      // Recorded and unremarkable renders quietly: nine green pills would drown
      // the rows that are gaps.
      const next =
        status.reviewState.kind === 'completed'
          ? status.reviewState.nextDueOn
          : status.reviewState.dueOn
      return (
        <Settled
          label={`Assessed ${assessedOn}`}
          detail={`${by} · next ${format.date(next)}`}
        />
      )
    }

    default:
      return assertNever(status.reviewState)
  }
}

function LevelCell({ status, state }: { status: RiskStatus; state: ConfiguredState }) {
  /*
   * **Nothing, where the home does not ask the question.** The state beside it
   * already says the assessment is not carried out here, and a hatched "No
   * level" next to that would turn a retired template back into a gap.
   */
  if (state === 'retired_unanswered') return null

  if (status.kind === 'not_assessed') {
    // No detail line: the state beside it already says nobody has looked, and
    // two hatched chips explaining one fact is volume drowning a distinction.
    return (
      <div className={styles.rowLevel}>
        <Unrecorded variant="chip" label="No level" />
      </div>
    )
  }

  return (
    <div className={styles.rowLevel}>
      <StatusPill
        tone={LEVEL_TONE[status.level]}
        label={
          status.score.kind === 'scored'
            ? `${LEVEL_LABEL[status.level]} · ${status.score.value}`
            : LEVEL_LABEL[status.level]
        }
      />
      {status.score.kind === 'unscored' ? (
        <p className={styles.rowMeta}>{scoreText(status.score)}</p>
      ) : null}
    </div>
  )
}

const LEVEL_TONE = {
  low: 'positive',
  moderate: 'caution',
  high: 'critical',
} as const satisfies Record<string, 'positive' | 'caution' | 'critical'>
