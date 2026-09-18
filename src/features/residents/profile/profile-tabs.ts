import type { Resident } from '@/data/types'
import {
  consentNotes,
  generalInformationNotes,
  riskAssessmentNotes,
  type TabNote,
} from './record-gaps'

/**
 * The eleven tabs of a resident's record, in the PRD's order. RES-03.
 *
 * **All eleven are drawn for both roles, and none is hidden.** What a role can
 * do differs inside a tab, not in whether the tab exists. One is built in a
 * Every tab is built as of Phase 7. Until then the ones that were not said so
 * when opened rather than being disabled, so the strip always had the shape it
 * would have when they landed.
 */
export interface ProfileTab {
  label: string
  /** The segment after /residents/[residentId]. Empty for the first tab. */
  segment: string
  notes: (resident: Resident) => TabNote[]
}

const none = (): TabNote[] => []

export const PROFILE_TABS: ProfileTab[] = [
  {
    label: 'General Information',
    segment: '',
    notes: generalInformationNotes,
  },
  { label: 'Needs', segment: 'needs', notes: none },
  { label: 'Important People', segment: 'people', notes: none },
  { label: 'Future Plans', segment: 'future-plans', notes: none },
  { label: 'Care Notes', segment: 'notes', notes: none },
  { label: 'Medications', segment: 'medications', notes: none },
  {
    label: 'Risk Assessments',
    segment: 'risk-assessments',
    notes: riskAssessmentNotes,
  },
  { label: 'Care Plan', segment: 'care-plan', notes: none },
  { label: 'Goals', segment: 'goals', notes: none },
  { label: 'Consent', segment: 'consent', notes: consentNotes },
  { label: 'Documents', segment: 'documents', notes: none },
]

export const tabHref = (residentId: string, tab: ProfileTab): string =>
  tab.segment === ''
    ? `/residents/${residentId}`
    : `/residents/${residentId}/${tab.segment}`
