import { Button, Card, CardHead } from '@/components/primitives'
import { PageHead } from '@/components/layout/PageHead'
import { ActionCard } from '@/components/layout/ActionCard'
import { RoundColumns } from '@/components/charts/RoundColumns'
import { AggregateFigure, GapCount, StatusPill, Unrecorded } from '@/components/status'
import { NavPill } from '@/components/shell/NavPill'
import styles from './specimens.module.css'

/**
 * The shape language, drawn by the components the screens use: the page head,
 * cards with their expand button, the one dark card, the hatched gap card, a
 * figure with what it is out of, round columns, status pills and the chrome.
 *
 * **Every figure here is illustrative and every one still carries what it is
 * out of**, because a specimen with a bare number would teach the shape the
 * build forbids.
 */
export function ShapesSheet() {
  return (
    <div className={styles.sheet}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Page head</h2>
        <p className={styles.sectionNote}>
          Personal: a greeting with the first name, the shift and the list beneath, the
          primary act as a pill on the right.
        </p>
        <PageHead
          title="Good evening"
          emphasis="Kwame"
          lines={[
            'Late shift',
            '14:00 to 21:00',
            'Rosewood Court',
            '9 residents on your list',
          ]}
          aside="Tuesday 16 Sep · 20:20"
          action={<Button size="large">Write a care note</Button>}
        />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Chrome</h2>
        <p className={styles.sectionNote}>
          Fully rounded. The navigation pill is a grey track with no thumb: the tab you
          are on reads by weight and ink. A raised white thumb means a segmented
          control.
        </p>
        <div className={styles.scrollX}>
          <NavPill />
        </div>
      </section>

      <div className={styles.cards}>
        <ActionCard
          kicker="Your next round"
          figure="20:00"
          of="14 doses across 9 residents"
          footLabel="Window closes"
          footValue="21:00 · in 40 min"
          action={
            <Button size="large" variant="secondary">
              Start the round
            </Button>
          }
        />

        <Card>
          <CardHead
            title="Doses this shift"
            subtitle="Yours to give, since 14:00."
            expand={{ kind: 'not_built' }}
          />
          <AggregateFigure
            caption="Doses given"
            aggregate={{
              kind: 'measured',
              unit: 'count',
              value: 23,
              coverage: { covered: 23, total: 37 },
            }}
            denominatorNoun="doses due"
            relation="of"
            emphasis="lead"
            note="14 still to give. Nothing here is late yet."
          />
        </Card>

        <GapCount
          label="Not written up"
          value={4}
          of="of your 9 residents"
          detail="Nobody has recorded a care note for them today. Counted over your list, not the home's."
        />
      </div>

      <div className={styles.cards}>
        <Card className={styles.wide}>
          <CardHead
            title="Your rounds today"
            subtitle="Solid is recorded. Hatched is due and not recorded."
            expand={{ kind: 'not_built' }}
          />
          <RoundColumns
            columns={[
              {
                round: '08:00',
                recorded: 13,
                dueNotRecorded: 2,
                total: 22,
                current: false,
              },
              {
                round: '14:00',
                recorded: 15,
                dueNotRecorded: 1,
                total: 20,
                current: false,
              },
              {
                round: '18:00',
                recorded: 9,
                dueNotRecorded: 4,
                total: 19,
                current: false,
              },
              {
                round: '20:00',
                recorded: 2,
                dueNotRecorded: 12,
                total: 14,
                current: true,
              },
            ]}
          />
        </Card>

        <Card>
          <CardHead
            title="Status pills"
            subtitle="Tint and ink, a dot, never the fill."
            expand={{ kind: 'not_built' }}
          />
          <div className={styles.stack}>
            <StatusPill tone="critical" label="Dose overdue" />
            <StatusPill tone="positive" label="Up to date" />
            <StatusPill tone="caution" label="Dose due 20:00" />
            <StatusPill tone="brand" label="DNAR in place" />
            <Unrecorded variant="badge" label="Not written up today" />
          </div>
        </Card>
      </div>
    </div>
  )
}
