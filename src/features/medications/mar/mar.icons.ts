import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const marIcons = {
  /** A closed tick: a dose somebody recorded giving. */
  given: 'check-validation/tick-02',
  /** A PRN dose: recorded, and given as required rather than at a round. */
  prn: 'medical/give-pill',
  /** A cross: a dose somebody recorded not giving, with a reason. */
  notGiven: 'add-remove-delete/cancel-01',
  /** An open ring: the window is open and nothing is recorded yet. */
  due: 'geometric-sharps/circle',
  previous: 'arrows-sharp/arrow-left-01-sharp',
  next: 'arrows-sharp/arrow-right-01-sharp',
  export: 'download-upload/download-01',
  back: 'arrows-sharp/arrow-left-01-sharp',
} satisfies Record<string, IconName>
