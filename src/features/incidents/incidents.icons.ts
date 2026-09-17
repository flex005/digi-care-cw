import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons for the incidents list and the report form. In a `*.icons.ts` file so
 * the icon usage scanner finds them (CLAUDE.md §3).
 */
export const incidentsIcons = {
  /** The statutory notification nobody has decided on. */
  notification: 'alert-notification/alert-01',
} satisfies Record<string, IconName>
