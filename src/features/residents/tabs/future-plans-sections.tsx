import Link from 'next/link'
import type { ReactNode } from 'react'
import type { FuturePlans, Recorded, Resident, SignedEntry } from '@/data/types'
import type { FieldWidth } from './FieldList'
import { RecordedValueField } from './FieldList'
import { SignedValue } from './SignedValue'
import { ResuscitationPanel } from './future-plans-resuscitation'
import styles from './people-and-plans.module.css'

/**
 * Future Plans: the resuscitation decision, ADRT, advance care plan, preferred
 * place of care and death, funeral and religious preferences, and who to
 * contact. Every entry dated, signed and versioned.
 *
 * All eight members of `FuturePlans` render for every resident. On this tab
 * the omissions are the point: most residents have most of these unrecorded,
 * and a tab showing only the completed ones would suggest a person whose
 * wishes are known.
 *
 * Ordered by when somebody needs them: what to do in an emergency, then where
 * this person wants to be, then what happens after they die.
 *
 * `missingDetail` carries the consequence. "Preferred place of death not
 * recorded" is a true statement about a form; "the answer becomes hospital" is
 * what makes somebody go and ask.
 */

export interface FuturePlanEntry {
  id: string
  label: string
  /** `full` for an entry whose answer is the person's own words. */
  width?: FieldWidth
  isUnrecorded: (plans: FuturePlans) => boolean
  render: (resident: Resident) => ReactNode
}

export interface FuturePlansSection {
  id: string
  title: string
  /** Only where a reader would misread the section without it. Never a bare count. */
  description?: string
  /** A full-width panel above the fields. Only "In an emergency" has one. */
  banner?: (resident: Resident) => ReactNode
  entries: FuturePlanEntry[]
}

/**
 * The common shape: a signed entry rendered as free text. Six of the eight are
 * this. The ADRT carries a document alongside its text, and the resuscitation
 * decision has its own three-state union and renders as the banner.
 */
function signedText(
  read: (resident: Resident) => Recorded<SignedEntry<string>>,
  label: string,
  missingDetail: string,
) {
  return (resident: Resident) => (
    <RecordedValueField
      record={read(resident)}
      label={label}
      missingDetail={missingDetail}
      attributed={false}
      render={(entry) => (
        <SignedValue
          entry={entry}
          render={(value) => <span className={styles.planText}>{value}</span>}
        />
      )}
    />
  )
}

export const FUTURE_PLANS_SECTIONS: FuturePlansSection[] = [
  {
    id: 'emergency',
    title: 'In an emergency',
    description:
      'What staff do if this person collapses. Both are checked before CPR is started.',
    banner: (resident) => (
      <ResuscitationPanel
        status={resident.futurePlans.resuscitation}
        residentName={resident.preferredName}
      />
    ),
    entries: [
      {
        id: 'adrt',
        label: 'Advance decision to refuse treatment',
        isUnrecorded: (plans) => plans.adrt.kind === 'unrecorded',
        render: (resident) => (
          <RecordedValueField
            record={resident.futurePlans.adrt}
            label="Advance decision to refuse treatment"
            // Not "this person has no ADRT". One that exists and is not
            // recorded here is still legally binding, and treating it as absent
            // is how a refused treatment gets given.
            missingDetail="no ADRT is recorded, which is not the same as there being none, and an ADRT that exists is legally binding whether or not this screen knows about it"
            attributed={false}
            render={(entry) => (
              <SignedValue
                entry={entry}
                render={(adrt) => (
                  <>
                    <span className={styles.planText}>{adrt.text}</span>
                    {/* The Documents tab, not the document: this build has no viewer. */}
                    <Link
                      href={`/residents/${resident.id}/documents`}
                      className={styles.documentLink}
                      aria-label={`Find the advance decision document for ${resident.preferredName} in Documents`}
                      data-document-link
                    >
                      Find it in Documents
                    </Link>
                  </>
                )}
              />
            )}
          />
        ),
      },
      {
        id: 'advance-care-plan',
        label: 'Advance care plan',
        // Written in this person's own voice, and usually a paragraph of it.
        width: 'full',
        isUnrecorded: (plans) => plans.advanceCarePlan.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.advanceCarePlan,
          'Advance care plan',
          'nobody has recorded what this person wants to happen as their health changes, in their own words',
        ),
      },
    ],
  },
  {
    id: 'where',
    title: 'Where this person wants to be',
    entries: [
      {
        id: 'place-of-care',
        label: 'Preferred place of care',
        isUnrecorded: (plans) => plans.preferredPlaceOfCare.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.preferredPlaceOfCare,
          'Preferred place of care',
          'nobody has asked where this person would rather be cared for as they become less well',
        ),
      },
      {
        id: 'place-of-death',
        label: 'Preferred place of death',
        isUnrecorded: (plans) => plans.preferredPlaceOfDeath.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.preferredPlaceOfDeath,
          'Preferred place of death',
          'nobody has asked where this person wants to die, and in the absence of an answer the ambulance is called and the answer becomes hospital',
        ),
      },
    ],
  },
  {
    id: 'after',
    title: 'After death',
    entries: [
      {
        id: 'funeral',
        label: 'Funeral preferences',
        isUnrecorded: (plans) => plans.funeralPreferences.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.funeralPreferences,
          'Funeral preferences',
          'nobody has recorded whether this person wanted burial or cremation, or whether anything is already arranged',
        ),
      },
      {
        id: 'religious',
        label: 'Religious preferences at the end of life',
        isUnrecorded: (plans) => plans.religiousPreferences.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.religiousPreferences,
          'Religious preferences',
          'nobody has recorded whether a priest, imam or other minister should be called, or how soon, and some of these cannot be done late',
        ),
      },
      {
        id: 'contact-on-death',
        label: 'Who to contact',
        isUnrecorded: (plans) => plans.contactOnDeath.kind === 'unrecorded',
        render: signedText(
          (resident) => resident.futurePlans.contactOnDeath,
          'Who to contact',
          'nobody has recorded who should be told first, or in what order',
        ),
      },
    ],
  },
]

/** Every entry, flattened: what the guard iterates. */
export const FUTURE_PLAN_ENTRIES: FuturePlanEntry[] = FUTURE_PLANS_SECTIONS.flatMap(
  (section) => section.entries,
)
