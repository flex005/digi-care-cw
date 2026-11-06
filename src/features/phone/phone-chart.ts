import type { IsoDate, IsoDateTime, MarCellState, Medication } from '@/data/types'
import { medicationToday } from '@/features/dashboard/dashboard-figures'
import {
  buildMarGrid,
  daysShown,
  monthOf,
  type MarGridCell,
} from '@/features/medications/mar/mar-grid'
import { assertNever } from '@/lib/assert-never'
import { zonedDate, type TimeZone } from '@/lib/format'
import type { DoseRecord } from './phone-data'

/** A medicine on the chart, as the shared loader returns it. */
export type Drug = Medication

/**
 * One dose on today's chart: a scheduled medicine at one of its rounds.
 *
 * `recorded` holds every state but `not_due`, which is not a dose today. A
 * `not_held` intersection is the desktop chart's: the medicine is prescribed at
 * this round and no record of it is held, which is not an omission.
 */
export interface ChartDose {
  drug: Drug
  cell:
    | { kind: 'recorded'; state: Exclude<MarCellState, { kind: 'not_due' }> }
    | { kind: 'not_held' }
}

export interface ChartRound {
  roundTime: string
  doses: ChartDose[]
}

/** A PRN medicine, and the doses of it recorded as given today. */
export interface AsRequired {
  drug: Drug
  given: Extract<MarCellState, { kind: 'given' }>[]
}

/**
 * One person's chart for today, grouped by round. MED-04 on a phone, for one
 * day, read-only.
 *
 * **Every medicine on the chart appears somewhere**: at each round it has a
 * dose today, as required if it is a PRN, or under "not due today". A chart that
 * left out what is not due, or what the phone cannot record, would be a chart
 * that lies about the day; a controlled drug is a dose here like any other.
 *
 * Built from the desktop chart's own grid (`buildMarGrid`) over the one day, so
 * a cell here is the cell there, and its figure from the dashboard's
 * `medicationToday`, so "recorded out of due" means one thing in both places.
 */
export interface TodaysChart {
  date: IsoDate
  rounds: ChartRound[]
  asRequired: AsRequired[]
  notDueToday: Drug[]
  /** Doses recorded, given or not given, out of the doses due today. */
  recorded: number
  due: number
}

export function todaysChart(input: {
  drugs: Drug[]
  records: DoseRecord[]
  at: IsoDateTime
  timeZone: TimeZone
}): TodaysChart {
  const { drugs, records, at, timeZone } = input
  const date = zonedDate(at, timeZone)
  const scheduled = drugs.filter((drug) => !drug.isPrn)
  const todays = records.filter((record) => record.date === date)
  const day = daysShown(monthOf(date), {
    kind: 'held',
    firstDate: date,
    lastDate: date,
    months: [monthOf(date)],
  })
  const grid = buildMarGrid(scheduled, todays, day)

  const rounds = grid.rounds
    .map((roundTime): ChartRound => ({
      roundTime,
      doses: grid.rows.flatMap((row) =>
        row.cells
          .filter((intersection) => intersection.roundTime === roundTime)
          .flatMap((intersection): ChartDose[] => {
            const cell = doseCell(intersection.cell)
            return cell === 'not_a_dose' ? [] : [{ drug: row.medication, cell }]
          }),
      ),
    }))
    .filter((round) => round.doses.length > 0)

  const onChart = new Set(
    rounds.flatMap((round) => round.doses.map((dose) => dose.drug.id)),
  )
  /* The owner already leaves out an as-required dose, which nobody owes. */
  const { recorded, expected } = medicationToday(todays)

  return {
    date,
    rounds,
    asRequired: drugs
      .filter((drug) => drug.isPrn)
      .map((drug) => ({
        drug,
        given: todays.flatMap((record) =>
          record.medicationId === drug.id && record.state.kind === 'given'
            ? [record.state]
            : [],
        ),
      })),
    notDueToday: scheduled.filter((drug) => !onChart.has(drug.id)),
    recorded,
    due: expected,
  }
}

function doseCell(cell: MarGridCell): ChartDose['cell'] | 'not_a_dose' {
  switch (cell.kind) {
    case 'recorded':
      return cell.state.kind === 'not_due'
        ? 'not_a_dose'
        : { kind: 'recorded', state: cell.state }
    case 'not_held':
      return cell
    case 'not_on_this_round':
    case 'not_prescribed_yet':
      return 'not_a_dose'
    default:
      return assertNever(cell)
  }
}
