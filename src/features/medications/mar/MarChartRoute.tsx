import { useCallback, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import type { Medication } from '@/data/types'
import type { MarRecord } from '@/data/fixtures/medications'
import { getMarRecords } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import { ActLine, Button, Card, CardHead, EmptyState } from '@/components/primitives'
import { NotYourHome, Unrecorded } from '@/components/status'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { assertNever } from '@/lib/assert-never'
import {
  buildMarGrid,
  historyOf,
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

  switch (resource.kind) {
    case 'loading':
      return (
        <div className={styles.page} data-mar-chart>
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
              head={head}
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
  head,
  history,
  medications,
  records,
}: {
  head: ReactNode
  history: Extract<MarHistory, { kind: 'held' }>
  medications: Medication[]
  records: MarRecord[]
}) {
  const { resident, site } = useOpenRecord()
  const format = useSiteFormat()
  const lastIndex = history.months.length - 1
  const [index, setIndex] = useState(lastIndex)
  const [open, setOpen] = useState<MarCellAt | 'none'>('none')

  const month = history.months[Math.min(index, lastIndex)]!
  const grid = useMemo(
    () => buildMarGrid(medications, records, month, history),
    [medications, records, month, history],
  )

  const words: SentenceWords = {
    time: format.time,
    dateTime: format.dateTime,
    date: format.date,
    staff: staffLabel,
  }

  const label = monthLabel(month)
  const atFirst = index <= 0
  const atLast = index >= lastIndex
  const previous = history.months[index - 1]
  const next = history.months[index + 1]

  return (
    <>
      <Card>
        {head}
        <div className={styles.controls}>
          <nav className={styles.monthNav} aria-label="Month">
            <Button
              variant="secondary"
              size="small"
              disabled={atFirst}
              aria-label={
                previous === undefined
                  ? 'Previous month: none held'
                  : `Previous month, ${monthLabel(previous)}`
              }
              onClick={() => setIndex(index - 1)}
            >
              <Icon name={marIcons.previous} size={16} />
              Previous
            </Button>
            <h3 className={styles.monthLabel} aria-live="polite" data-month>
              {label}
            </h3>
            <Button
              variant="secondary"
              size="small"
              disabled={atLast}
              aria-label={
                next === undefined
                  ? 'Next month: none held'
                  : `Next month, ${monthLabel(next)}`
              }
              onClick={() => setIndex(index + 1)}
            >
              Next
              <Icon name={marIcons.next} size={16} />
            </Button>
          </nav>
          <div className={styles.export}>
            <Button variant="secondary" size="small">
              <Icon name={marIcons.export} size={16} />
              Export as PDF
            </Button>
            <ActLine kind="not_built">
              Export is not built: no file is produced.
            </ActLine>
          </div>
        </div>
        <p className={styles.held} data-record-bounds>
          The record held here starts on {format.date(history.firstDate)} and runs to{' '}
          {format.date(history.lastDate)}. Times are {site.name}’s.
        </p>
        <Link href={`/residents/${resident.id}/medications`} className={styles.back}>
          <Icon name={marIcons.back} size={16} />
          Back to {resident.preferredName}’s medications
        </Link>
        <MarLegend />
      </Card>

      <Card padded={false}>
        {grid.rows.length === 0 ? (
          <p className={styles.noRows}>
            Nothing is prescribed for {resident.preferredName}, so the chart has no
            rows.
          </p>
        ) : (
          <div className={styles.scroll} data-mar-scroll>
            <table className={styles.grid}>
              <caption className={styles.caption}>
                Medication administration record for {resident.fullLegalName}, {label}.
                One column for each round, under its day.
              </caption>
              <colgroup>
                <col className={styles.medicationColumn} />
              </colgroup>
              {grid.days.map((day) => (
                <colgroup key={day.date} span={grid.rounds.length} />
              ))}
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
                {grid.rows.map((row) => (
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
