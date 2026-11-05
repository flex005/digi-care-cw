import type { ResidentId } from '@/data/types'

/**
 * "Open the composer when this record arrives", from the picker.
 *
 * **It carries no subject.** The record the picker pushes is the subject, from
 * its place in the address (CLAUDE.md §2); this only says that, once that
 * record is in front, its composer opens. Taken once: a record arriving later
 * by any other way opens as a record.
 */
let pending: ResidentId | 'none' = 'none'

export function requestComposer(id: ResidentId): void {
  pending = id
}

export function takeComposerRequest(id: ResidentId): boolean {
  if (pending !== id) return false
  pending = 'none'
  return true
}
