import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const generalAndNeedsIcons = {
  allergy: 'alert-notification/alert-02',
} satisfies Record<string, IconName>
