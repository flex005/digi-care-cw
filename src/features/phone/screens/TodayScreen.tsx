import { useCallback, useState, type ReactNode } from 'react'
import {
  getCareNotesForSite,
  getHandoverBoard,
  getOmissions,
  getResidentsBySite,
  getRound,
  type Omission,
} from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type {
  CareNote,
  HandoverSession,
  IsoDate,
  IsoDateTime,
  ResidentId,
} from '@/data/types'
import { useSession, useSignedIn } from '@/app/session/use-session'
import type { Answer } from '@/app/session/capabilities'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import { ActionCard } from '@/components/layout/ActionCard'
import { MovedClockLine } from '@/components/shell/MovedClockLine'
import { Unrecorded } from '@/components/status'
import { dosesPastTheirWindow, dueSoon } from '@/features/dashboard/dashboard-figures'
import {
  byOldest,
  fromHandovers,
  fromOmissions,
  fromReviews,
  LATE_FILTERS,
  ofKind,
  type LateItem,
  type LateKind,
} from '@/features/dashboard/late-items'
import { withoutNoteToday } from '@/features/notes/care-notes-views'
import { formatCount, formatLateness, pluralise, zonedDate } from '@/lib/format'
import { SHIFT_NAMES, shiftAt } from '@/lib/shift'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { assertNever } from '@/lib/assert-never'
import {
  noListYetLine,
  scopeDenominator,
  scopeNote,
  scopeReaches,
  type DoseRecord,
  type Person,
} from '../phone-data'
import { phoneIcons } from '../phone.icons'
import { Loaded } from '../ScreenStates'
import { usePhoneNav } from '../shell/nav'
import { Screen } from '../shell/Screen'
import { Sheet } from '../shell/Sheet'
import { StackLink } from '../shell/StackLink'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

interface TodayData {
  people: Person[]
  records: DoseRecord[]
  notes: CareNote[]
  omissions: Omission[]
  /** Handovers signed by one shift and not the other, or no board at this home. */
  unsigned: HandoverSession[] | 'no_board'
}

type Filter = LateKind | 'everything'

const LATE_ID = 'already-late'

/**
 * Today: the dashboard, on a phone. CW PRD DASH-01, counted over the reader's
 * list exactly as the desktop dashboard counts it, from the same owners.
 *
 * **What is late, what is about to fall due, and who nobody has written about
 * today.** One dark card, the thing to act on next: what is already late. Three
 * figures, each with what it is out of. Then the late list itself, oldest first,
 * each row pushing the record it is about; its filter is a picker, so a sheet.
 *
 * **It holds no record of its own.** Every figure is asked of a function the
 * desktop dashboard asks, so the two cannot disagree about one home.
 */
export function TodayScreen() {
  const { activeSite } = useSession()
  const { member } = useSignedIn()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const firstName = member.ref.fullName.split(/\s+/)[0] ?? member.ref.fullName

  const load = useCallback(
    () =>
      Promise.all([
        getResidentsBySite(activeSite.id),
        getRound(activeSite.id).then(({ records }) => records),
        getCareNotesForSite(activeSite.id),
        getOmissions(activeSite.id, aDayBefore(at)).then(({ omissions }) => omissions),
        getHandoverBoard(activeSite.id)
          .then((board): TodayData['unsigned'] => board.unsigned)
          .catch((): TodayData['unsigned'] => 'no_board'),
      ]).then(([people, records, notes, omissions, unsigned]): TodayData => ({
        people,
        records,
        notes,
        omissions,
        unsigned,
      })),
    [activeSite.id, at],
  )
  const resource = useResource<TodayData>(load, [activeSite.id])

  return (
    <Screen
      root
      title={`Hello, ${firstName}`}
      person={{
        line: `${SHIFT_NAMES[shiftAt(at, activeSite.timeZone)]} shift · ${activeSite.name}`,
      }}
    >
      <div className={styles.gutter}>
        <MovedClockLine />
      </div>
      <Loaded
        resource={resource}
        loading="Loading today…"
        failed="Today could not be loaded"
      >
        {(data) =>
          viewer.scope.kind === 'not_decided' ? (
            <NothingCounted atHome={data.people.length} />
          ) : (
            <Counted data={data} at={at} />
          )
        }
      </Loaded>
    </Screen>
  )
}

