import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Medication } from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import type { IsoDate } from '@/data/types'
import { getMarRecords } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  SegmentedControl,
} from '@/components/primitives'
import { AggregateFigure, NotYourHome, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { assertNever } from '@/lib/assert-never'
import { formatCount, pluralise } from '@/lib/format'
import {
  buildMarGrid,
  daysIn,
  historyOf,
  monthOf,
  shiftAnchor,
  type MarRange,
  keyOf,
  lookOf,
  monthLabel,
  type MarCellAt,
  type MarHistory,
} from './mar-grid'
import { marCellSentence, type SentenceWords } from './mar-sentence'
import { MarGridCell } from './MarGridCell'
import { MarLegend } from './MarLegend'
import { MarCellDetail } from './MarCellDetail'
import { marIcons } from './mar.icons'
import styles from './mar.module.css'

/**
 * A resident's MAR chart. CW PRD MED-04.
 *
 * **Read-only for every role.** No cell edits a record, and nothing on the page
 * records a dose: the round is where a dose is recorded, and a historical dose
 * is never rewritten from a chart. Tapping a cell opens what it holds.
 *
 * A month at a time, bounded by the record: the months offered run from the
 * first month a record is held to the current one, and the page says where the
 * record starts, so an earlier month is never drawn as a month in which nothing
 * happened.
 *
 * Inside the resident's profile, so the subject's head and the tab strip stay
 * above it and the Medications tab stays current.
 */
export function MarChartRoute() {
  const { resident } = useOpenRecord()

  const load = useCallback(() => getMarRecords(resident.id), [resident.id])
  const resource = useResource<{ medications: Medication[]; records: MarRecord[] }>(
    load,
    [resident.id],
  )

  const history = useMemo(
    () => (resource.kind === 'ready' ? historyOf(resource.data.records) : undefined),
    [resource],
  )

  const head = (
    <CardHead
      title={`MAR — ${resident.fullLegalName}`}
      subtitle="Read-only for everyone: no record on this chart can be changed."
      expand={{ kind: 'whole' }}
    />
  )

  /* Above the card, not inside it: the way back out is not part of the chart,
     and it is drawn in every state rather than only where the chart loads. */
  const back = (
    <Link href={`/residents/${resident.id}/medications`} className={styles.back}>
      <Icon name={marIcons.back} size={16} />
      Back to {resident.preferredName}’s medications
    </Link>
  )

  switch (resource.kind) {
    case 'loading':
      return (
        <div className={styles.page} data-mar-chart>
          {back}
          <Card>
            {head}
            <p className={styles.status} role="status">
              Loading the medication record…
            </p>
          </Card>
        </div>
      )
    case 'refused':
      return (
        <div className={styles.page} data-mar-chart>
          <NotYourHome refusal={resource} />
        </div>
      )
    case 'error':
      return (
        <div className={styles.page} data-mar-chart>
          {back}
          <Card>
            {head}
            <EmptyState
              title="This medication record could not be loaded"
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
    case 'ready': {
      if (history === undefined) return null
      return (
        <div className={styles.page} data-mar-chart>
          {back}
          {history.kind === 'none_held' ? (
            <Card>
              {head}
              <Unrecorded
                variant="panel"
                label="No medication record is held"
                detail={`Nothing has been recorded against ${resident.preferredName}’s medicines, so there is no month to show.`}
              />
            </Card>
          ) : (
            <MarChart
              history={history}
              medications={resource.data.medications}
              records={resource.data.records}
            />
          )}
        </div>
      )
    }
    default:
      return assertNever(resource)
  }
}

function MarChart({
  history,
  medications,
  records,
}: {
  history: Extract<MarHistory, { kind: 'held' }>
  medications: Medication[]
  records: MarRecord[]
}) {
  const { resident, site } = useOpenRecord()
  const format = useSiteFormat()

  /*
   * A week to start, because a week is what a shift reads; the month is a
   * step away for whoever is reviewing. Anchored on the last day the record
   * holds rather than on today, so the chart opens on records rather than on
   * an empty week beyond the end of them.
   */
  const [range, setRange] = useState<MarRange>('week')
  const [anchor, setAnchor] = useState<IsoDate>(history.lastDate)
  const [open, setOpen] = useState<MarCellAt | 'none'>('none')

  /**
   * Narrows the grid to the rows carrying an omission.
   *
   * **It hides rows, never cells, and the figure above it does not move.** The
   * count is over the whole range either way, so the claim can never become an
   * artefact of the view (CLAUDE.md §1).
   */
  const [onlyOmissions, setOnlyOmissions] = useState(false)

  const days = useMemo(() => daysIn(anchor, range, history), [anchor, range, history])
  const grid = useMemo(
    () => buildMarGrid(medications, records, days),
    [medications, records, days],
  )

  const step = (by: -1 | 1) => {
    setAnchor(shiftAnchor(anchor, range, by))
    setOpen('none')
  }

  /* The range's own words, from the days actually drawn — which are clipped to
     the record, so the label never claims a span the chart does not show. */
  const first = days[0]
  const last = days[days.length - 1]
  const rangeLabel =
    first === undefined || last === undefined
      ? 'No days in this range'
      : range === 'week'
        ? `Week of ${first.label} to ${last.label}`
        : `Month of ${monthLabel(monthOf(first.date))}`

  const shownRows = onlyOmissions
    ? grid.rows.filter((row) => row.omitted > 0)
    : grid.rows

  const words: SentenceWords = {
    time: format.time,
    dateTime: format.dateTime,
    date: format.date,
    staff: staffLabel,
  }

  const atFirst = first !== undefined && first.date <= history.firstDate
  const atLast = last !== undefined && last.date >= history.lastDate

  return (
    <>
      {/* The fact the screen exists for, before a single cell is scanned. A
          week is a wall of cells and all but a handful say "given"; a chart
          that makes somebody hunt for the holes has buried its own finding. */}
      <div className={styles.omissions} data-omissions>
        <AggregateFigure
          emphasis="banner"
          caption="doses with no record"
          denominatorNoun={`doses due this ${range}`}
          relation="of"
          note="Every other dose in this range has a record against it: given, or not given with a reason."
          action={
            grid.omissions.count > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setOnlyOmissions((only) => !only)}
                aria-pressed={onlyOmissions}
                data-only-omissions
              >
                {onlyOmissions ? 'Show every medicine' : 'Show only these'}
              </Button>
            ) : undefined
          }
          aggregate={{
            kind: 'measured',
            unit: 'count',
            value: grid.omissions.count,
            coverage: { covered: grid.omissions.count, total: grid.omissions.ofDue },
          }}
        />
      </div>

      <Card>
        <div className={styles.controls}>
          <div className={styles.controlsHead}>
            <h2 className={styles.rangeLabel} aria-live="polite" data-range-label>
              {rangeLabel}
            </h2>
            <p className={styles.chartFacts}>
              {pluralise(grid.rows.length, 'medicine')} ·{' '}
              {pluralise(grid.rounds.length, 'round')} a day · times in {site.name}’s
              zone
            </p>
          </div>
          <div className={styles.controlsSide}>
            {/* Icon-only, so each carries a name saying which way and by how
                much: "Earlier" does not tell a keyboard user whether they are
                moving a week or a month (§7). */}
            <Button
              variant="secondary"
              size="small"
              disabled={atFirst}
              aria-label={`Previous ${range}`}
              onClick={() => step(-1)}
              data-step="previous"
            >
              <Icon name={marIcons.previous} size={16} />
            </Button>
            <SegmentedControl
              label="How much of the record"
              value={range}
              onValueChange={(next) => {
                setRange(next as MarRange)
                setOpen('none')
              }}
              options={[
                { value: 'week', label: 'Week' },
                { value: 'month', label: 'Month' },
              ]}
            />
            <Button
              variant="secondary"
              size="small"
              disabled={atLast}
              aria-label={`Next ${range}`}
              onClick={() => step(1)}
              data-step="next"
            >
              <Icon name={marIcons.next} size={16} />
            </Button>
            <Button variant="secondary" size="small">
              <Icon name={marIcons.export} size={16} />
              Export PDF
            </Button>
            <p className={styles.held} data-record-bounds>
              The record held here starts on {format.date(history.firstDate)} and runs
              to {format.date(history.lastDate)}. Times are {site.name}’s.
            </p>
          </div>
        </div>
        <MarLegend />
      </Card>

      <Card padded={false}>
        {shownRows.length === 0 ? (
          <p className={styles.noRows}>
            Nothing is prescribed for {resident.preferredName}, so the chart has no
            rows.
          </p>
        ) : (
          <div className={styles.scroll} data-mar-scroll>
            <table className={styles.grid}>
              <caption className={styles.caption}>
                Medication administration record for {resident.fullLegalName},{' '}
                {rangeLabel}. One column for each round, under its day.
              </caption>
              <colgroup>
                <col className={styles.medicationColumn} />
              </colgroup>
              {grid.days.map((day) => (
                <colgroup key={day.date} span={grid.rounds.length} />
              ))}
              <colgroup>
                <col className={styles.totalColumn} />
              </colgroup>
              <thead>
                <tr>
                  <th className={styles.medicationHead} rowSpan={2} scope="col">
                    Medication
                  </th>
                  {grid.days.map((day) => (
                    <th
                      key={day.date}
                      className={styles.dayHead}
                      colSpan={grid.rounds.length}
                      scope="colgroup"
                    >
                      {day.weekday}
                      <span className={styles.dayDate} data-numeric>
                        {day.label}
                      </span>
                    </th>
                  ))}
                  {/* Rule 4 on every row, at the end of it, where the row's
                      own count belongs. Sticky like the medication column: a
                      total that scrolls away is a total nobody reads. */}
                  <th className={styles.totalHead} rowSpan={2} scope="col">
                    {/* Follows the range: "This month" over a week's columns
                        is a denominator naming a span the chart is not showing. */}
                    This {range}
                  </th>
                </tr>
                <tr>
                  {grid.days.flatMap((day) =>
                    grid.rounds.map((round, position) => (
                      <th
                        key={`${day.date}-${round}`}
                        className={
                          position === 0 ? styles.roundHeadFirst : styles.roundHead
                        }
                        scope="col"
                      >
                        <span data-numeric>{round}</span>
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {shownRows.map((row) => (
                  <tr key={row.medication.id} data-row={row.medication.id}>
                    <th className={styles.medicationCell} scope="row">
                      <span className={styles.medicationName}>
                        {row.medication.name}
                      </span>
                      <span className={styles.medicationDose}>
                        {row.medication.dose} · {row.medication.route}
                      </span>
                      <span className={styles.medicationTags}>
                        {row.medication.isPrn ? (
                          <span className={styles.tag}>As required</span>
                        ) : null}
                        {row.medication.isControlledDrug ? (
                          <span className={styles.tag}>Controlled drug</span>
                        ) : null}
                      </span>
                    </th>
                    {row.cells.map((at, position) => (
                      <td
                        key={keyOf(at.medication.id, at.date, at.roundTime)}
                        data-cell={keyOf(at.medication.id, at.date, at.roundTime)}
                        /*
                         * Whether the record reaches this slot, which the look
                         * alone cannot say: a recorded "nothing was due" and a
                         * round this medicine is not on both draw as not due,
                         * and they are the same thing to a reader. They are
                         * not the same thing to the row's denominator, which
                         * counts only what the record covers.
                         */
                        data-recorded={at.cell.kind === 'recorded'}
                        className={
                          position % grid.rounds.length === 0
                            ? styles.slotFirst
                            : styles.slot
                        }
                      >
                        <MarGridCell
                          look={lookOf(at.cell, at.medication)}
                          sentence={marCellSentence(at, words)}
                          onOpen={() => setOpen(at)}
                        />
                      </td>
                    ))}
                    {/*
                     * Counted out of the rounds this medicine was scheduled
                     * for, never out of the row's cells — most of which are
                     * another medicine's round. The doses with no record are
                     * stated first and in the unrecorded ink, because they are
                     * the finding; the rest is the row's coverage.
                     */}
                    <td className={styles.totalCell} data-row-total={row.medication.id}>
                      {row.omitted > 0 ? (
                        <span className={styles.totalOmitted} data-numeric>
                          {formatCount(row.omitted)} with no record
                        </span>
                      ) : null}
                      <span className={styles.totalGiven} data-numeric>
                        {formatCount(row.given)} given of {formatCount(row.scheduled)}{' '}
                        due
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <MarCellDetail at={open} resident={resident} onClose={() => setOpen('none')} />
    </>
  )
}
