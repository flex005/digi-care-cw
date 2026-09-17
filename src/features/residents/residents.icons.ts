import type { IconName } from '@/components/icon/registry.names.generated'
import type { FigureId } from './resident-figures'

/**
 * Icons for the residents list's figures and its search. In a `*.icons.ts`
 * file so the icon usage scanner finds them (CLAUDE.md §3), and keyed by
 * `FigureId` so a figure cannot be added without one.
 */
export const residentFigureIcons = {
  residents: 'users/user-multiple',
  critical: 'alert-notification/alert-02',
  reviews: 'date-and-time/calendar-remove-01',
  notes: 'note-task/note-remove',
  falls: 'alert-notification/alert-diamond',
} satisfies Record<FigureId, IconName>

export const residentListIcons = {
  search: 'search/search-02',
} satisfies Record<string, IconName>
