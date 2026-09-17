import type { Resident } from '@/data/types'
import { Card, CardHead } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { Field, FieldList } from './FieldList'
import { FUTURE_PLANS_SECTIONS } from './future-plans-sections'
import styles from './people-and-plans.module.css'

/**
 * The Future Plans tab.
 *
 * **Read-only.** No decision here is changed from this build: the one act drawn
 * is editing the profile, and the role table answers it.
 *
 * The resuscitation decision is a panel, not a row. It is the only field on the
 * tab somebody reads in seconds, under pressure, and the only one whose
 * unrecorded state is itself an outcome: with no decision recorded, CPR is
 * attempted.
 *
 * Every entry shows who signed it, when, and which version, all visible.
 */
export function FuturePlansTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()

  return (
    <div className={styles.tabPanel}>
      <div className={styles.lead}>
        <p className={styles.tabIntro}>
          Recorded in advance, while this person could say what they wanted.
        </p>
        <ActPoint
          answer={viewer.ask('edit_resident_profile', resident.id)}
          label="Edit profile"
          notBuilt="Editing a profile is not built."
          residentName={resident.preferredName}
        />
      </div>
      <PlanSections resident={resident} />
    </div>
  )
}

/** Exported so the guard can iterate every resident against the real rendering. */
export function PlanSections({ resident }: { resident: Resident }) {
  return (
    <>
      {FUTURE_PLANS_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHead
            title={section.title}
            subtitle={section.description}
            expand={{ kind: 'whole' }}
          />
          <div className={styles.sectionBody}>
            {section.banner ? section.banner(resident) : null}
            <FieldList>
              {section.entries.map((entry) => (
                <Field
                  key={entry.id}
                  id={entry.id}
                  label={entry.label}
                  width={entry.width}
                >
                  {entry.render(resident)}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </>
  )
}
