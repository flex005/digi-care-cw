import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import type { ResidentSummary } from '@/data/access/client'
import { getResidentSummaries } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import {
  Avatar,
  Button,
  Card,
  CardHead,
  EmptyState,
  Table,
  TableCell,
  TableRow,
  type TableColumn,
} from '@/components/primitives'
import { NotYourHome, ReviewBadge, Unrecorded } from '@/components/status'
import { PageHead } from '@/components/layout/PageHead'
import { ActionCard } from '@/components/layout/ActionCard'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { useSession } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  noListYetLine,
  scopeDenominator,
  scopeLine,
  scopeNote,
} from '@/app/session/resident-scope'
import { assertNever } from '@/lib/assert-never'
import { formatCount, pluralise } from '@/lib/format'
import { ResidentsFilterBar } from './ResidentsFilterBar'
import { listName } from './list-name'
import { RISK_FLAG_SOURCES } from './risk-flag-sources'
import { RiskFlagsCell } from './RiskFlagsCell'
import { CriticalGapsChip } from './CriticalGapsChip'
import { LastNoteCell } from './LastNoteCell'
import {
  STALE_NOTE_HOURS,
  useResidentFilters,
  type SortKey,
} from './use-resident-filters'
import { figure, residentFigures, type ResidentFigure } from './resident-figures'
import { residentFigureIcons } from './residents.icons'
import styles from './residents.module.css'

/**
 * The residents list. RES-01.
 *
 * **The residents the viewer can open, and it says which those are.** A care
 * worker sees the residents they were given and a senior carer sees the home;
 * which is decided by asking the role table, never by a role here. Every
 * figure is counted over that list and says so beneath it.
 *
 * Not a directory: the oldest-care-note sort exists so the residents nobody has
 * written up can be found, which is why the one dark card on the screen counts
 * them and its button performs that sort.
 *
 * "Add resident" is not drawn. Neither role admits a resident, and a disabled
 * button would read as a capability coming later.
 */
