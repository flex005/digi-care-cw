import type { IconName } from '@/components/icon/registry.names.generated'

/**
 * The password reveal, on every field that takes one.
 *
 * In a `*.icons.ts` file because the icon usage scanner reads icon-shaped
 * string literals in these files as used names. CLAUDE.md §3.
 */
export const passwordIcons = {
  show: 'edit-formatting/view',
  hide: 'edit-formatting/view-off',
} satisfies Record<string, IconName>
