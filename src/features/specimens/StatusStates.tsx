import type { ReactNode } from 'react'
import type { Aggregate } from '@/data/types'
import {
  AggregateFigure,
  NeverWrittenUp,
  Settled,
  StatusPill,
  Unrecorded,
} from '@/components/status'
import styles from './specimens.module.css'

/**
 * The evidence treatments side by side: what a gap looks like against what a
 * settled record looks like, in every form either takes.
 *
 * **The pairs are the point.** A recorded negative and an unrecorded value must
 * never be able to look the same, and the only way to check that is to put
 * them next to each other and look, in colour and in greyscale.
 */

function Pair({
  title,
  recorded,
  unrecorded,
}: {
  title: string
  recorded: ReactNode
  unrecorded: ReactNode
}) {
  return (
    <div className={styles.group}>
      <span className={styles.groupTitle}>{title}</span>
      <div className={styles.compare}>
        <div className={styles.compareCell}>
          <span className={styles.compareLabel}>Recorded</span>
          {recorded}
        </div>
        <div className={styles.compareCell}>
          <span className={styles.compareLabel}>Nobody has recorded it</span>
          {unrecorded}
        </div>
      </div>
    </div>
  )
}

const AGGREGATES: { caption: string; noun: string; aggregate: Aggregate }[] = [
  {
    caption: 'Care notes today',
    noun: 'residents',
    aggregate: {
      kind: 'measured',
      unit: 'count',
      value: 27,
      coverage: { covered: 27, total: 28 },
    },
  },
  {
    caption: 'Doses recorded this week',
    noun: 'doses due',
    aggregate: {
      kind: 'measured',
      unit: 'percentage',
      value: 92,
      coverage: { covered: 1045, total: 1136 },
    },
  },
  {
    caption: 'Falls risk',
    noun: 'residents',
    aggregate: {
      kind: 'insufficient_evidence',
      coverage: { covered: 4, total: 28 },
      missingDescription: 'Falls risk assessments are largely incomplete:',
    },
  },
]

export function StatusStates() {
  return (
    <div className={styles.sheet}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recorded against unrecorded</h2>
        <p className={styles.sectionNote}>
          A recorded negative looks settled. An unrecorded one looks unfinished: dashed
          border, diagonal hatch, and words saying what is missing.
        </p>
        <Pair
          title="Badge"
          recorded={
            <Settled
              label="No known allergies"
              detail="Recorded by C. Nwosu, 12/03/2026"
            />
          }
          unrecorded={<Unrecorded variant="badge" label="Allergies not recorded" />}
        />
        <Pair
          title="Injury, after a fall"
          recorded={
            <Settled label="Checked: no injury found" detail="Somebody looked." />
          }
          unrecorded={
            <Unrecorded
              variant="chip"
              label="Not checked yet"
              detail="Nobody has examined them."
            />
          }
        />
        <Pair
          title="Flag, on the profile header"
          recorded={
            <StatusPill
              tone="brand"
              label="DNAR in place"
              detail="Dr A. Mensah, 04/02/2026"
              block
            />
          }
          unrecorded={
            <Unrecorded
              variant="flag"
              caption="Isolation"
              label="Not recorded"
              detail="Nobody has recorded a status."
            />
          }
        />
        <Pair
          title="Row, in a list"
          recorded={
            <Settled
              label="Falls risk: low"
              detail="Scored 15 by C. Nwosu, 02/07/2026"
            />
          }
          unrecorded={
            <Unrecorded
              variant="row"
              label="Never assessed: nobody has looked at this risk"
            />
          }
        />
        <Pair
          title="Panel"
          recorded={
            <Settled
              label="Care plan domain finalised"
              detail="M. Halloran, 19/08/2026"
            />
          }
          unrecorded={
            <Unrecorded
              variant="panel"
              caption="Continence"
              label="Not written yet"
              detail="This section of the care plan has not been written."
            />
          }
        />
        <Pair
          title="Care note"
          recorded={
            <Settled label="Written up today" detail="Last note 19:26 by S. Patel" />
          }
          unrecorded={<NeverWrittenUp variant="badge" />}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Recorded findings</h2>
        <p className={styles.sectionNote}>
          Colour is for a recorded finding. It is never spent on a gap, and never on a
          notice.
        </p>
        <div className={styles.row}>
          <StatusPill tone="positive" label="All well" />
          <StatusPill tone="caution" label="Needs attention" />
          <StatusPill tone="critical" label="Urgent" />
          <StatusPill tone="info" label="Due at 20:00" />
          <StatusPill tone="brand" label="DNAR in place" />
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Figures carry their denominator</h2>
        <div className={styles.row}>
          {AGGREGATES.map((entry) => (
            <div key={entry.caption} className={styles.figure}>
              <AggregateFigure
                caption={entry.caption}
                aggregate={entry.aggregate}
                denominatorNoun={entry.noun}
                emphasis="supporting"
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
