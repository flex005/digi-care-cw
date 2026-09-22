import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const documentsIcons = {
  /** The way out of a document, or of the expiry queue, back to the library. */
  back: 'arrows-sharp/arrow-left-01-sharp',
  /** Into a document, or into the record that points at one. */
  open: 'arrows-sharp/arrow-right-01-sharp',
} satisfies Record<string, IconName>
