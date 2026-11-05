import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * The phone tree's own icons. In a `*.icons.ts` file so the icon usage scanner
 * finds them (CLAUDE.md §3). Every one is already in use on the desktop build,
 * for the same meaning, so the two products draw one thing one way.
 */
export const phoneIcons = {
  today: 'dashboard/dashboard-square-01',
  people: 'users/user-multiple',
  dose: 'medical/medicine-01',
  more: 'more-menu/more-horizontal',
  search: 'search/search-02',
  clear: 'add-remove-delete/cancel-01',
  back: 'arrows-sharp/arrow-left-01-sharp',
  open: 'arrows-sharp/arrow-right-01-sharp',
  choose: 'arrows-sharp/arrow-down-01-sharp',
  allergy: 'alert-notification/alert-02',
  carePlan: 'note-task/note-03',
  late: 'date-and-time/clock-01',
  writeNote: 'note-task/note-add',
  notWritten: 'note-task/note-remove',
  pastWindow: 'alert-notification/alert-01',
} satisfies Record<string, IconName>
