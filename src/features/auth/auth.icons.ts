import type { IconName } from '@/components/icon/registry.names.generated'

/** In a `*.icons.ts` file so the icon usage scanner finds them. CLAUDE.md §3. */
export const authIcons = {
  met: 'check-validation/tick-02',
  unmet: 'geometric-sharps/circle',
} satisfies Record<string, IconName>
