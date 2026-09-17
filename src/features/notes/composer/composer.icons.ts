import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const composerIcons = {
  voice: 'media/mic-01',
  search: 'search/search-02',
} satisfies Record<string, IconName>
