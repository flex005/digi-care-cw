import { useMemo } from 'react'
import { STAFF_ROLE_NAMES } from '@/data/types'
import {
  holdingFor,
  signInRoleOf,
  type CareActId,
  type Holding,
  type SignInRole,
} from './capabilities'
import { residentScopeFor, type ResidentScope } from './resident-scope'
import { useSignedIn } from './use-session'

/**
 * What the person signed in can do, and which residents they can see.
 *
 * The role comes from the signed-in member and is never passed in: a screen
 * that is told who is looking can be told wrongly.
 */
export interface Viewer {
  role: SignInRole
  /** The role as somebody would say it: "Senior carer". */
  roleName: string
  holding: (act: CareActId) => Holding
  scope: ResidentScope
}

export function useViewer(): Viewer {
  const { member } = useSignedIn()

  return useMemo(() => {
    const role = signInRoleOf(member)
    return {
      role,
      roleName: STAFF_ROLE_NAMES[role],
      holding: (act: CareActId) => holdingFor(role, act),
      scope: residentScopeFor(member),
    }
  }, [member])
}
