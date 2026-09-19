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
  /**
   * A mark on a hatched cell: somebody closed this omission.
   *
   * The hatch stays — closing records a decision *about* the gap and does not
   * fill it — and the mark is what says somebody acted. Every glyph in this
   * grid means somebody did something; an unmarked hatched cell means nobody
   * has.
   */
  closed: 'alert-notification/alert-02',
  previous: 'arrows-sharp/arrow-left-01-sharp',
  next: 'arrows-sharp/arrow-right-01-sharp',
  export: 'download-upload/download-01',
  back: 'arrows-sharp/arrow-left-01-sharp',
} satisfies Record<string, IconName>
