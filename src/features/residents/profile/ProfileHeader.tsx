import Link from 'next/link'
import type { CareNote, IsoDateTime } from '@/data/types'
import { CARE_NOTE_CATEGORIES } from '@/data/types'
import type { DueMedication } from '@/data/access/client'
import { staffLabel } from '@/data/access/team-store'
import { now } from '@/data/fixtures/clock'
import {
  ActLine,
  Avatar,
  Button,
  Card,
  CardHead,
  buttonClassName,
} from '@/components/primitives'
import {
  MoodBadge,
  NeverWrittenUp,
  ReviewBadge,
  StatusPill,
  Unrecorded,
} from '@/components/status'
import { ActionCard } from '@/components/layout/ActionCard'
import { Icon } from '@/components/icon/Icon'
import { useSiteFormat } from '@/app/session/use-session'
import { ageFrom, formatCount, formatDate, pluralise } from '@/lib/format'
import { MEDICATION_LOOKAHEAD_HOURS } from '@/lib/shift'
import type { OpenRecord } from './ProfileContext'
import { BadgeStrip } from './BadgeStrip'
import { profileIcons } from './profile.icons'
import styles from './profile.module.css'

/**
 * The head of a resident's record. RES-02.
 *
 * Ordered by when somebody needs it: who this is and who to call, the five risk
 * flags to know before going into the room, then what is due, what was last
 * written and when the plan is next reviewed.
 *
 * **One dark card: the medication due.** It is the thing on this head somebody
 * acts on next, so it carries the largest figure, and the figure says what it
 * is out of.
 */
export function ProfileHeader({ record }: { record: OpenRecord }) {
  const { resident, site, latestNote, dueSoon, medications } = record
  const format = useSiteFormat()
  const gp = resident.gp
  const nextOfKin = resident.importantPeople.nextOfKin

  return (
    <header className={styles.head}>
      <Card>
        <div className={styles.identity}>
          <Avatar photo={resident.photo} name={resident.fullLegalName} size="xlarge" />
          <div className={styles.who}>
            <h1 className={styles.preferredName}>{resident.preferredName}</h1>
            <p className={styles.legalName}>{resident.fullLegalName}</p>
            <p className={styles.facts}>
              <span>
                Room{' '}
                {resident.room.kind === 'recorded' ? (
                  resident.room.value
                ) : (
                  <Unrecorded label="Room not recorded" />
                )}
              </span>
              <span data-numeric>
                Born {formatDate(resident.dateOfBirth)} (
                {ageFrom(resident.dateOfBirth, now())})
              </span>
              <span>{site.name}</span>
            </p>
          </div>

          <div className={styles.contacts}>
            {gp.kind === 'recorded' ? (
              <span className={styles.gp} data-gp="recorded">
                <span className={styles.contactRole}>GP</span> {gp.value.name}
                <span className={styles.contactQuiet}> · {gp.value.practice}</span>
              </span>
            ) : (
              <Unrecorded label="GP not recorded" />
            )}

            {nextOfKin.kind === 'recorded' ? (
              <div className={styles.kin} data-next-of-kin>
                <p className={styles.kinText}>
                  <span className={styles.contactRole}>
                    Next of kin · {nextOfKin.value.relationship}
                  </span>{' '}
                  <span className={styles.kinName}>{nextOfKin.value.name}</span>{' '}
                  <span className={styles.contactQuiet} data-numeric>
                    {nextOfKin.value.contact.phone}
                  </span>
                </p>
                <div className={styles.call}>
                  <Button variant="secondary" size="small">
                    <Icon name={profileIcons.call} size={16} />
                    Call {nextOfKin.value.name.split(/\s+/)[0]}
                  </Button>
                  <ActLine kind="not_built">
                    Calling is not built: this is a design specification.
                  </ActLine>
                </div>
              </div>
            ) : (
              <Unrecorded label="Next of kin not recorded" />
            )}
          </div>
        </div>
      </Card>

      <Card>
        <CardHead
          title="Risk flags"
          subtitle="All five, always shown. Hatched means nobody has recorded it."
          expand={{ kind: 'link', href: `/residents/${resident.id}/risk-assessments` }}
        />
        <BadgeStrip resident={resident} />
      </Card>

      <div className={styles.routine}>
        <div className={styles.dueSlot}>
          <ActionCard
            kicker={`Medication due · next ${pluralise(MEDICATION_LOOKAHEAD_HOURS, 'hour')}`}
            figure={formatCount(dueSoon.length)}
            of={`of ${pluralise(medications.length, 'medicine')} prescribed for ${resident.preferredName}`}
            detail={dueSoon.length === 0 ? undefined : <DueList due={dueSoon} />}
            footLabel={dueSoon.length === 0 ? 'Checked against' : 'First window closes'}
            footValue={
              dueSoon.length === 0
                ? `${possessive(resident.preferredName)} current rounds`
                : firstCloses(dueSoon, format.time)
            }
            action={
              <Link
                href={`/residents/${resident.id}/medications`}
                className={buttonClassName({ variant: 'secondary' })}
              >
                Open medications
              </Link>
            }
          />
        </div>

        <Card className={styles.routineCard}>
          <CardHead
            title="Last care note"
            expand={{ kind: 'link', href: `/residents/${resident.id}/notes` }}
          />
          <LastNote note={latestNote} />
        </Card>

        <Card className={styles.routineCard}>
          <CardHead
            title="Care plan review"
            expand={{ kind: 'link', href: `/residents/${resident.id}/care-plan` }}
          />
          <ReviewBadge state={resident.carePlanReview} emphasis="compact" />
        </Card>
      </div>
    </header>
  )
}

const possessive = (name: string): string => `${name}’s`

/**
 * When the earliest due window closes. Every entry is in an open window, by the
 * loader, so when it opened has passed and is not what somebody acts on.
 */
function firstCloses(due: DueMedication[], time: (at: IsoDateTime) => string): string {
  const closes = due.flatMap(({ record }) =>
    record.state.kind === 'due' ? [record.state.windowClosesAt] : [],
  )
  const first = [...closes].sort()[0]
  if (first !== undefined) return time(first)
  throw new Error('Medication due soon held no dose in a due window.')
}

function DueList({ due }: { due: DueMedication[] }) {
  const format = useSiteFormat()
  return (
    <ul className={styles.dueList}>
      {due.map(({ medication, record }) => (
        <li key={`${medication.id}-${record.roundTime}`} className={styles.dueItem}>
          <span className={styles.dueName}>
            {medication.name} {medication.dose}
          </span>
          <span className={styles.dueMeta}>
            {record.state.kind === 'due'
              ? `${format.time(record.state.windowOpensAt)} to ${format.time(record.state.windowClosesAt)}`
              : record.roundTime}{' '}
            · {medication.route}
          </span>
          {medication.isControlledDrug ? (
            <StatusPill tone="critical" label="Controlled drug" />
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function LastNote({ note }: { note: CareNote | 'none' }) {
  const format = useSiteFormat()
  if (note === 'none') return <NeverWrittenUp variant="panel" />
  const category = CARE_NOTE_CATEGORIES.find((entry) => entry.id === note.category)
  return (
    <div className={styles.note}>
      <p className={styles.noteBody}>{note.body}</p>
      <p className={styles.noteMeta}>
        <span>{category === undefined ? note.category : category.name}</span>
        <span data-numeric>
          {format.dateTime(note.recordedAt)} · {format.relative(note.recordedAt)}
        </span>
        <span>{staffLabel(note.recordedBy)}</span>
        <MoodBadge mood={note.mood} />
      </p>
    </div>
  )
}
