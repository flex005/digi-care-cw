import type { Resident } from '@/data/types'
import { Card, CardHead } from '@/components/primitives'
import { Unrecorded } from '@/components/status'
import { ActPoint } from '@/components/layout/ActPoint'
import { useViewer } from '@/app/session/use-viewer'
import { useOpenRecord } from '@/features/residents/profile/ProfileContext'
import { Field, FieldList } from './FieldList'
import { GENERAL_INFORMATION_SECTIONS } from './general-information-fields'
import styles from './general-information.module.css'

/**
 * The General Information tab: every field of the resident's profile, read-only.
 *
 * Five cards, one per section, each headed by its title and, only where the
 * heading alone would be misread, a one-line description of what the section is
 * for in the reader's terms. "Care team" alone does not tell a care worker that
 * this is who to ring about somebody's health rather than about their laundry.
 *
 * Three rules govern every row:
 *
 *  1. **Never an empty row, never an em dash.** A field either has a value or
 *     says in words that nobody recorded one. "—" is the most common way a
 *     care record turns "nobody asked" into "nothing to report".
 *  2. **The three answer types stay visibly apart.** A recorded value reads
 *     plainly; a recorded negative is a settled tinted pill with an author and
 *     a date, because somebody asked and confirmed it; a gap is hatched and
 *     says what is missing.
 *  3. **Clinical and compliance fields carry their author and date.**
 *     Person-centred fields do not, because sixteen attribution lines would
 *     bury the values they annotate.
 *
 * Allergies are a full-width panel at the top of Clinical rather than a row;
 * see AllergyPanel for why that is not a cosmetic preference.
 *
 * **Editing is one act, drawn once, at the top.** Whether this viewer may edit
 * the profile is the role table's answer, and the line beside the control is
 * its words. There are no change controls on individual fields: each would be
 * the same refusal said sixteen times, and a field that looks editable reads as
 * a record somebody here is expected to keep.
 */
export function GeneralInformationTab() {
  const { resident } = useOpenRecord()
  const viewer = useViewer()

  return (
    <div className={styles.tabPanel} data-tab-panel="general">
      <ActPoint
        answer={viewer.ask('edit_resident_profile', resident.id)}
        label="Edit profile"
        notBuilt="Editing a profile is not built."
        residentName={resident.preferredName}
      />
      <ProfileSections resident={resident} />
    </div>
  )
}

/**
 * The five field sections. Exported so the structural guard can iterate every
 * resident against **the real rendering** rather than a test harness that
 * re-implements it: a guard that tests a copy of the logic proves only that the
 * copy agrees with itself.
 */
export function ProfileSections({ resident }: { resident: Resident }) {
  return (
    <>
      {GENERAL_INFORMATION_SECTIONS.map((section) => (
        <Card key={section.id}>
          <CardHead
            title={section.title}
            subtitle={section.description}
            expand={{ kind: 'not_built' }}
          />
          <div className={styles.sectionBody} data-section={section.id}>
            {section.banner === undefined ? null : section.banner(resident)}
            <FieldList>
              {section.fields.map((field) => (
                <Field
                  key={field.id}
                  id={field.id}
                  label={field.label}
                  width={field.width}
                >
                  {field.isUnrecorded(resident) && field.whenMissing === 'hatch' ? (
                    <Unrecorded label={`${field.label} not recorded`} />
                  ) : (
                    field.render(resident)
                  )}
                </Field>
              ))}
            </FieldList>
          </div>
        </Card>
      ))}
    </>
  )
}
