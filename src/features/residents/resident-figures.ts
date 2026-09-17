import type { Aggregate } from '@/data/types'
import type { ResidentSummary } from '@/data/access/client'
import { coverageRatio } from '@/data/types'
import { recordCompleteness } from '@/data/completeness'
import { insufficientEvidenceThreshold } from '@/data/access/settings-store'
import { STALE_NOTE_HOURS, hasNoNoteWithinWindow } from './use-resident-filters'

/**
 * The figures above the residents list, counted over the residents the viewer
 * can see. RES-01.
 *
 * **Declared, so a figure cannot lose its denominator.** Every one is an
 * `Aggregate`, and there is no shape here that holds a number without the
 * coverage beside it.
 *
 * **No movement over a period.** The PRD's "No change this month" and "−3 this
 * month" are refused (docs/DEPARTURES.md): a month-on-month change needs the
 * record as it stood a month ago, and a care worker's list did not exist in
 * that shape then.
 *
 * **"No care note in 48 hours" at zero is a plain zero.** The PRD draws it as a
 * hatched card, and a zero is a finding, not a gap: hatching it would claim a
 * gap the record says is not there (CLAUDE.md §1, docs/DEPARTURES.md).
 */
export type FigureId = 'residents' | 'critical' | 'reviews' | 'notes' | 'falls'

export interface ResidentFigure {
  id: FigureId
  label: string
  aggregate: Aggregate
  /** Who left the denominator, and why. Empty when nobody did. */
  excluded: string
}

const HOUR = 3_600_000

function subset(
  id: FigureId,
  label: string,
  assessable: ResidentSummary[],
  total: number,
  matches: (summary: ResidentSummary) => boolean,
  excluded: string,
): ResidentFigure {
  const coverage = { covered: assessable.length, total }
  if (total === 0 || coverageRatio(coverage) < insufficientEvidenceThreshold())
    return {
      id,
      label,
      aggregate: {
        kind: 'insufficient_evidence',
        coverage,
        missingDescription:
          total === 0
            ? 'There are no residents here to count.'
            : 'Too few of them have been here long enough to say.',
      },
      excluded,
    }
  return {
    id,
    label,
    aggregate: {
      kind: 'measured',
      unit: 'count',
      value: assessable.filter(matches).length,
      coverage,
    },
    excluded,
  }
}

export function residentFigures(
  summaries: ResidentSummary[],
  now: number,
): ResidentFigure[] {
  const total = summaries.length
  const longEnough = summaries.filter(
    (summary) =>
      now - new Date(summary.resident.admittedOn).getTime() >= STALE_NOTE_HOURS * HOUR,
  )
  const tooNew = total - longEnough.length

  return [
    {
      id: 'residents',
      label: 'Residents',
      aggregate: {
        kind: 'measured',
        unit: 'count',
        value: total,
        coverage: { covered: total, total },
      },
      excluded: '',
    },
    subset(
      'critical',
      'Critical gaps',
      summaries,
      total,
      (summary) => recordCompleteness(summary.resident).hasCriticalGaps,
      '',
    ),
    subset(
      'reviews',
      'Reviews overdue or never scheduled',
      summaries,
      total,
      (summary) =>
        summary.resident.carePlanReview.kind === 'overdue' ||
        summary.resident.carePlanReview.kind === 'never_scheduled',
      '',
    ),
    subset(
      'notes',
      `No care note in ${STALE_NOTE_HOURS} hours`,
      longEnough,
      total,
      (summary) => hasNoNoteWithinWindow(summary, now),
      tooNew === 0
        ? ''
        : `${tooNew} admitted under ${STALE_NOTE_HOURS} hours ago, so the window has not passed for them.`,
    ),
    subset(
      'falls',
      'Never assessed for falls',
      summaries,
      total,
      (summary) => summary.resident.risks.falls.kind === 'not_assessed',
      '',
    ),
  ]
}

/** The figure with this id. Throws rather than rendering a card for nothing. */
export function figure(figures: ResidentFigure[], id: FigureId): ResidentFigure {
  const found = figures.find((entry) => entry.id === id)
  if (found === undefined) throw new Error(`No resident figure ${id}.`)
  return found
}
