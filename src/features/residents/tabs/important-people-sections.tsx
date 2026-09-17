import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ImportantPeople, LpaType, Resident } from '@/data/types'
import { ReviewBadge } from '@/components/status'
import { RecordedListField, RecordedValueField } from './FieldList'
import { CommunicationPreferenceLine, ContactLines, PersonBlock } from './PersonBlock'
import { PrimaryContactPanel } from './important-people-primary-contact'
import styles from './people-and-plans.module.css'

/**
 * Important People. Every category in `ImportantPeople`, declared rather than
 * written into a render function.
 *
 * **All seven are listed for every resident, whether or not anybody has
 * recorded them.** Absence from a list is the same bug as a blank cell: a tab
 * showing only the people somebody got round to entering reads as the complete
 * set of people who matter to this person, and "no advocate recorded" and
 * "assessed as not needing one" look identical if the row is not there.
 *
 * Each category carries `missingDetail`, what the gap costs in a sentence.
 * "Emergency contact not recorded" is true and inert; "nobody is recorded to
 * ring out of hours" is the same fact with its consequence attached.
 */

export interface PeopleCategory {
  id: string
  label: string
  /** True when nobody has recorded this category. */
  isUnrecorded: (people: ImportantPeople) => boolean
  render: (resident: Resident) => ReactNode
}

export interface PeopleSection {
  id: string
  title: string
  /** Only where a reader would misread the section without it. Never a bare count. */
  description?: string
  /** A full-width panel above the fields. Only the first section has one. */
  banner?: (resident: Resident) => ReactNode
  categories: PeopleCategory[]
}

const LPA_TYPES: Record<LpaType, string> = {
  health_and_welfare: 'Health and welfare',
  financial: 'Property and financial affairs',
}

export const IMPORTANT_PEOPLE_SECTIONS: PeopleSection[] = [
  {
    id: 'family',
    title: 'Family and next of kin',
    banner: (resident) => (
      <PrimaryContactPanel
        people={resident.importantPeople}
        residentName={resident.preferredName}
      />
    ),
    categories: [
      {
        id: 'next-of-kin',
        label: 'Next of kin',
        isUnrecorded: (people) => people.nextOfKin.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.importantPeople.nextOfKin}
            label="Next of kin"
            missingDetail="nobody is recorded as this person's next of kin, so there is nobody named to consult about their care"
            attributed
            render={(person) => <PersonBlock person={person} />}
          />
        ),
      },
      {
        id: 'emergency-contact',
        label: 'Emergency contact',
        isUnrecorded: (people) => people.emergencyContact.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.importantPeople.emergencyContact}
            label="Emergency contact"
            missingDetail="nobody is recorded to ring out of hours if something happens to this person"
            attributed
            render={(person) => <PersonBlock person={person} />}
          />
        ),
      },
      {
        id: 'visiting-family',
        label: 'Family with visiting rights',
        isUnrecorded: (people) =>
          people.familyWithVisitingRights.kind === 'not_recorded',
        render: (resident) => (
          <RecordedListField
            list={resident.importantPeople.familyWithVisitingRights}
            label="Family with visiting rights"
            // A recorded negative: somebody asked, and no family has visiting
            // rights. Not the same as nobody having asked.
            noneLabel="No family with visiting rights"
            missingDetail="nobody has recorded who may visit, so staff have no list to check anybody against"
            attributed
            render={(people) => (
              <ul className={styles.personList}>
                {people.map((person) => (
                  <li key={`${person.name}-${person.relationship}`}>
                    <PersonBlock person={person} />
                  </li>
                ))}
              </ul>
            )}
          />
        ),
      },
    ],
  },
  {
    id: 'legal',
    title: 'Legal and statutory',
    description:
      'Who may decide things on this person’s behalf, and who the council has named.',
    categories: [
      {
        id: 'lpa-holder',
        label: 'Lasting power of attorney',
        isUnrecorded: (people) => people.lpaHolder.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.importantPeople.lpaHolder}
            label="Lasting power of attorney"
            // Deliberately not "this person has no LPA". Nobody having recorded
            // one and nobody holding one are different legal situations, and
            // acting on the wrong one is a Mental Capacity Act problem.
            missingDetail="no LPA is recorded, which is not the same as there being none, and decisions must not be made on the assumption that it is"
            attributed
            render={(holder) => (
              <PersonBlock
                person={holder}
                extra={
                  <div className={styles.personPreference}>
                    <span className={styles.personPreferenceLabel}>Authority</span>
                    <span className={styles.personPreferenceValue}>
                      {LPA_TYPES[holder.lpaType]}
                    </span>
                    {/* The Documents tab, not the document: this build has no
                        viewer, and a link claiming to open one would be false. */}
                    <Link
                      href={`/residents/${resident.id}/documents`}
                      className={styles.documentLink}
                      aria-label={`Find the lasting power of attorney document for ${resident.preferredName} in Documents`}
                      data-document-link
                    >
                      Find it in Documents
                    </Link>
                  </div>
                }
              />
            )}
          />
        ),
      },
      {
        id: 'social-worker',
        label: 'Social worker',
        isUnrecorded: (people) => people.socialWorker.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.importantPeople.socialWorker}
            label="Social worker"
            missingDetail="no local authority contact is recorded, so there is nobody to raise a placement or funding question with"
            attributed
            render={(worker) => (
              <div className={styles.person}>
                <p className={styles.personName}>
                  {worker.name}
                  <span className={styles.personRelationship}>
                    {' '}
                    · {worker.localAuthority}
                  </span>
                </p>
                <ContactLines contact={worker.contact} />
                <div className={styles.personPreference}>
                  <span className={styles.personPreferenceLabel}>Placement review</span>
                  <ReviewBadge state={worker.reviewState} />
                </div>
                <CommunicationPreferenceLine
                  preference={worker.communicationPreference}
                />
              </div>
            )}
          />
        ),
      },
      {
        id: 'advocate',
        label: 'Advocate',
        isUnrecorded: (people) => people.advocate.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.importantPeople.advocate}
            label="Advocate"
            missingDetail="no independent advocate is recorded, which is not the same as this person not needing one"
            attributed
            render={(person) => <PersonBlock person={person} />}
          />
        ),
      },
    ],
  },
  {
    id: 'professionals',
    title: 'Other professionals involved',
    description: 'Everybody else working with this person who is not on the care team.',
    categories: [
      {
        id: 'other-professionals',
        label: 'Professionals',
        isUnrecorded: (people) => people.otherProfessionals.kind === 'not_recorded',
        render: (resident) => (
          <RecordedListField
            list={resident.importantPeople.otherProfessionals}
            label="Other professionals"
            noneLabel="No other professionals involved"
            missingDetail="nobody has recorded which therapists or specialists are working with this person"
            attributed
            render={(professionals) => (
              <ul className={styles.personList}>
                {professionals.map((professional) => (
                  <li key={`${professional.name}-${professional.role}`}>
                    <div className={styles.person}>
                      <p className={styles.personName}>
                        {professional.name}
                        <span className={styles.personRelationship}>
                          {' '}
                          · {professional.role}
                        </span>
                      </p>
                      <p className={styles.personLine}>{professional.organisation}</p>
                      <ContactLines contact={professional.contact} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          />
        ),
      },
    ],
  },
]

/** Every category, flattened: what the guard iterates. */
export const IMPORTANT_PEOPLE_CATEGORIES: PeopleCategory[] =
  IMPORTANT_PEOPLE_SECTIONS.flatMap((section) => section.categories)
