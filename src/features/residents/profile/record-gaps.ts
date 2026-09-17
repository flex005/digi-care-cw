import type { AnyConsent, Resident } from '@/data/types'
import { CONSENT_TYPES, RISK_ASSESSMENT_TEMPLATES } from '@/data/types'
import { configuredState, countsTowardsExpected } from '@/data/access/site-config-store'

/**
 * The gaps a tab's name carries, and the counts its own lead line states.
 *
 * **One owner for both.** The tab reading "Consent · 3 of 8 never sought" and
 * the Consent tab's lead reading "3 of 8 consents have never been sought" are
 * one fact, and two computations of it would disagree the first time either was
 * touched.
 *
 * **Counted over what this home asks.** A template or consent type the home has
 * stopped asking is not a gap anybody here can close, so it leaves the
 * denominator, as it does on the tabs themselves.
 */
export function riskAssessmentGaps(resident: Resident): {
  asked: number
  neverAssessed: number
  overdue: number
} {
  const asked = RISK_ASSESSMENT_TEMPLATES.map((template) => ({
    status: resident.risks[template.id],
    state: configuredState(
      resident.siteId,
      template.id,
      resident.risks[template.id].kind === 'assessed',
    ),
  })).filter((row) => countsTowardsExpected(row.state))
  return {
    asked: asked.length,
    neverAssessed: asked.filter((row) => row.status.kind === 'not_assessed').length,
    overdue: asked.filter(
      (row) =>
        row.status.kind === 'assessed' && row.status.reviewState.kind === 'overdue',
    ).length,
  }
}

export function consentGaps(resident: Resident): {
  asked: number
  neverSought: number
} {
  const asked = CONSENT_TYPES.map((type) => {
    const status = resident.consents[type.id] as AnyConsent
    return {
      status,
      state: configuredState(resident.siteId, type.id, status.kind !== 'not_sought'),
    }
  }).filter((row) => countsTowardsExpected(row.state))
  return {
    asked: asked.length,
    neverSought: asked.filter((row) => row.status.kind === 'not_sought').length,
  }
}

/**
 * What a tab's name says beside it. RES-03's amber dot, in words.
 *
 * **Words rather than a dot**, because a dot is colour alone: "Consent · 3 of 8
 * never sought" says in greyscale what the dot says in colour, and says which
 * gap. A `gap` is something nobody has recorded and takes the hatch; a
 * `finding` is something recorded and late, and takes the caution ink.
 *
 * The three tabs the PRD marks, and no others: a mark the PRD did not ask for
 * would be this build deciding what counts as a tab's problem.
 */
export type TabNote =
  { kind: 'gap'; words: string } | { kind: 'finding'; words: string }

export function generalInformationNotes(resident: Resident): TabNote[] {
  return resident.gp.kind === 'unrecorded'
    ? [{ kind: 'gap', words: 'GP not recorded' }]
    : []
}

export function riskAssessmentNotes(resident: Resident): TabNote[] {
  const gaps = riskAssessmentGaps(resident)
  return [
    ...(gaps.neverAssessed > 0
      ? [
          {
            kind: 'gap' as const,
            words: `${gaps.neverAssessed} of ${gaps.asked} never done`,
          },
        ]
      : []),
    ...(gaps.overdue > 0
      ? [
          {
            kind: 'finding' as const,
            words: `${gaps.overdue} of ${gaps.asked} overdue`,
          },
        ]
      : []),
  ]
}

export function consentNotes(resident: Resident): TabNote[] {
  const gaps = consentGaps(resident)
  return gaps.neverSought > 0
    ? [{ kind: 'gap', words: `${gaps.neverSought} of ${gaps.asked} never sought` }]
    : []
}
