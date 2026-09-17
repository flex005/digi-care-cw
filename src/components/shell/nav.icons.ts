import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Every module a care worker or senior carer can reach, in the order they
 * appear. Reports, compliance, settings and team management are absent rather
 * than disabled: neither role has any access to them, and a disabled item
 * would read as something coming to them later.
 *
 * **Three places draw these, following the visual direction
 * (docs/cw-dashboard.html).** The navigation pill in the top bar holds the
 * five a shift moves between. The icon rail holds every module, icons only,
 * in its first group, and the account in its second. On a compact screen the
 * rail becomes bottom tabs and the pill leaves.
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
  | 'profile'

export type NavSectionId = 'overview' | 'delivery' | 'records' | 'reference' | 'account'

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
  /** Which of the rail's two groups holds it. */
  rail: 'modules' | 'account'
}

/**
 * The five modules in the top bar's navigation pill, in the pill's order: the
 * ones a shift moves between. Declared here once, because the pill's order is
 * not the rail's.
 */
export const PILL_MODULES: NavModuleId[] = [
  'dashboard',
  'residents',
  'medications',
  'handover',
  'activities',
]

export const NAV_SECTIONS: { id: NavSectionId; label: string }[] = [
  { id: 'overview', label: '' },
  { id: 'delivery', label: 'Care delivery' },
  { id: 'records', label: 'Records' },
  { id: 'reference', label: 'Design reference' },
  { id: 'account', label: 'Account' },
]

export const NAV_ITEMS: NavItem[] = [
  {
    module: 'dashboard',
    label: 'Today',
    path: '/dashboard',
    icon: 'dashboard/dashboard-square-01',
    section: 'overview',
    rail: 'modules',
    compact: 'tab',
  },
  {
    module: 'residents',
    label: 'Residents',
    path: '/residents',
    icon: 'users/user-multiple',
    section: 'delivery',
    rail: 'modules',
    compact: 'tab',
  },
  {
    module: 'care-notes',
    label: 'Care notes',
    path: '/care-notes',
    icon: 'note-task/note-01',
    section: 'delivery',
    rail: 'modules',
    compact: 'tab',
  },
  {
    module: 'handover',
    label: 'Handover',
    path: '/handover',
    icon: 'users/user-switch',
    section: 'delivery',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'medications',
    label: 'Medications',
    path: '/medications',
    icon: 'medical/medicine-01',
    section: 'delivery',
    rail: 'modules',
    compact: 'tab',
  },
  {
    module: 'incidents',
    label: 'Incidents',
    path: '/incidents',
    icon: 'alert-notification/alert-02',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'risk-assessments',
    label: 'Risk assessments',
    path: '/risk-assessments',
    icon: 'alert-notification/alert-diamond',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'goals',
    label: 'Goals',
    path: '/goals',
    icon: 'business-and-finance/target-01',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'activities',
    label: 'Activities',
    path: '/activities',
    icon: 'game-sports/puzzle',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'consent',
    label: 'Consent',
    path: '/consent',
    icon: 'legal/agreement-02',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'documents',
    label: 'Documents',
    path: '/documents',
    icon: 'legal/legal-document-01',
    section: 'records',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'specimens',
    label: 'Specimens',
    path: '/specimens',
    icon: 'edit-formatting/swatch',
    section: 'reference',
    rail: 'modules',
    compact: 'more',
  },
  {
    module: 'profile',
    label: 'Profile and settings',
    path: '/profile',
    icon: 'users/user-circle',
    section: 'account',
    rail: 'account',
    compact: 'more',
  },
]

export const shellIcons = {
  more: 'more-menu/more-horizontal',
  expand: 'arrows-round/arrow-up-right-01-round',
  siteSwitcher: 'arrows-sharp/arrow-down-01-sharp',
  signOut: 'login-logout/logout-01',
} satisfies Record<string, IconName>
