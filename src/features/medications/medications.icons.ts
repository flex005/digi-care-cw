import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * Icons for the Medications tabs: omissions, the controlled drug register and
 * Add interim. In a `*.icons.ts` file so the icon usage scanner finds them
 * (CLAUDE.md §3).
 */
export const medicationsIcons = {
  /** Beside the words of a discrepancy banner, never instead of them. */
  discrepancy: 'alert-notification/alert-01',
  open: 'arrows-sharp/arrow-right-01-sharp',
  /** Beside a silence in the PRD, quoted at the act it leaves undecided. */
  silence: 'alert-notification/information-circle',
} satisfies Record<string, IconName>
