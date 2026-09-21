import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import type { CareNote, IsoDateTime, Resident, Shift } from '@/data/types'
import { getCareNotesForSite, getResidentsBySite } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import {
  Button,
  Card,
  CardHead,
  EmptyState,
  Pager,
  SelectedMark,
  buttonClassName,
  usePaged,
} from '@/components/primitives'
import { NeverWrittenUp, NotYourHome, Unrecorded } from '@/components/status'
import { PageHead } from '@/components/layout/PageHead'
import { ActionCard } from '@/components/layout/ActionCard'
import { MetricTile, MetricTiles, MetricValue } from '@/components/metric/MetricTile'
import { metricIcons } from '@/components/metric/metric-tiles.icons'
import { useSession, useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import {
  noListYetLine,
  scopeAcross,
  scopeDenominator,
  scopeLine,
  scopeNote,
  type ResidentScope,
} from '@/app/session/resident-scope'
import { formatCount, pluralise } from '@/lib/format'
import { SHIFTS, SHIFT_NAMES, shiftAt, shiftHours } from '@/lib/shift'
import {
  CARE_NOTES_VIEWS,
  allNotes,
  authorCount,
  byShift,
  flaggedNotReviewed,
  notesToday,
  oldestFlag,
  shiftHasBegun,
  withoutNoteOnShift,
  withoutNoteToday,
  yourNotes,
  type CareNotesView,
  type NoteWithResident,
} from './care-notes-views'
import { FlaggedRow, NoteRow, RowSubject } from './NoteRows'
import { REVIEW_OUTCOME_LABEL, waitingSince } from './note-parts'
import { ReviewNoteControl, type ReviewChange } from './ReviewNoteControl'
import styles from './notes.module.css'

/**
 * Care notes across the residents this person can see. CN-01.
 *
 * **Scoped to the viewer's list, and it says so.** A care worker sees notes
 * about the residents they were given and a senior carer sees the home; which is
 * asked of the role table per resident, never decided by a role here. Every
 * figure is counted over that list, with the line beneath saying so.
 *
 * **It opens on the notes waiting for a senior**, because that is the question
 * with nowhere else to be answered, and the one dark card counts them.
 *
 * Refused here, and in docs/DEPARTURES.md: the flagged count "of 11,205 on
 * record" (a ratio of flags to everything written means nothing), and the "By
 * author" view with its colleague picker (browsing a named colleague's work is
 * the blame the scope rule stops). "Your notes" is the viewer's own.
 */
export function CareNotesRoute() {
  const { activeSite } = useSession()
  const viewer = useViewer()

  const [view, setView] = useState<CareNotesView>('flagged')
  const [reloads, setReloads] = useState(0)
  const [lastChange, setLastChange] = useState<ReviewChange | 'none'>('none')

  const load = useCallback(
    () =>
      Promise.all([
        getResidentsBySite(activeSite.id),
        getCareNotesForSite(activeSite.id),
      ]).then(([residents, notes]) => ({ residents, notes })),
    [activeSite.id],
  )
  const resource = useResource(load, [activeSite.id, reloads])

  const atHome = useMemo(
    () => (resource.kind === 'ready' ? resource.data.residents : EMPTY_RESIDENTS),
    [resource],
  )
  const onList = useMemo(
    () =>
      atHome.filter(
        (resident) => viewer.ask('open_resident_record', resident.id).kind === 'yes',
      ),
    [atHome, viewer],
  )
  const notes = useMemo(() => {
    if (resource.kind !== 'ready') return EMPTY_NOTES
    const reached = new Set(onList.map((resident) => resident.id))
    return resource.data.notes.filter((note) => reached.has(note.residentId))
  }, [resource, onList])

  const onChanged = (change: ReviewChange) => {
    setLastChange(change)
    setReloads((count) => count + 1)
  }

  const writeAnswer = viewer.ask('write_care_note')
  const head = (withAct: boolean) => (
    <PageHead
      title="Care notes"
      lines={[
        activeSite.name,
        scopeLine(
          viewer.scope,
          atHome.map((resident) => resident.id),
          activeSite.name,
        ),
      ]}
      action={
        withAct && writeAnswer.kind === 'yes' ? (
          <Link
            href="/care-notes/new"
            className={buttonClassName({ variant: 'primary', size: 'large' })}
          >
            Write a care note
          </Link>
        ) : undefined
      }
    />
  )

  if (resource.kind === 'refused') return <NotYourHome refusal={resource} />

  /*
   * **Before anything is counted.** A care worker nobody has given a list would
   * otherwise see "0 flagged notes" over an empty queue, which reads as a home
   * where nothing is waiting.
   */
  if (viewer.scope.kind === 'not_decided')
    return (
      <div className={styles.page}>
        {head(false)}
        <Card>
          <CardHead
            title="Care notes about your residents"
            subtitle={scopeNote(viewer.scope, activeSite.name)}
            expand={{ kind: 'whole' }}
          />
          <Unrecorded
            variant="panel"
            label={noListYetLine}
            detail={`${activeSite.name} has residents and care notes about them. Until somebody gives you a list, no note is shown here and nothing is counted for you.`}
          />
        </Card>
      </div>
    )

  if (resource.kind === 'loading')
    return (
      <div className={styles.page}>
        {head(true)}
        <Card>
          <p className={styles.status} role="status">
            Loading care notes…
          </p>
        </Card>
      </div>
    )

  if (resource.kind === 'error')
    return (
      <div className={styles.page}>
        {head(true)}
        <Card>
          <EmptyState
            title="The care notes could not be loaded"
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

  const moment = now().toISOString() as IsoDateTime
  const timeZone = activeSite.timeZone
  const scoped: Scoped = {
    scope: viewer.scope,
    home: activeSite.name,
    count: onList.length,
  }

  const flagged = flaggedNotReviewed(notes, onList)
  const oldest = oldestFlag(flagged)
  const today = notesToday(notes, onList, timeZone, moment)
  const unwritten = withoutNoteToday(onList, notes, timeZone, moment)

  return (
    <div className={styles.page}>
      {head(true)}

      <div className={styles.figures}>
        <div className={styles.lead}>
          <ActionCard
            kicker="Flagged, not reviewed"
            figure={formatCount(flagged.length)}
            of={`${flagged.length === 1 ? 'flagged note' : 'flagged notes'}, ${across(scoped)}`}
            footLabel="Oldest waiting"
            footValue={
              oldest.kind === 'waiting_since'
                ? waitingSince(oldest.at)
                : 'Nothing waiting'
            }
            action={
              <Button
                variant="secondary"
                onClick={() => setView('flagged')}
                aria-pressed={view === 'flagged'}
              >
                Show flagged notes
              </Button>
            }
          />
        </div>

        <div className={styles.tileColumn}>
          <MetricTiles label={`Care note figures for your list at ${activeSite.name}`}>
            <MetricTile
              label="Notes today"
              icon={metricIcons.notes}
              figure={<MetricValue>{formatCount(today.length)}</MetricValue>}
              of={across(scoped)}
            />
            <MetricTile
              label="Not written up today"
              icon={metricIcons.notesMissing}
              figure={
                unwritten.length === 0 ? (
                  <MetricValue>0</MetricValue>
                ) : (
                  <Unrecorded
                    variant="chip"
                    label={`${formatCount(unwritten.length)} not written up`}
                    detail="nobody has recorded a care note for them today"
                  />
                )
              }
              of={scopeDenominator(scoped.scope, scoped.count, scoped.home)}
            />
            <MetricTile
              label="On the record here"
              icon={metricIcons.notesAll}
              figure={<MetricValue>{formatCount(notes.length)}</MetricValue>}
              of={`written by ${pluralise(authorCount(notes), 'person', 'people')}`}
            />
          </MetricTiles>
          <p className={styles.scopeNote}>{scopeNote(viewer.scope, activeSite.name)}</p>
        </div>
      </div>

      <div className={styles.pills} role="group" aria-label="Which care notes">
        {CARE_NOTES_VIEWS.map((entry) => {
          const chosen = view === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              className={chosen ? styles.pillChosen : styles.pill}
              aria-pressed={chosen}
              onClick={() => setView(entry.id)}
              data-notes-view={entry.id}
            >
              <SelectedMark selected={chosen} />
              {entry.label}
            </button>
          )
        })}
      </div>

      {view === 'flagged' ? (
        <FlaggedView
          flagged={flagged}
          scoped={scoped}
          notes={notes}
          residents={onList}
          lastChange={lastChange}
          onChanged={onChanged}
        />
      ) : view === 'quiet_today' ? (
        <QuietView unwritten={unwritten} scoped={scoped} moment={moment} />
      ) : view === 'yours' ? (
        <YoursView notes={notes} residents={onList} scoped={scoped} />
      ) : view === 'by_shift' ? (
        <ShiftView
          notes={notes}
          residents={onList}
          scoped={scoped}
          moment={moment}
          timeZone={timeZone}
        />
      ) : (
        <EverythingView
          notes={notes}
          scoped={scoped}
          today={today.length}
          residents={onList}
        />
      )}
    </div>
  )
}

const EMPTY_RESIDENTS: Resident[] = []
const EMPTY_NOTES: CareNote[] = []

/** The viewer's scope, the home and how many residents it reaches. */
interface Scoped {
  scope: ResidentScope
  home: string
  count: number
}

/**
 * "across your 4 residents", for a count of notes over the residents they are
 * about. A note count is not a subset of residents, so "of" would state a ratio
 * that does not exist; the wording is `scopeAcross`'s, beside `scopeDenominator`.
 */
function across({ scope, home, count }: Scoped): string {
  return scopeAcross(scope, count, home)
}

function FlaggedView({
  flagged,
  scoped,
  notes,
  residents,
  lastChange,
  onChanged,
}: {
  flagged: NoteWithResident[]
  scoped: Scoped
  notes: CareNote[]
  residents: Resident[]
  lastChange: ReviewChange | 'none'
  onChanged: (change: ReviewChange) => void
}) {
  const justReviewed = justReviewedNote(lastChange, notes, residents)

  return (
    <Card>
      <CardHead
        title="Flagged, not reviewed"
        subtitle="Notes somebody asked a senior to look at, the longest waiting first."
        expand={{ kind: 'whole' }}
      />
      <div className={styles.viewHead}>
        <p className={styles.claim} data-flagged-claim>
          <span data-numeric>{formatCount(flagged.length)}</span>{' '}
          {flagged.length === 1 ? 'note' : 'notes'} flagged and not yet reviewed,{' '}
          {across(scoped)} · oldest first
        </p>
      </div>

      {justReviewed === 'none' ? null : (
        <div className={styles.justReviewed} role="status" data-just-reviewed>
          <p>
            You marked {justReviewed.resident.fullLegalName}’s note reviewed:{' '}
            {justReviewed.outcome}. It has left this view.
          </p>
          <ReviewNoteControl
            note={justReviewed.note}
            resident={justReviewed.resident}
            onChanged={onChanged}
          />
        </div>
      )}

      {flagged.length === 0 ? (
        <p className={styles.plain} data-notes-empty>
          No flagged note is waiting for review.
        </p>
      ) : (
        <ul className={styles.rows}>
          {flagged.map(({ note, resident }) => (
            <FlaggedRow
              key={note.id}
              note={note}
              resident={resident}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </Card>
  )
}

/** The note this session just reviewed, still reviewed, for its undo. */
function justReviewedNote(
  change: ReviewChange | 'none',
  notes: CareNote[],
  residents: Resident[],
): { note: CareNote; resident: Resident; outcome: string } | 'none' {
  if (change === 'none' || change.kind !== 'recorded') return 'none'
  const note = notes.find((entry) => entry.id === change.noteId)
  if (note === undefined || note.review.kind !== 'reviewed') return 'none'
  const resident = residents.find((entry) => entry.id === note.residentId)
  if (resident === undefined) return 'none'
  return { note, resident, outcome: REVIEW_OUTCOME_LABEL(note.review.outcome) }
}

function QuietView({
  unwritten,
  scoped,
  moment,
}: {
  unwritten: ReturnType<typeof withoutNoteToday>
  scoped: Scoped
  moment: IsoDateTime
}) {
  const format = useSiteFormat()
  return (
    <Card>
      <CardHead
        title="No note today"
        subtitle={`Nobody has written about these residents today. It is ${format.time(moment)} at ${scoped.home}.`}
        expand={{ kind: 'whole' }}
      />
      <div className={styles.viewHead}>
        <p className={styles.claim} data-quiet-claim>
          <span data-numeric>{formatCount(unwritten.length)}</span>{' '}
          {scopeDenominator(scoped.scope, scoped.count, scoped.home)} with no care note
          today · never written up first
        </p>
      </div>
      {unwritten.length === 0 ? (
        <p className={styles.plain} data-notes-empty>
          Every resident counted here has a care note today.
        </p>
      ) : (
        <ul className={styles.rows}>
          {unwritten.map(({ resident, last }) => (
            <li key={resident.id} className={styles.row} data-quiet={resident.id}>
              <RowSubject resident={resident} />
              <div className={styles.rowMain}>
                {last === 'never' ? (
                  <NeverWrittenUp />
                ) : (
                  <Unrecorded
                    label="No care note today"
                    detail={`Last written up ${format.dateTime(last.recordedAt)} by ${staffLabel(last.recordedBy)}, ${format.relative(last.recordedAt)}`}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function YoursView({
  notes,
  residents,
  scoped,
}: {
  notes: CareNote[]
  residents: Resident[]
  scoped: Scoped
}) {
  const { member } = useSignedIn()
  const items = yourNotes(notes, residents, member.id)
  return (
    <Card>
      <CardHead
        title="Your notes"
        subtitle="Only notes you wrote. A resident with nothing here may have notes by somebody else."
        expand={{ kind: 'whole' }}
      />
      <div className={styles.viewHead}>
        <p className={styles.claim} data-yours-claim>
          <span data-numeric>{formatCount(items.length)}</span>{' '}
          {items.length === 1 ? 'note' : 'notes'} you wrote, {across(scoped)}, newest
          first
        </p>
      </div>
      <PagedNotes
        items={items}
        empty="You have written no care notes about these residents."
      />
    </Card>
  )
}

function ShiftView({
  notes,
  residents,
  scoped,
  moment,
  timeZone,
}: {
  notes: CareNote[]
  residents: Resident[]
  scoped: Scoped
  moment: IsoDateTime
  timeZone: string
}) {
  const [shift, setShift] = useState<Shift>(() => shiftAt(moment, timeZone))
  const name = SHIFT_NAMES[shift].toLowerCase()
  const begun = shiftHasBegun(shift, timeZone, moment)
  const written = byShift(notes, residents, shift, timeZone, moment)
  const missed = withoutNoteOnShift(residents, notes, shift, timeZone, moment)

  return (
    <Card>
      <CardHead
        title="By shift"
        subtitle={`Filtered to the ${name} shift today, ${shiftHours(shift)}. A resident below was not written about on this shift; somebody on another may have.`}
        expand={{ kind: 'whole' }}
      />
      <div className={styles.viewHead}>
        <div className={styles.pills} role="group" aria-label="Which shift">
          {SHIFTS.map((entry) => {
            const chosen = entry.id === shift
            return (
              <button
                key={entry.id}
                type="button"
                className={chosen ? styles.pillChosen : styles.pill}
                aria-pressed={chosen}
                onClick={() => setShift(entry.id)}
                data-shift={entry.id}
              >
                <SelectedMark selected={chosen} />
                {entry.name} shift
              </button>
            )
          })}
        </div>
        {begun ? (
          <p className={styles.claim} data-shift-claim>
            <span data-numeric>{formatCount(residents.length - missed.length)}</span>{' '}
            {scopeDenominator(scoped.scope, scoped.count, scoped.home)} written up on
            the {name} shift today
          </p>
        ) : null}
      </div>

      {!begun ? (
        <p className={styles.plain} data-shift-not-begun>
          The {name} shift has not started today: it runs {shiftHours(shift)}. Nothing
          is counted for it yet.
        </p>
      ) : (
        <>
          {missed.length === 0 ? null : (
            <ul className={styles.rows}>
              {missed.map((resident) => (
                <li key={resident.id} className={styles.row} data-missed={resident.id}>
                  <RowSubject resident={resident} />
                  <div className={styles.rowMain}>
                    <Unrecorded label={`No note on the ${name} shift today`} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {written.length === 0 ? (
            <p className={styles.plain} data-notes-empty>
              No care note has been written on the {name} shift today.
            </p>
          ) : (
            <ul className={styles.rows}>
              {written.map(({ note, resident }) => (
                <NoteRow key={note.id} note={note} resident={resident} />
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  )
}

function EverythingView({
  notes,
  residents,
  scoped,
  today,
}: {
  notes: CareNote[]
  residents: Resident[]
  scoped: Scoped
  today: number
}) {
  const items = allNotes(notes, residents)
  return (
    <Card>
      <CardHead
        title="All notes"
        subtitle="Every care note about these residents, by everybody, newest first, a page at a time."
        expand={{ kind: 'whole' }}
      />
      <div className={styles.viewHead}>
        <p className={styles.claim} data-everything-claim>
          <span data-numeric>{formatCount(items.length)}</span>{' '}
          {items.length === 1 ? 'note' : 'notes'} on the record, {across(scoped)}.{' '}
          <span data-numeric>{formatCount(today)}</span> of them written today.
        </p>
      </div>
      <PagedNotes
        items={items}
        empty="No care note has been written about these residents."
      />
    </Card>
  )
}

/** A page of notes. The pager states the slice and what it is a slice of. */
function PagedNotes({ items, empty }: { items: NoteWithResident[]; empty: string }) {
  const paged = usePaged(items)
  if (items.length === 0)
    return (
      <p className={styles.plain} data-notes-empty>
        {empty}
      </p>
    )
  return (
    <>
      <ul className={styles.rows}>
        {paged.shown.map(({ note, resident }) => (
          <NoteRow key={note.id} note={note} resident={resident} />
        ))}
      </ul>
      <Pager paged={paged} total={items.length} noun="care notes" />
    </>
  )
}
