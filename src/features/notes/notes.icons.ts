import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const notesIcons = {
  back: 'arrows-sharp/arrow-left-01-sharp',
  open: 'arrows-sharp/arrow-right-01-sharp',
} satisfies Record<string, IconName>
