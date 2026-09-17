import type { CarePlanDomainRecord, CarePlanText, CarePlanVersion } from '@/data/types'

/**
 * The three fields a care plan domain is made of, and whose voice each is
 * written in.
 *
 * **Two of the three are the resident speaking and one is not.** "I like to
 * wash at the sink myself" and "Offer an arm on the corridor" are different
 * kinds of sentence with different authors, and a reader has to be able to
 * tell whose words they are following.
 *
 * Only what a reader needs is declared here. The editor's guidance and
 * placeholders arrive with the editor.
 */
export type PlanFieldId = keyof CarePlanText

export interface PlanField {
  id: PlanFieldId
  label: string
  /** Whose sentence this is. */
  voice: 'resident' | 'staff'
}

/**
 * Keyed by field id, so the compiler holds that every field is declared. The
 * render order is this object's key order, so there is one list rather than a
 * declaration and a separate ordering that can disagree with it.
 */
const FIELDS: Record<PlanFieldId, Omit<PlanField, 'id'>> = {
  currentNeeds: { label: 'What I need help with', voice: 'resident' },
  preferences: { label: 'How I like it done', voice: 'resident' },
  agreedActions: { label: 'What staff will do', voice: 'staff' },
}

export const PLAN_FIELDS: PlanField[] = (Object.keys(FIELDS) as PlanFieldId[]).map(
  (id) => ({
    id,
    ...FIELDS[id],
  }),
)

/**
 * The version staff are following today, or nothing.
 *
 * **Current is last**, which the type holds: `history` is non-empty wherever it
 * exists, so there is no "finalised with no versions" to guard against at every
 * call site.
 */
export function currentVersion(record: CarePlanDomainRecord): CarePlanVersion | 'none' {
  return record.versions.kind === 'finalised' ? record.versions.history.at(-1)! : 'none'
}

/** How many versions have been signed. Zero where none has. */
export function versionCount(record: CarePlanDomainRecord): number {
  return record.versions.kind === 'finalised' ? record.versions.history.length : 0
}
