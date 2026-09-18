import type { Goal, GoalProgressNote, IsoDateTime } from '@/data/types'
import { CARE_PLAN_DOMAINS } from '@/data/types'
import { useSiteFormat } from '@/app/session/use-session'
import { Settled, StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatDate, formatLateness, pluralise } from '@/lib/format'
import { goalStanding, targetStanding, type GoalStanding } from './goal-timing'
import styles from './goals.module.css'

/**
 * The parts a goal is drawn from, shared by the queue, the detail and the
 * resident's tab. CW PRD GOAL-01, GOAL-02.
 *
 * One place, because the statement's treatment is the module's whole argument:
 * **it is the largest thing on every screen it appears on, in the resident's
 * own words**. Three copies of that rule is three chances for one of them to
 * become a clinical paraphrase in a smaller size.
 */

const DOMAIN_NAME = new Map(CARE_PLAN_DOMAINS.map((entry) => [entry.id, entry.name]))

/** The resident speaking: what they want, and why it matters to them. */
export function GoalStatement({ goal, hero = false }: { goal: Goal; hero?: boolean }) {
  return (
    <>
      <p
        className={hero ? styles.heroStatement : styles.statement}
        data-goal-statement={goal.id}
      >
        &ldquo;{goal.statement}&rdquo;
      </p>
      <p className={styles.why}>&ldquo;{goal.whyItMatters}&rdquo;</p>
    </>
  )
}

/**
 * The domain it belongs to and the date it is aimed at — two facts, two tags.
 *
 * A goal with no target date can never be late, so "no date set" is drawn as
 * the gap it is and never as "not yet due".
 */
export function GoalMeta({ goal, now }: { goal: Goal; now: IsoDateTime }) {
  const format = useSiteFormat()
  const target = targetStanding(goal.target, now)

  return (
    <div className={styles.goalMeta}>
      {goal.domain.kind === 'domain' ? (
        <span className={styles.tag} data-domain={goal.domain.domainId}>
          {DOMAIN_NAME.get(goal.domain.domainId) ?? goal.domain.domainId}
        </span>
      ) : (
        <span data-unlinked>
          <Unrecorded variant="badge" label="No care plan domain" />
        </span>
      )}

      {target.kind === 'none' ? (
        <span data-no-target>
          <Unrecorded variant="badge" label="No target date set" />
        </span>
      ) : (
        <span
          className={target.kind === 'past' ? styles.datePast : styles.date}
          data-target={target.kind}
        >
          Target <span data-numeric>{format.date(target.on)}</span>
          {target.kind === 'past'
            ? ` · ${formatLateness(target.daysPast)} past`
            : ` · in ${formatLateness(target.daysUntil)}`}
        </span>
      )}
    </div>
  )
}

/**
 * Where the work has got to, derived from the progress notes.
 *
 * **Past its date with nothing said is hatched**: the wait is the gap, not a
 * finding, and nobody has recorded what happened. A closed goal is settled, and
 * **"the resident was not asked" is amber beside it** — a compliance finding
 * about how the decision was taken, which is a different thing from a record
 * nobody wrote.
 */
export function GoalStandingBadge({
  goal,
  notes,
  now,
}: {
  goal: Goal
  notes: GoalProgressNote[]
  now: IsoDateTime
}) {
  return <StandingBadge standing={goalStanding(goal, notes, now)} />
}

export function StandingBadge({ standing }: { standing: GoalStanding }) {
  const format = useSiteFormat()

  switch (standing.kind) {
    case 'past_target':
      return (
        <Unrecorded
          label="Nothing recorded"
          detail={
            standing.progress.kind === 'none'
              ? `nothing has ever been written about this goal, and it is ${formatLateness(standing.daysPast)} past its date`
              : `last note ${format.instantDate(standing.progress.at)}, nothing since, and ${formatLateness(standing.daysPast)} past its date`
          }
        />
      )
    case 'moving':
      return (
        <Settled
          label={`${pluralise(standing.progress.count, 'progress note')}`}
          detail={format.attribution(
            standing.progress.by.displayName,
            standing.progress.at,
          )}
        />
      )
    case 'nothing_yet':
      return (
        <Unrecorded
          label="No progress note yet"
          detail={`set ${formatLateness(standing.daysSinceSet)} ago`}
        />
      )
    case 'closed':
      return (
        <div className={styles.closedFacts}>
          <Settled
            label={CLOSED_WORDS[standing.outcome]}
            detail={`${standing.note} · ${standing.by.displayName}, ${formatDate(
              standing.on,
            )}`}
          />
          <ResidentViewBadge view={standing.residentView} />
        </div>
      )
    default:
      return assertNever(standing)
  }
}

const CLOSED_WORDS: Record<
  Extract<GoalStanding, { kind: 'closed' }>['outcome'],
  string
> = {
  achieved: 'Achieved',
  not_achieved: 'Not achieved',
  withdrawn_by_resident: 'Withdrawn by the resident',
  stopped_by_service: 'Stopped by the service',
}

/**
 * What the resident said about the decision to close their goal.
 *
 * **Not asked is amber, not hatched.** Somebody decided about this person's own
 * goal without putting it to them: that is a finding about how the decision was
 * taken, not a record nobody wrote. The hatch is for the second kind.
 *
 * A withdrawal has no badge at all: the withdrawal is the resident's view, and
 * asking what they thought of their own decision is incoherent.
 */
export function ResidentViewBadge({
  view,
}: {
  view: Extract<GoalStanding, { kind: 'closed' }>['residentView']
}) {
  if (view === 'not_applicable') return null
  switch (view.kind) {
    case 'agreed':
      return <Settled label="The resident agreed" />
    case 'disagreed':
      return (
        <StatusPill tone="caution" label="The resident disagreed" detail={view.note} />
      )
    case 'not_asked':
      return (
        <StatusPill
          tone="caution"
          label="The resident was not asked"
          detail="somebody decided about their goal without putting it to them"
        />
      )
    default:
      return assertNever(view)
  }
}
