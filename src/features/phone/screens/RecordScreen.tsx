import { useCallback, useState } from 'react'
import { getCareNotes, getMarRecords, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { AllergyStatus, CareNote, IsoDateTime, ResidentId } from '@/data/types'
import type { Answer } from '@/app/session/capabilities'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import { ActLine, Avatar } from '@/components/primitives'
import { NAV_ITEMS, type NavItem } from '@/components/shell/nav.icons'
import { StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { NOTHING_OUTSTANDING, OutstandingLine } from '../OutstandingLine'
import { outstandingFor, type Outstanding } from '../outstanding'
import {
  listName,
  noListYetLine,
  notOnYourListLine,
  type DoseRecord,
  type Person,
} from '../phone-data'
import { phoneIcons } from '../phone.icons'
import { Loaded } from '../ScreenStates'
import { Screen } from '../shell/Screen'
import shell from '../shell/shell.module.css'
import styles from '../phone.module.css'

interface RecordData {
  person: Person
  records: DoseRecord[]
  notes: CareNote[]
}

/**
 * One person's record, pushed over the list it was opened from.
 *
 * **The subject header never scrolls away** (CLAUDE.md §2). The name is the
 * bar's title, small beside the back chevron, and the block under the bar
 * leads with what the bar does not say: photo, preferred name, room and date
 * of birth. Both sit outside the pane, so all five stay on screen together;
 * the name is said once. **Who it
 * is comes from the place on the stack**, which came from the row tapped or the
 * address, never from what was on screen before.
 *
 * Then: allergies with their severity, what is outstanding today, and the rest
 * of the record as rows saying they are not built. The one primary act, a care
 * note, is anchored at the bottom and says it is not built yet, at the act.
 *
 * **Asked of the role table before anything is read beyond the name.**
 */
export function RecordScreen({ id }: { id: ResidentId }) {
  const { activeSite } = useSession()
  const viewer = useViewer()
  const [at] = useState(() => now().toISOString() as IsoDateTime)
  const answer = viewer.ask('open_resident_record', id)
  const opens = answer.kind === 'yes'

  const load = useCallback(
    () =>
      opens
        ? Promise.all([
            getResident(id),
            getMarRecords(id).then(({ records }) => records),
            getCareNotes(id),
          ]).then(([person, records, notes]): RecordData => ({
            person,
            records,
            notes,
          }))
        : getResident(id).then((person): RecordData => ({
            person,
            records: [],
            notes: [],
          })),
    [id, opens],
  )
  const resource = useResource<RecordData>(load, [id, opens])
  const ready = resource.kind === 'ready' ? resource.data : undefined

  return (
    <Screen
      title={
        ready === undefined
          ? VOCABULARY.subject.One
          : opens
            ? ready.person.fullLegalName
            : listName(ready.person)
      }
      subject={
        ready !== undefined && opens ? (
          <SubjectHeader person={ready.person} />
        ) : undefined
      }
      primary={
        opens && ready !== undefined ? (
          <CareNoteAct id={id} name={listName(ready.person)} />
        ) : undefined
      }
    >
      <Loaded
        resource={resource}
        loading={`Loading the ${VOCABULARY.subject.ones} record…`}
        failed={`The ${VOCABULARY.subject.ones} record could not be loaded`}
      >
        {(data) =>
          answer.kind !== 'yes' ? (
            <NotOnYourListCard answer={answer} name={listName(data.person)} />
          ) : (
            <>
              <Allergies status={data.person.allergies} />
              <section className={styles.card}>
                <h2 className={styles.cardTitle}>Outstanding today</h2>
                <OutstandingToday
                  items={outstandingFor({
                    person: data.person,
                    records: data.records,
                    notes: data.notes,
                    timeZone: activeSite.timeZone,
                    at,
                  })}
                />
              </section>
              <TheRest />
            </>
          )
        }
      </Loaded>
    </Screen>
  )
}

function SubjectHeader({ person }: { person: Person }) {
  return (
    <div className={styles.subject} data-subject-header>
      <Avatar photo={person.photo} name={person.fullLegalName} size="medium" />
      <div className={styles.subjectText}>
        <p className={styles.subjectFacts}>
          <span>Known as {person.preferredName}</span>
          {person.room.kind === 'recorded' ? (
            <span>Room {person.room.value}</span>
          ) : (
            <Unrecorded label="Room not recorded" />
          )}
          <span>Born {formatDate(person.dateOfBirth)}</span>
        </p>
      </div>
    </div>
  )
}

/**
 * The primary act, in the thumb zone. **The line saying what it does not do
 * sits at the act**, not behind a tap (CLAUDE.md §6): the composer is not
 * built, and where the role table refuses, its words say so instead.
 */
function CareNoteAct({ id, name }: { id: ResidentId; name: string }) {
  const viewer = useViewer()
  const answer = viewer.ask('write_care_note', id)
  if (answer.kind !== 'yes')
    return (
      <ActLine
        kind={
          answer.kind === 'not_stated' || answer.kind === 'contradicted'
            ? 'not_stated'
            : 'refused'
        }
      >
        {refusalOf(answer, name)}
      </ActLine>
    )
  return (
    <>
      <ActLine kind="not_built">
        The care note composer is not built yet on the phone.
      </ActLine>
      <button type="button" className={shell.primary} aria-disabled="true">
        Write a care note
      </button>
    </>
  )
}

/**
 * Allergies, in the three states the record holds. **Nobody asked takes the
 * hatch; a recorded "none known" is quiet**, with who and when; **an allergy is
 * critical**, with its severity as a word beside the substance.
 */
function Allergies({ status }: { status: AllergyStatus }) {
  const format = useSiteFormat()
  const recorded = (by: string, at: IsoDateTime) =>
    `Recorded ${format.instantDate(at)} · ${by}`
  const body = () => {
    switch (status.kind) {
      case 'not_recorded':
        return (
          <Unrecorded
            variant="phonePanel"
            label="Not recorded"
            detail="Nobody has recorded whether they have any allergies. That is not the same as none."
          />
        )
      case 'none_known':
        return (
          <div className={styles.item}>
            <p className={styles.value}>No known allergies</p>
            <p className={styles.byline}>
              {recorded(status.recordedBy.displayName, status.recordedAt)}
            </p>
          </div>
        )
      case 'allergies':
        return (
          <>
            <ul className={styles.items}>
              {status.items.map((allergy) => (
                <li key={allergy.substance} className={styles.item}>
                  <StatusPill
                    tone="critical"
                    label={allergy.substance}
                    detail={SEVERITY[allergy.severity]}
                  />
                  <span className={styles.quiet}>Reaction: {allergy.reaction}</span>
                </li>
              ))}
            </ul>
            <p className={styles.byline}>
              {recorded(status.recordedBy.displayName, status.recordedAt)}
            </p>
          </>
        )
      default:
        return assertNever(status)
    }
  }
  return (
    <section className={styles.card} data-allergies={status.kind}>
      <h2 className={styles.cardTitle}>Allergies</h2>
      {body()}
    </section>
  )
}

const SEVERITY: Record<'mild' | 'moderate' | 'severe' | 'anaphylaxis', string> = {
  mild: 'Mild',
  moderate: 'Moderate',
  severe: 'Severe',
  anaphylaxis: 'Anaphylaxis',
}

function OutstandingToday({ items }: { items: Outstanding[] }) {
  if (items.length === 0) return <p className={styles.quiet}>{NOTHING_OUTSTANDING}</p>
  return (
    <ul className={styles.items}>
      {items.map((item) => (
        <li
          key={`${item.kind}-${'round' in item ? item.round : 'note'}`}
          className={styles.item}
        >
          <OutstandingLine item={item} size="record" />
        </li>
      ))}
    </ul>
  )
}

/**
 * The rest of the record, listed rather than left out and not drawn as
 * controls: no chevron, no target, "Not built yet" on each. Named by their
 * owners — the desktop navigation, and the vocabulary for medication and the
 * care plan.
 */
function TheRest() {
  const fromNav = (picked: (item: NavItem) => boolean) =>
    NAV_ITEMS.filter(picked).map((item) => ({ label: item.label, icon: item.icon }))
  const rows: { label: string; icon: IconName }[] = [
    ...fromNav((item) => item.module === 'care-notes'),
    { label: VOCABULARY.medication.Many, icon: phoneIcons.dose },
    { label: VOCABULARY.carePlan.One, icon: phoneIcons.carePlan },
    ...fromNav((item) => item.section === 'records'),
  ]
  return (
    <section aria-labelledby="the-rest">
      <div className={styles.sectionHead}>
        <h2 id="the-rest" className={styles.sectionTitle}>
          The rest of the record
        </h2>
      </div>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.label} className={styles.moduleRow}>
            <Icon name={row.icon} size={20} />
            <span className={styles.moduleName}>{row.label}</span>
            <span className={styles.notBuilt}>Not built yet</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * A record the reader's list does not reach: who, by name, and nothing else.
 * Neither the hatch nor caution: nothing is missing and nothing is wrong.
 */
function NotOnYourListCard({
  answer,
  name,
}: {
  answer: Exclude<Answer, { kind: 'yes' }>
  name: string
}) {
  const viewer = useViewer()
  const setting = viewer.ask('open_settings_and_team')
  return (
    <div className={styles.card} data-not-on-list={answer.kind}>
      <p className={styles.cardTitle}>{refusalOf(answer, name)}</p>
      <p className={styles.body}>
        Their record does not open for you. Your list is set in Team Management.
      </p>
      {setting.kind === 'not_your_role' ? (
        <ActLine kind="refused">{setting.reason}</ActLine>
      ) : null}
    </div>
  )
}

function refusalOf(answer: Exclude<Answer, { kind: 'yes' }>, name: string): string {
  switch (answer.kind) {
    case 'not_on_your_list':
      return notOnYourListLine(name)
    case 'no_list_yet':
      return noListYetLine
    case 'not_your_role':
    case 'not_the_author':
      return answer.reason
    case 'not_stated':
    case 'contradicted':
      return answer.question
    default:
      return assertNever(answer)
  }
}
