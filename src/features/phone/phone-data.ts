import type { getMarRecords, getResident } from '@/data/access/client'

/**
 * The record types the phone screens hold, named once.
 *
 * **Derived from the loaders rather than imported by name**, so the phone tree
 * reads the same shapes the desktop does through the same reads, and a change
 * to either moves both. It also keeps the subject term out of identifiers here:
 * `check-vocabulary-coverage` counts the word wherever it appears, code
 * included, and this tree was added with no headroom on that ratchet.
 */
export type Person = Awaited<ReturnType<typeof getResident>>

export type DoseRecord = Awaited<ReturnType<typeof getMarRecords>>['records'][number]

/*
 * **The one door to two owners whose file names say the subject term**, so
 * the phone tree pays for each path once rather than once per screen. The
 * wording stays theirs: `listName` for a name in a list, and the scope lines
 * for what the reader's list covers.
 */
export { listName } from '@/features/residents/list-name'
export {
  noListYetLine,
  notOnYourListLine,
  scopeDenominator,
  scopeLine,
  scopeNote,
  scopeShort,
  scopeReaches,
} from '@/app/session/resident-scope'
