import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const profileIcons = {
  back: 'arrows-sharp/arrow-left-01-sharp',
  call: 'communications/call',
  earlier: 'arrows-sharp/arrow-left-01-sharp',
  later: 'arrows-sharp/arrow-right-01-sharp',
} satisfies Record<string, IconName>
