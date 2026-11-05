import { useCallback, useState } from 'react'
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
import type { IconName } from '@/components/icon/registry.names.generated'
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
import {
  formatCount,
  formatDate,
  formatLateness,
  formatTime,
  pluralise,
  zonedDate,
} from '@/lib/format'
import { SHIFT_NAMES, shiftAt } from '@/lib/shift'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { assertNever } from '@/lib/assert-never'
import {
  noListYetLine,
  scopeDenominator,
  scopeNote,
  scopeReaches,
  scopeShort,
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
 * today.** Four cards, one figure each, with what it is out of; a card whose
 * subject is a gap is hatched. Then the acts, in a rail. Then the late list as
 * a timeline, oldest first, each entry pushing the record it is about; its
 * filter is a picker, so a sheet. No dark card: the phone is exempt
 * (docs/PHONE_VISUAL_BASELINE.md).
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
        <MovedClockLine form="phone" />
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
  const [counting, setCounting] = useState(false)
  const nav = usePhoneNav()

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

  /*
   * Each part of the figure, with its own scope, or why it is not counted.
   * **The summary line and the sheet are both read off this list**, so the
   * count of what is left out cannot disagree with the sentences saying so.
   */
  const parts: { text: string; counted: boolean }[] = [
    {
      text: `${pluralise(doseKind ?? 0, 'dose')} missed today, of ${pluralise(todays.length, 'dose')} on today’s chart`,
      counted: true,
    },
    reviewing.kind === 'yes'
      ? { text: `${pluralise(reviewKind ?? 0, 'review')} past its date`, counted: true }
      : { text: `Reviews are not counted: ${reasonOf(reviewing)}`, counted: false },
    data.unsigned === 'no_board'
      ? {
          text: 'No handover board at this home, so no handover is counted',
          counted: false,
        }
      : signing.kind === 'yes'
        ? {
            text: `${pluralise(handoverKind ?? 0, 'handover')} from today not countersigned`,
            counted: true,
          }
        : { text: `Handovers are not counted: ${reasonOf(signing)}`, counted: false },
  ]
  const leftOut = parts.filter((part) => !part.counted).length
  /* The scope is said even when nothing is left out: it is never implied. */
  const summary = `${scopeShort(viewer.scope, activeSite.name)} · ${
    leftOut === 0 ? 'nothing left out' : `${pluralise(leftOut, 'thing')} not counted`
  }`

  return (
    <>
      <div className={styles.stats}>
        <Stat
          icon={phoneIcons.late}
          label="Already late"
          figure={formatCount(lateItems.length)}
          of={`${lateItems.length === 1 ? 'thing' : 'things'} late that you can act on now`}
        />
        <Stat
          icon={phoneIcons.dose}
          label="Due now or in the next 2 hours"
          figure={formatCount(soon.doses)}
          of={`of ${pluralise(todays.length, 'dose')} on today’s chart, nothing recorded yet`}
        />
        <Stat
          icon={phoneIcons.notWritten}
          label="Not written up today"
          figure={formatCount(quiet)}
          of={scopeDenominator(viewer.scope, mine.length, activeSite.name)}
          gap={quiet > 0}
        />
        <Stat
          icon={phoneIcons.pastWindow}
          label="Doses past their window"
          figure={formatCount(pastWindow)}
          of={`of ${pluralise(todays.length, 'dose')} on today’s chart`}
          gap={pastWindow > 0}
        />
      </div>
      <button
        type="button"
        className={`${styles.summary} ${shell.press}`}
        aria-haspopup="dialog"
        onClick={() => setCounting(true)}
      >
        <span>{summary}</span>
        <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
      </button>

      <div className={styles.rail}>
        {lateItems.length === 0 ? null : (
          <button
            type="button"
            className={`${styles.act} ${shell.press}`}
            onClick={() =>
              document
                .getElementById(LATE_ID)
                ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            <Icon name={phoneIcons.late} size={20} className={styles.actIcon} />
            See the {formatCount(lateItems.length)} late
          </button>
        )}
        <button
          type="button"
          className={`${styles.act} ${shell.press}`}
          onClick={() => nav.switchTab('people')}
        >
          <Icon name={phoneIcons.people} size={20} className={styles.actIcon} />
          Find somebody in {VOCABULARY.subject.Many}
        </button>
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
        {/* The sort is said only over rows it sorts. An empty list is one
            sentence: the scoped one, since what is not counted may still be
            past its date. */}
        {lateItems.length === 0 ? null : (
          <p className={`${styles.byline} ${styles.gutter}`}>
            Read in this order · Longest past its date first
          </p>
        )}
        {lateItems.length === 0 ? (
          <p className={`${styles.quiet} ${styles.gutter}`}>
            Nothing is late for you to act on
          </p>
        ) : shown.length === 0 ? (
          <p className={`${styles.quiet} ${styles.gutter}`}>
            Nothing under {chosen?.label}, out of {formatCount(lateItems.length)} late.
          </p>
        ) : (
          <ol className={styles.timeline}>
            {shown.map((item) => (
              <li key={item.id} className={styles.when}>
                <span className={styles.whenRail}>
                  <span className={styles.whenPill}>
                    {/* A review or a handover falls due on a day; a dose at a time. */}
                    {item.kind === 'review' || item.kind === 'handover'
                      ? formatDate(item.dueAt.slice(0, 10) as IsoDate)
                      : formatTime(item.dueAt, activeSite.timeZone)}
                  </span>
                  <span className={styles.whenLine} aria-hidden="true" />
                </span>
                <LateEntry item={item} about={about.get(item.id)} />
              </li>
            ))}
          </ol>
        )}
      </section>

      <Sheet
        open={counting}
        onOpenChange={setCounting}
        title="What is counted"
        cancel="Done"
      >
        <ul className={styles.parts}>
          {parts.map((part) => (
            <li key={part.text}>{part.text}</li>
          ))}
        </ul>
        <p className={styles.quiet}>{scopeNote(viewer.scope, activeSite.name)}</p>
      </Sheet>

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

/** One late thing, as the card beside its time on the timeline. */
function LateEntry({ item, about }: { item: LateItem; about: ResidentId | undefined }) {
  const content = (
    <>
      <span className={styles.rowText}>
        <span className={styles.whenTitle}>{item.what}</span>
        <span className={styles.rowMeta}>{item.who}</span>
        <span className={styles.lateWhen}>
          {item.daysLate > 0 ? `${formatLateness(item.daysLate)} past` : 'Today'}
        </span>
      </span>
      {about === undefined ? null : (
        <Icon name={phoneIcons.open} size={16} className={styles.rowChevron} />
      )}
    </>
  )
  /* A handover belongs to a shift, not a person, and has no record to push. */
  return about === undefined ? (
    <div className={styles.whenCard}>{content}</div>
  ) : (
    <StackLink
      to={{ kind: 'record', id: about }}
      className={`${styles.whenCard} ${shell.press}`}
    >
      {content}
    </StackLink>
  )
}

/**
 * One figure on a card, with what it is out of. **A card whose subject is a
 * gap is hatched**, the whole card rather than a chip inside it, and its label
 * says what is missing. A zero is a finding and is never hatched.
 */
function Stat({
  icon,
  label,
  figure,
  of,
  gap = false,
}: {
  icon: IconName
  label: string
  figure: string
  of: string
  gap?: boolean
}) {
  return (
    <div
      className={gap ? styles.statGap : styles.stat}
      data-stat
      data-state={gap ? 'unrecorded' : undefined}
    >
      <span className={styles.statTop}>
        <span className={styles.statIcon}>
          <Icon name={icon} size={20} />
        </span>
        <span className={styles.statLabel}>{label}</span>
      </span>
      <span className={styles.statFigure} data-numeric>
        {figure}
      </span>
      <span className={styles.statOf}>{of}</span>
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
        variant="phonePanel"
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
