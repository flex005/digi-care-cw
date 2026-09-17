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
 * do differs inside a tab, not in whether the tab exists. Two are built in
 * later phases and say so when opened, rather than being disabled: the tab
 * strip is the same shape it will have when they land.
 */
export interface ProfileTab {
  label: string
  /** The segment after /residents/[residentId]. Empty for the first tab. */
  segment: string
  /** Built, or the phase that builds it. */
  builtIn: 'built' | 'phase_4' | 'phase_7'
  notes: (resident: Resident) => TabNote[]
}

const none = (): TabNote[] => []

export const PROFILE_TABS: ProfileTab[] = [
  {
    label: 'General Information',
    segment: '',
    builtIn: 'built',
    notes: generalInformationNotes,
  },
  { label: 'Needs', segment: 'needs', builtIn: 'built', notes: none },
  { label: 'Important People', segment: 'people', builtIn: 'built', notes: none },
  { label: 'Future Plans', segment: 'future-plans', builtIn: 'built', notes: none },
  { label: 'Care Notes', segment: 'notes', builtIn: 'built', notes: none },
  { label: 'Medications', segment: 'medications', builtIn: 'phase_4', notes: none },
  {
    label: 'Risk Assessments',
    segment: 'risk-assessments',
    builtIn: 'built',
    notes: riskAssessmentNotes,
  },
  { label: 'Care Plan', segment: 'care-plan', builtIn: 'built', notes: none },
  { label: 'Goals', segment: 'goals', builtIn: 'phase_7', notes: none },
  { label: 'Consent', segment: 'consent', builtIn: 'built', notes: consentNotes },
  { label: 'Documents', segment: 'documents', builtIn: 'built', notes: none },
]

export const tabHref = (residentId: string, tab: ProfileTab): string =>
  tab.segment === ''
    ? `/residents/${residentId}`
    : `/residents/${residentId}/${tab.segment}`
