import { useMemo } from 'react'
import { STAFF_ROLE_NAMES } from '@/data/types'
import { answerFor, signInRoleOf, type Answer, type CareActId } from './capabilities'
import { residentScopeFor, type ResidentScope } from './resident-scope'
import { useSignedIn } from './use-session'
import type { ResidentId } from '@/data/types'

/**
 * What the person signed in can do, and which residents they can see.
 *
 * **It carries no role a screen could compare.** A screen asks `ask` and draws
 * the answer; `roleName` is words for a page head, not a value to branch on.
 * `check-role-names.mjs` holds this.
 *
 * The role comes from the signed-in member and is never passed in: a screen
 * that is told who is looking can be told wrongly.
 */
export interface Viewer {
  /** The role as somebody would say it: "Senior carer". */
  roleName: string
  /** Whether the viewer may perform an act, for one resident or for the role alone. */
  ask: (act: CareActId, resident?: ResidentId) => Answer
  scope: ResidentScope
}

export function useViewer(): Viewer {
  const { member } = useSignedIn()

  return useMemo(() => {
    const role = signInRoleOf(member)
    const scope = residentScopeFor(member)
    return {
      roleName: STAFF_ROLE_NAMES[role],
      ask: (act: CareActId, resident?: ResidentId) =>
        answerFor(
          role,
          scope,
          act,
          resident === undefined
            ? { kind: 'role_only' }
            : { kind: 'resident', id: resident },
        ),
      scope,
    }
  }, [member])
}
