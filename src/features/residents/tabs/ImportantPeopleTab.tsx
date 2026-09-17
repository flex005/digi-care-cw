import type { Resident } from '@/data/types'
import { Card, CardHead } from '@/components/primitives'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { Field, FieldList } from './FieldList'
import { IMPORTANT_PEOPLE_SECTIONS } from './important-people-sections'
import styles from './people-and-plans.module.css'

/**
 * The Important People tab: next of kin, emergency contact, LPA holder,
 * social worker, advocate, family with visiting rights and other
 * professionals, each with how they asked to be contacted.
 *
 * **Read-only.** Nothing on this tab writes. The one act drawn is editing the
 * profile, and the role table answers it: the line beneath says who does.
 *
 * The failure this tab is exposed to is not a blank field but a missing
 * category, so all seven are listed for every resident.
 */
export function ImportantPeopleTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()

  return (
    <div className={styles.tabPanel}>
      <div className={styles.lead}>
        <ActPoint
          answer={viewer.ask('edit_resident_profile', resident.id)}
          label="Edit profile"
          notBuilt="Editing a profile is not built."
          residentName={resident.preferredName}
        />
      </div>
      <PeopleSections resident={resident} />
    </div>
  )
}

/** Exported so the guard can iterate every resident against the real rendering. */
export function PeopleSections({ resident }: { resident: Resident }) {
  return (
    <>
      {IMPORTANT_PEOPLE_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHead
            title={section.title}
            subtitle={section.description}
            expand={{ kind: 'whole' }}
          />
          <div className={styles.sectionBody}>
            {section.banner ? section.banner(resident) : null}
            <FieldList>
              {section.categories.map((category) => (
                <Field key={category.id} id={category.id} label={category.label}>
                  {category.render(resident)}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </>
  )
}