export function ResidentsRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()

  const load = useCallback(() => getResidentSummaries(activeSite.id), [activeSite.id])
  const resource = useResource<ResidentSummary[]>(load, [activeSite.id])
  const atHome = useMemo(
    () => (resource.kind === 'ready' ? resource.data : []),
    [resource],
  )
  const onList = useMemo(
    () =>
      atHome.filter(
        (summary) =>
          viewer.ask('open_resident_record', summary.resident.id).kind === 'yes',
      ),
    [atHome, viewer],
  )
  const listing = useResidentFilters(onList, activeSite.id)

  const head = (
    <PageHead
      title="Residents"
      lines={[
        activeSite.name,
        scopeLine(
          viewer.scope,
          atHome.map((summary) => summary.resident.id),
          activeSite.name,
        ),
      ]}
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  /*
   * **Before anything is counted.** A care worker nobody has given a list would
   * otherwise get an empty table under "0 of 0", which reads as a home with
   * nobody in it: the blank meaning two things, at the size of a page.
   */
  if (viewer.scope.kind === 'not_decided')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <CardHead
            title="Your residents"
            subtitle={scopeNote(viewer.scope, activeSite.name)}
            expand={{ kind: 'not_built' }}
          />
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has residents. Until somebody gives you a list, no resident’s record opens here and nothing is counted for you.`}
          />
        </Card>
      </div>
    )

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head}
        <Card>
          <p className={styles.status} role="status">
            Loading residents…
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
            title="The resident list could not be loaded"
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

  const figures = residentFigures(onList, now().getTime())
  const denominator = (count: number) =>
    scopeDenominator(viewer.scope, count, activeSite.name)
  const notes = figure(figures, 'notes')
  const oldestFirst = [...onList].sort((a, b) => noteTime(a) - noteTime(b))[0]

  return (
    <div className={styles.page}>
      {head}

      <div className={styles.figures}>
        {notes.aggregate.kind === 'measured' ? (
          <div className={styles.lead}>
            <ActionCard
              kicker={notes.label}
              figure={formatCount(notes.aggregate.value)}
              of={
                notes.excluded === ''
                  ? denominator(notes.aggregate.coverage.total)
                  : `of ${pluralise(notes.aggregate.coverage.covered, 'resident')} here for ${STALE_NOTE_HOURS} hours or more`
              }
              footLabel="Longest without a note"
              footValue={
                oldestFirst === undefined
                  ? 'Nobody on your list'
                  : listName(oldestFirst.resident)
              }
              action={
                <Button
                  variant="secondary"
                  onClick={() => listing.sortBy('oldestNote')}
                  aria-pressed={listing.sortKey === 'oldestNote'}
                >
                  Sort by oldest care note
                </Button>
              }
            />
          </div>
        ) : null}

        <div className={styles.tileColumn}>
          <MetricTiles label={`Figures for your list at ${activeSite.name}`}>
            {figures
              .filter(
                (entry) => entry.id !== 'notes' || entry.aggregate.kind !== 'measured',
              )
              .map((entry) => (
                <Figure
                  key={entry.id}
                  figure={entry}
                  of={
                    entry.id === 'residents'
                      ? `of ${pluralise(atHome.length, 'resident')} at ${activeSite.name}`
                      : denominator(entry.aggregate.coverage.total)
                  }
                />
              ))}
          </MetricTiles>
          <p className={styles.scopeNote}>
            {scopeNote(viewer.scope, activeSite.name)}
            {notes.excluded === '' ? '' : ` ${notes.excluded}`}
          </p>
        </div>
      </div>

      <Card padded={false}>
        <div className={styles.listHead}>
          <CardHead
            title="Your residents"
            subtitle="Sort by oldest care note to find the residents nobody has written up."
            expand={{ kind: 'not_built' }}
          />
        </div>
        <ResidentsFilterBar listing={listing} />

        {onList.length === 0 ? (
          <EmptyState
            title={`Nobody at ${activeSite.name} is on your list`}
            body="This is not a filter result: your list names residents at another home."
          />
        ) : listing.visible.length === 0 ? (
          <EmptyState
            title="No residents match these filters"
            body={`${pluralise(onList.length, 'resident')} on your list, and none of them match the filters you have set.`}
            actions={
              <Button variant="secondary" onClick={listing.clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className={styles.table}>
            <Table
              caption={`${listing.visible.length} ${denominator(onList.length)}, sorted by ${SORT_LABELS[listing.sortKey]}, ${listing.sortDirection}.`}
              columns={COLUMNS(listing.sortKey)}
              sortKey={listing.sortKey}
              sortDirection={listing.sortDirection}
              onSort={listing.toggleSort}
            >
              {listing.visible.map(({ resident, latestNote }) => (
                <TableRow key={resident.id}>
                  <TableCell>
                    <span className={styles.nameCell}>
                      <Avatar
                        photo={resident.photo}
                        name={resident.fullLegalName}
                        size="medium"
                      />
                      <Link href={`/residents/${resident.id}`} className={styles.name}>
                        {listName(resident)}
                      </Link>
                    </span>
                  </TableCell>
                  <TableCell numeric>
                    <span className={styles.cellLabel}>Room</span>
                    {resident.room.kind === 'recorded' ? (
                      resident.room.value
                    ) : (
                      <Unrecorded label="Room not recorded" />
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellLabel}>Risk flags</span>
                    <RiskFlagsCell resident={resident} />
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellLabel}>Review status</span>
                    <ReviewBadge state={resident.carePlanReview} emphasis="compact" />
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellLabel}>Last care note</span>
                    <LastNoteCell note={latestNote} />
                  </TableCell>
                  <TableCell>
                    <span className={styles.cellLabel}>Records</span>
                    <CriticalGapsChip resident={resident} />
                  </TableCell>
                </TableRow>
              ))}
            </Table>
          </div>
        )}
      </Card>
    </div>
  )
}

function Figure({ figure: entry, of }: { figure: ResidentFigure; of: string }) {
  const icon = residentFigureIcons[entry.id]
  switch (entry.aggregate.kind) {
    case 'measured':
      return (
        <MetricTile
          label={entry.label}
          icon={icon}
          figure={<MetricValue>{formatCount(entry.aggregate.value)}</MetricValue>}
          of={of}
        />
      )
    case 'insufficient_evidence':
      return (
        <MetricTile
          label={entry.label}
          icon={icon}
          figure={<Unrecorded variant="chip" label="Insufficient evidence" />}
          of={`${entry.aggregate.coverage.covered} ${of}`}
          note={entry.aggregate.missingDescription}
        />
      )
    default:
      return assertNever(entry.aggregate)
  }
}

function noteTime(summary: ResidentSummary): number {
  return summary.latestNote === 'none'
    ? Number.NEGATIVE_INFINITY
    : new Date(summary.latestNote.recordedAt).getTime()
}

/**
 * Widths declared, so every row has the same column edges and the eye can run
 * down one. Risk flags and Records are the widest: they carry what the screen
 * exists to surface.
 */
function COLUMNS(sortKey: SortKey): TableColumn<SortKey>[] {
  return [
    { label: 'Resident', sortKey: 'name', width: '19%' },
    { label: 'Room', sortKey: 'room', width: '8%' },
    {
      label: 'Risk flags',
      width: '23%',
      note: `${RISK_FLAG_SOURCES.map((source) => source.name).join(', ')}. Hatched means nobody has looked. Coloured means recorded and needs attention. Nothing shown means recorded and unremarkable.`,
    },
    { label: 'Review status', width: '15%' },
    {
      label:
        sortKey === 'oldestNote' ? 'Last care note, oldest first' : 'Last care note',
      sortKey: sortKey === 'oldestNote' ? 'oldestNote' : 'newestNote',
      width: '16%',
    },
    { label: 'Records', width: '19%' },
  ]
}

const SORT_LABELS: Record<SortKey, string> = {
  name: 'name',
  room: 'room',
  newestNote: 'most recent care note',
  oldestNote: 'oldest care note',
}
