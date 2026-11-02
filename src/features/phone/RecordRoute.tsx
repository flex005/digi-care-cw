import { useParams, useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { getCareNotes, getMarRecords, getResident } from '@/data/access/client'
import { useResource } from '@/data/access/use-resource'
import { now } from '@/data/fixtures/clock'
import type { AllergyStatus, CareNote, IsoDateTime, ResidentId } from '@/data/types'
import { useSession, useSiteFormat } from '@/app/session/use-session'
import type { Answer } from '@/app/session/capabilities'
import { useViewer } from '@/app/session/use-viewer'
import { Icon } from '@/components/icon/Icon'
import type { IconName } from '@/components/icon/registry.names.generated'
import { ActLine, Avatar } from '@/components/primitives'
import { NAV_ITEMS, type NavItem } from '@/components/shell/nav.icons'
import { StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatDate } from '@/lib/format'
import { VOCABULARY } from '@/lib/vocabulary-choice'
import { NOTHING_OUTSTANDING, OutstandingLine } from './OutstandingLine'
import { outstandingFor, type Outstanding } from './outstanding'
import {
  listName,
  noListYetLine,
  notOnYourListLine,
  type DoseRecord,
  type Person,
} from './phone-data'
import { PHONE_PATHS } from './phone-paths'
import { phoneIcons } from './phone.icons'
import { Loaded } from './ScreenStates'
import styles from './phone.module.css'

interface RecordData {
  person: Person
  records: DoseRecord[]
  notes: CareNote[]
}

/**
 * One person's record, on a phone.
 *
 * **The subject header never scrolls away**: photo, name, preferred name, room
 * and date of birth, stuck under the bar, because every write this record will
 * grow is made under it and a wrong-subject write is the worst failure open to
 * it (CLAUDE.md §2). **Who it is comes from the address**, never from the list
 * it was opened from.
 *
 * Then, in the order somebody at the door needs them: allergies, with their
 * severity; what is outstanding today; and the rest of the record as rows that
 * say they are not built yet rather than looking as if they open.
 *
 * **Asked of the role table before anything is read beyond the name**: a
 * record off the reader's list shows that it is, by name, and nothing else.
 */
export function RecordRoute() {
  const params = useParams<{ residentId: string }>()
  const id = params.residentId as ResidentId
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

  return (
    <>
      <BackButton />
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
              <SubjectHeader person={data.person} />
              <Allergies status={data.person.allergies} />
              <section className={[styles.card, styles.cardPadded].join(' ')}>
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
    </>
  )
}

/**
 * Back to wherever the reader came from in this tab, or to their list when the
 * record was opened from a link. Navigation, not identity: the subject is the
 * address, whatever this does.
 */
function BackButton() {
  const router = useRouter()
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() =>
        window.history.length > 1 ? router.back() : router.push(PHONE_PATHS.yourList)
      }
    >
      <Icon name={phoneIcons.back} size={20} />
      Back
    </button>
  )
}

function SubjectHeader({ person }: { person: Person }) {
  return (
    <header className={styles.subject} data-subject-header>
      <Avatar photo={person.photo} name={person.fullLegalName} size="large" />
      <div className={styles.subjectText}>
        <h1 className={styles.subjectName}>{person.fullLegalName}</h1>
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
    </header>
  )
}

/**
 * Allergies, in the three states the record holds and never two.
 *
 * **Nobody asked takes the hatch. A recorded "none known" is quiet**, with who
 * recorded it and when, because it is a complete record and a green badge
 * would make it the loudest thing on a screen where nothing is wrong. **An
 * allergy is critical**, with its severity as a word beside the substance so
 * it is read rather than inferred from a colour.
 */
function Allergies({ status }: { status: AllergyStatus }) {
  const format = useSiteFormat()
  const recorded = (by: string, at: IsoDateTime) =>
    `Recorded ${format.instantDate(at)} · ${by}`

  return (
    <section
      className={[styles.card, styles.cardPadded].join(' ')}
      data-allergies={status.kind}
    >
      <h2 className={styles.cardTitle}>Allergies</h2>
      {(() => {
        switch (status.kind) {
          case 'not_recorded':
            return (
              <Unrecorded
                variant="panel"
                label="Not recorded"
                detail="Nobody has recorded whether they have any allergies. That is not the same as none."
              />
            )
          case 'none_known':
            return (
              <div className={styles.item}>
                <p className={styles.body}>No known allergies</p>
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
      })()}
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
 * The rest of the record, named and not yet reachable from the phone.
 *
 * **Listed rather than left out**, because absence from a list is the same bug
 * as a blank cell, and **not drawn as controls**: no chevron, no target, a
 * plain "Not built yet" on each.
 *
 * **Named by their owners**: care notes and the records section by the desktop
 * navigation, so the two products call each module the same thing, and
 * medication and the care plan by the vocabulary, which is what their names
 * are configured in.
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
    <section className={styles.card}>
      <h2 className={[styles.cardTitle, styles.cardHead].join(' ')}>
        The rest of the record
      </h2>
      <ul className={styles.rows}>
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
 *
 * **Scope, never blame, and never a claim the record is missing.** Neither the
 * hatch nor caution: nothing is missing and nothing is wrong. It says where a
 * list is set and, asked of the role table, that this reader cannot set it.
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
    <div
      className={[styles.card, styles.cardPadded].join(' ')}
      data-not-on-list={answer.kind}
    >
      <p className={styles.cardTitle}>{headline(answer, name)}</p>
      <p className={styles.body}>
        Their record does not open for you. Your list is set in Team Management.
      </p>
      {setting.kind === 'not_your_role' ? (
        <ActLine kind="refused">{setting.reason}</ActLine>
      ) : null}
    </div>
  )
}

function headline(answer: Exclude<Answer, { kind: 'yes' }>, name: string): string {
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
