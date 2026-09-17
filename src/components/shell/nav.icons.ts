import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Every module a care worker or senior carer can reach, in the order they
 * appear. Reports, compliance, settings and team management are absent rather
 * than disabled: neither role has any access to them, and a disabled item
 * would read as something coming to them later.
 *
 * In a `*.icons.ts` file because the icon usage scanner reads icon-shaped
 * string literals in these files as used names. CLAUDE.md §3.
 */
export type NavModuleId =
  | 'dashboard'
  | 'residents'
  | 'care-notes'
  | 'handover'
  | 'medications'
  | 'incidents'
  | 'risk-assessments'
  | 'goals'
  | 'activities'
  | 'consent'
  | 'documents'
  | 'specimens'

export type NavSectionId = 'overview' | 'delivery' | 'records' | 'reference'

export interface NavItem {
  module: NavModuleId
  label: string
  path: string
  icon: IconName
  section: NavSectionId
  /**
   * Where the item sits in the compact layout: one of the four tabs along the
   * bottom, or inside More. Four because a fifth tab is More itself, and five
   * is what a phone's width holds at a readable label size.
   */
  compact: 'tab' | 'more'
}

export const NAV_SECTIONS: { id: NavSectionId; label: string }[] = [
  { id: 'overview', label: '' },
  { id: 'delivery', label: 'Care delivery' },
  { id: 'records', label: 'Records' },
  { id: 'reference', label: 'Design reference' },
]

export const NAV_ITEMS: NavItem[] = [
  {
    module: 'dashboard',
    label: 'Dashboard',
    path: '/dashboard',
    icon: 'dashboard/dashboard-square-01',
    section: 'overview',
    compact: 'tab',
  },
  {
    module: 'residents',
    label: 'Residents',
    path: '/residents',
    icon: 'users/user-multiple',
    section: 'delivery',
    compact: 'tab',
  },
  {
    module: 'care-notes',
    label: 'Care notes',
    path: '/care-notes',
    icon: 'note-task/note-01',
    section: 'delivery',
    compact: 'tab',
  },
  {
    module: 'handover',
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    section: 'delivery',
    compact: 'more',
  },
  {
    module: 'medications',
    label: 'Medications',
    path: '/medications',
    icon: 'medical/medicine-01',
    section: 'delivery',
    compact: 'tab',
  },
  {
    module: 'incidents',
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'risk-assessments',
    label: 'Risk assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'goals',
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'activities',
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'consent',
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    section: 'records',
    compact: 'more',
  },
  {
    module: 'specimens',
    label: 'Specimens',
    path: '/specimens',
    icon: 'edit-formatting/swatch',
    section: 'reference',
    compact: 'more',
  },
]

export const shellIcons = {
  more: 'more-menu/more-horizontal',
  siteSwitcher: 'arrows-sharp/arrow-down-01-sharp',
  signOut: 'login-logout/logout-01',
} satisfies Record<string, IconName>