function Counted({ data, at }: { data: TodayData; at: IsoDateTime }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [filter, setFilter] = useState<Filter>('everything')
  const [picking, setPicking] = useState(false)

  const mine = data.people.filter((person) => scopeReaches(viewer.scope, person.id))
  const ids = new Set(mine.map((person) => person.id))
  const today: IsoDate = zonedDate(at, activeSite.timeZone)
  const todays = data.records.filter(
    (record) => ids.has(record.residentId) && record.date === today,
  )
  const soon = dueSoon(todays, at)
  const pastWindow = dosesPastTheirWindow(todays)
  const quiet = withoutNoteToday(mine, data.notes, activeSite.timeZone, at).length

  /*
   * **What this reader can act on now, and nothing wider.** The first version
   * counted ninety days of omissions, every review past its date and every
   * unsigned handover the home has, so a senior carer saw 1,018 "late": true
   * arithmetic over a population nobody on a shift can act on. Each part is
   * now scoped, and says its scope:
   *
   * - doses: today's, still open, on the reader's list;
   * - reviews: on the list, and only where the role table lets this reader
   *   conduct one, because a list of acts somebody may not take is not theirs;
   * - handovers: today's, and only for a reader who may sign one.
   *
   * Each late thing keeps who it is about, so a row can push that record.
   */
  const about = new Map<string, ResidentId>()
  const late: LateItem[] = []
  for (const omission of data.omissions) {
    if (!ids.has(omission.record.residentId)) continue
    if (omission.record.date !== today || omission.closure.kind !== 'open') continue
    for (const item of fromOmissions([omission])) {
      about.set(item.id, omission.record.residentId)
      late.push(item)
    }
  }
  const reviewing = viewer.ask('conduct_review')
  if (reviewing.kind === 'yes')
    for (const person of mine) {
      if (viewer.ask('conduct_review', person.id).kind !== 'yes') continue
      for (const item of fromReviews([person], today)) {
        about.set(item.id, person.id)
        late.push(item)
      }
    }
  const signing = viewer.ask('sign_handover')
  if (signing.kind === 'yes' && data.unsigned !== 'no_board')
    late.push(
      ...fromHandovers(
        data.unsigned.filter((session) => session.date === today),
        today,
      ),
    )
  const lateItems = byOldest(late)
  const shown = ofKind(lateItems, filter)
  const chosen = LATE_FILTERS.find((entry) => entry.id === filter) ?? LATE_FILTERS[0]
  const [doseKind, reviewKind, handoverKind] = LATE_FILTERS.filter(
    (entry) => entry.id !== 'everything',
  ).map((entry) => ofKind(lateItems, entry.id).length)

  /* Each part of the figure, with its own scope, or why it is not counted. */
  const parts = [
    `${pluralise(doseKind ?? 0, 'dose')} missed today, of ${pluralise(todays.length, 'dose')} on today’s chart`,
    reviewing.kind === 'yes'
      ? `${pluralise(reviewKind ?? 0, 'review')} past its date`
      : `Reviews are not counted: ${reasonOf(reviewing)}`,
    data.unsigned === 'no_board'
      ? 'No handover board at this home, so no handover is counted'
      : signing.kind === 'yes'
        ? `${pluralise(handoverKind ?? 0, 'handover')} from today not countersigned`
        : `Handovers are not counted: ${reasonOf(signing)}`,
  ]

  return (
    <>
      <div className={styles.lead}>
        <ActionCard
          kicker="Already late"
          figure={formatCount(lateItems.length)}
          of={`${lateItems.length === 1 ? 'thing' : 'things'} late that you can act on now`}
          detail={
            <ul className={styles.items}>
              {parts.map((part) => (
                <li key={part}>{part}</li>
              ))}
            </ul>
          }
          footLabel="Read in this order"
          footValue="Longest past its date first"
          action={
            lateItems.length === 0 ? (
              <span>Nothing is late for you to act on</span>
            ) : (
              <button
                type="button"
                className={`${styles.cardAction} ${shell.press}`}
                onClick={() =>
                  document
                    .getElementById(LATE_ID)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                See the {formatCount(lateItems.length)} late
              </button>
            )
          }
        />
      </div>
      <p className={`${styles.quiet} ${styles.gutter}`}>
        {scopeNote(viewer.scope, activeSite.name)}
      </p>

      <div className={styles.tiles}>
        <Tile
          label="Due now or in the next 2 hours"
          figure={formatCount(soon.doses)}
          of={`of ${pluralise(todays.length, 'dose')} on today’s chart, nothing recorded yet`}
        />
        <Tile
          label="Not written up today"
          figure={
            quiet === 0 ? (
              formatCount(0)
            ) : (
              <Unrecorded variant="chip" label={formatCount(quiet)} />
            )
          }
          of={scopeDenominator(viewer.scope, mine.length, activeSite.name)}
        />
        <Tile
          label="Doses past their window"
          figure={
            pastWindow === 0 ? (
              formatCount(0)
            ) : (
              <Unrecorded variant="chip" label={formatCount(pastWindow)} />
            )
          }
          of={`of ${pluralise(todays.length, 'dose')} on today’s chart`}
        />
      </div>

      <section id={LATE_ID} aria-labelledby={`${LATE_ID}-title`}>
        <div className={styles.sectionHead}>
          <h2 id={`${LATE_ID}-title`} className={styles.sectionTitle}>
            Already late, oldest first
          </h2>
          <button
            type="button"
            className={`${styles.filterButton} ${shell.press}`}
            aria-haspopup="dialog"
            onClick={() => setPicking(true)}
          >
            {chosen?.label}
            <Icon name={phoneIcons.choose} size={16} />
          </button>
        </div>
        {lateItems.length === 0 ? (
          <p className={`${styles.quiet} ${styles.gutter}`}>
            Nothing is past its date.
          </p>
        ) : shown.length === 0 ? (
          <p className={`${styles.quiet} ${styles.gutter}`}>
            Nothing under {chosen?.label}, out of {formatCount(lateItems.length)} late.
          </p>
        ) : (
          <ul className={styles.list}>
            {shown.map((item) => (
              <li key={item.id}>
                <LateRow item={item} about={about.get(item.id)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={picking} onOpenChange={setPicking} title="Show" cancel="Done">
        <ul className={styles.items}>
          {LATE_FILTERS.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                className={[
                  styles.option,
                  shell.press,
                  entry.id === filter ? styles.optionChosen : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={entry.id === filter}
                onClick={() => {
                  setFilter(entry.id)
                  setPicking(false)
                }}
              >
                <span>{entry.label}</span>
                <span className={styles.quiet}>
                  {formatCount(ofKind(lateItems, entry.id).length)} of{' '}
                  {formatCount(lateItems.length)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}

function LateRow({ item, about }: { item: LateItem; about: ResidentId | undefined }) {
  const content = (
    <>
      <span className={styles.rowText}>
        <span className={styles.rowName}>{item.what}</span>
        <span className={styles.rowMeta}>{item.who}</span>
      </span>
      <span className={styles.lateWhen}>
        {item.daysLate > 0 ? `${formatLateness(item.daysLate)} past` : 'Today'}
      </span>
      {about === undefined ? null : (
        <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
      )}
    </>
  )
  /* A handover belongs to a shift, not a person, and has no record to push. */
  return about === undefined ? (
    <div className={styles.row}>{content}</div>
  ) : (
    <StackLink
      to={{ kind: 'record', id: about }}
      className={`${styles.row} ${shell.pressRow}`}
    >
      {content}
    </StackLink>
  )
}

function Tile({ label, figure, of }: { label: string; figure: ReactNode; of: string }) {
  return (
    <div className={styles.tile}>
      <p className={styles.tileLabel}>{label}</p>
      <p className={styles.tileFigure}>{figure}</p>
      <p className={styles.tileOf}>{of}</p>
    </div>
  )
}

/**
 * Nothing is counted for a reader nobody has given a list: the figures would be
 * the home's, and this screen is meant to be theirs.
 */
function NothingCounted({ atHome }: { atHome: number }) {
  const { activeSite } = useSession()
  const nav = usePhoneNav()
  return (
    <div className={styles.card}>
      <Unrecorded
        variant="panel"
        label={noListYetLine}
        detail={`${activeSite.name} has ${pluralise(atHome, VOCABULARY.subject.one, VOCABULARY.subject.many)}. Until somebody gives you a list, nothing here is counted for you.`}
      />
      <button
        type="button"
        className={`${styles.pill} ${shell.press}`}
        onClick={() => nav.switchTab('people')}
      >
        Find somebody in {VOCABULARY.subject.Many}
      </button>
    </div>
  )
}

/**
 * A day of omissions, enough to hold all of today in the home's zone: today's
 * are picked out by their date, and nothing older is read.
 */
function aDayBefore(at: IsoDateTime): IsoDateTime {
  return new Date(new Date(at).getTime() - 86_400_000).toISOString() as IsoDateTime
}

/** The role table's line for an act this reader may not take. */
function reasonOf(answer: Exclude<Answer, { kind: 'yes' }>): string {
  switch (answer.kind) {
    case 'not_your_role':
    case 'not_the_author':
      return answer.reason
    case 'not_stated':
    case 'contradicted':
      return answer.question
    case 'not_on_your_list':
    case 'no_list_yet':
      return noListYetLine
    default:
      return assertNever(answer)
  }
}
