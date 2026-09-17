import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const profileIcons = {
  back: 'arrows-sharp/arrow-left-01-sharp',
  call: 'communications/call',
} satisfies Record<string, IconName>
