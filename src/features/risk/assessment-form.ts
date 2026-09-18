import type { RiskLevel, RiskTemplateId } from '@/data/types'
import { INSTRUMENT_ITEMS, bandFor, isScored } from './instrument'

/**
 * Scoring a risk assessment, as arithmetic. CW PRD RA-02.
 *
 * Pure, and exported on its own, because the rule is the thing under test: a
 * running total that only exists inside a component is a total nobody can
 * check.
 */

/** One item's answer: the index of a choice, or the fact that nobody answered. */
export type ItemAnswer = number | 'not_answered'

export type Answers = Record<string, ItemAnswer>

export interface RunningScore {
  /** The total of the items answered so far. Never presented as final. */
  total: number
  answered: number
  items: number
  /** The band the total falls in. Meaningless until every item is answered. */
  band: RiskLevel
  complete: boolean
}

/**
 * The running score, as RA-02 draws it.
 *
 * **It is a total of what has been answered, and the card says so**: "0 of 6
 * items answered. The score is not final until every item has an answer." A
 * partial total that looked final would be the worst kind of figure — a
 * clinical band read off an incomplete instrument.
 */
export function runningScore(answers: Answers): RunningScore {
  let total = 0
  let answered = 0
  for (const item of INSTRUMENT_ITEMS) {
    const answer = answers[item.id] ?? 'not_answered'
    if (answer === 'not_answered') continue
    const choice = item.choices[answer]
    if (choice === undefined) continue
    total += choice.points
    answered += 1
  }
  return {
    total,
    answered,
    items: INSTRUMENT_ITEMS.length,
    band: bandFor(total),
    complete: answered === INSTRUMENT_ITEMS.length,
  }
}

/** The items nobody has answered, named rather than counted. */
export function unanswered(answers: Answers): string[] {
  return INSTRUMENT_ITEMS.filter(
    (item) => (answers[item.id] ?? 'not_answered') === 'not_answered',
  ).map((item) => item.question)
}

/**
 * What stands between the form and a signature.
 *
 * **An unscored template has no items to answer**, so the instrument does not
 * hold it up; what it needs is the level somebody judged. Both are named, never
 * counted.
 */
export function outstanding(input: {
  templateId: RiskTemplateId
  answers: Answers
  level: RiskLevel | 'not_chosen'
}): string[] {
  const waiting: string[] = []
  if (isScored(input.templateId)) {
    const missing = unanswered(input.answers)
    if (missing.length > 0)
      waiting.push(
        `an answer to ${missing.length === 1 ? 'one factor' : `${missing.length} factors`}`,
      )
  } else if (input.level === 'not_chosen') {
    waiting.push('the level this assessment reaches')
  }
  return waiting
}

/**
 * The level a completed form records.
 *
 * On a scored template it is the band the instrument reached — never
 * somebody's separate opinion, or the score and the level could disagree. On
 * an unscored one it is the judgement, because there is no arithmetic to
 * derive it from.
 */
export function levelFor(
  templateId: RiskTemplateId,
  answers: Answers,
  chosen: RiskLevel | 'not_chosen',
): RiskLevel | 'not_chosen' {
  return isScored(templateId) ? runningScore(answers).band : chosen
}

/**
 * One intervention somebody wrote against this assessment.
 *
 * **Drawn, and nowhere to keep it**: `RiskStatus` holds a level, a score, an
 * author and a review date, and nothing about what anybody decided to do. The
 * form asks for them because RA-02 does, and says at the act that they are not
 * kept — adding a field for them is a change to data both products share.
 */
export interface Intervention {
  what: string
  who: string
  reviewOn: string
}

export const EMPTY_INTERVENTION: Intervention = { what: '', who: '', reviewOn: '' }

/** Interventions with something in them, for the count the screen states. */
export const writtenInterventions = (entries: Intervention[]): Intervention[] =>
  entries.filter((entry) => entry.what.trim() !== '')
