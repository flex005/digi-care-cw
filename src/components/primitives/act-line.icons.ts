import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const actLineIcons = {
  note: 'alert-notification/information-circle',
} satisfies Record<string, IconName>
