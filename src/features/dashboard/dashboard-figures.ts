import type {
  CareNote,
  Incident,
  IsoDateTime,
  Medication,
  Resident,
  ResidentId,
} from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import {
  carePlanGaps,
  consentGaps,
  riskAssessmentGaps,
} from '@/features/residents/profile/record-gaps'

/**
 * Every figure on the dashboard, worked out before anything renders it. CW PRD
 * DASH-01.
 *
 * Pure, and every instant passed in, so a test asserts the arithmetic rather
 * than the hour the suite runs.
 *
 * **Nothing here is a new record.** Each figure is derived from what a module
 * already holds, which is why the dashboard is last: every number on it points
 * into a screen that exists, and the two must agree.
 */

/**
 * A figure and what it is out of. **No proportion stands alone** (CLAUDE.md
 * §6), and a bar that knew only a percentage could not say what it counted.
 */
export interface Completion {
  /** What the record holds. */
  recorded: number
  /** What the home expects to hold. */
  expected: number
}

/**
 * What is expected and missing.
 *
 * A finding is passed apart rather than carried on `Completion`, so a bar
 * cannot be handed a third number by accident: five of the six have two
 * segments and the type says so.
 */
export const missing = (bar: Completion, finding = 0): number =>
  Math.max(0, bar.expected - bar.recorded - finding)

/** Doses that fell due and have nothing recorded against them. */
export function dosesPastTheirWindow(records: MarRecord[]): number {
  return records.filter((record) => record.state.kind === 'omitted').length
}

/**
 * Doses due now or falling due within the next two hours, with nothing
 * recorded against them yet.
 *
 * **Both, and the card says both.** DASH-01 asks for "due in the next 2 hours".
 * A round's window is an hour and the chart looks two hours ahead, so a dose
 * that opened twenty minutes ago and one opening in ninety minutes are both
 * work arriving in this reader's next two hours — and counting only the second
 * puts a zero on the card for most of the day, which reads as a screen that has
 * stopped working rather than as a home with nothing coming.
 *
 * A dose whose window has closed is not here: that is an omission, and it is
 * counted as one.
 */
export function dueSoon(
  records: MarRecord[],
  now: IsoDateTime,
): { doses: number; residents: number } {
  const from = new Date(now).getTime()
  const to = from + MEDICATION_LOOKAHEAD_HOURS * 3_600_000
  const soon = records.filter((record) => {
    if (record.state.kind !== 'due') return false
    const opens = new Date(record.state.windowOpensAt).getTime()
    const closes = new Date(record.state.windowClosesAt).getTime()
    return opens <= to && closes > from
  })
  return {
    doses: soon.length,
    residents: new Set(soon.map((record) => record.residentId)).size,
  }
}

/** Doses recorded today, out of the doses that were due today. */
export function medicationToday(records: MarRecord[]): Completion {
  const due = records.filter((record) => record.state.kind !== 'not_due')
  return {
    recorded: due.filter(
      (record) => record.state.kind === 'given' || record.state.kind === 'not_given',
    ).length,
    expected: due.length,
  }
}

/** Residents written up today, out of the residents counted. */
export function careNotesToday(
  residents: Resident[],
  writtenUpToday: number,
): Completion {
  return { recorded: writtenUpToday, expected: residents.length }
}

/**
 * The three record bars, summed over the residents counted.
 *
 * **Counted over what the home asks**, the same ruling the tabs use: a template
 * or consent type this home has stopped asking is not a gap anybody here can
 * close, so it leaves the denominator rather than making the bar look worse.
 */
export function riskAssessments(residents: Resident[]): Completion {
  return residents.reduce<Completion>(
    (running, resident) => {
      const gaps = riskAssessmentGaps(resident)
      return {
        recorded: running.recorded + (gaps.asked - gaps.neverAssessed),
        expected: running.expected + gaps.asked,
      }
    },
    { recorded: 0, expected: 0 },
  )
}

export function carePlanDomains(residents: Resident[]): Completion {
  return residents.reduce<Completion>(
    (running, resident) => {
      const gaps = carePlanGaps(resident)
      return {
        recorded: running.recorded + (gaps.asked - gaps.neverWritten),
        expected: running.expected + gaps.asked,
      }
    },
    { recorded: 0, expected: 0 },
  )
}

export function consents(residents: Resident[]): Completion {
  return residents.reduce<Completion>(
    (running, resident) => {
      const gaps = consentGaps(resident)
      return {
        recorded: running.recorded + (gaps.asked - gaps.neverSought),
        expected: running.expected + gaps.asked,
      }
    },
    { recorded: 0, expected: 0 },
  )
}

/**
 * Incidents acknowledged, with the unacknowledged drawn apart.
 *
 * **An unacknowledged incident is a finding, not missing data** (DASH-01's own
 * words), so it is its own segment and never the hatch: somebody wrote the
 * incident down, and what is absent is a person picking it up rather than a
 * record nobody made.
 */
export function incidentsAcknowledged(
  incidents: Incident[],
): Completion & { unacknowledged: number } {
  const unacknowledged = incidents.filter(
    (incident) => incident.status.kind === 'reported_not_acknowledged',
  ).length
  return {
    recorded: incidents.length - unacknowledged,
    expected: incidents.length,
    unacknowledged,
  }
}

/** Notes flagged for a senior carer and not yet reviewed. */
export const flaggedForAttention = (notes: CareNote[]): number =>
  notes.filter((note) => note.review.kind === 'flagged_not_reviewed').length

/** One round's doses, for the round chart, from the same records as the MAR. */
export function roundCounts(
  records: MarRecord[],
  medications: Medication[],
  roundTime: string,
  now: IsoDateTime,
): { recorded: number; dueNotRecorded: number; total: number } {
  const scheduled = new Set(
    medications
      .filter((entry) => !entry.isPrn && entry.roundTimes.includes(roundTime))
      .map((entry) => entry.id),
  )
  const cells = records.filter(
    (record) =>
      record.roundTime === roundTime &&
      scheduled.has(record.medicationId) &&
      record.state.kind !== 'not_due',
  )
  const at = new Date(now).getTime()
  return {
    recorded: cells.filter(
      (record) => record.state.kind === 'given' || record.state.kind === 'not_given',
    ).length,
    dueNotRecorded: cells.filter((record) => {
      if (record.state.kind === 'omitted') return true
      return (
        record.state.kind === 'due' &&
        new Date(record.state.windowOpensAt).getTime() <= at
      )
    }).length,
    total: cells.length,
  }
}

/** The residents a figure is counted over, as ids, for a scoped filter. */
export const idsOf = (residents: Resident[]): Set<ResidentId> =>
  new Set(residents.map((resident) => resident.id))
