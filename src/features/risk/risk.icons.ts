import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const riskIcons = {
  /** The way out of the form, back to the list it was opened from. */
  back: 'arrows-sharp/arrow-left-01-sharp',
  /** Takes an intervention row off the form again. */
  remove: 'add-remove-delete/delete-02',
} satisfies Record<string, IconName>
