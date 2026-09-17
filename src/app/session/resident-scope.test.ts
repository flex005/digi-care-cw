import { describe, expect, it } from 'vitest'
import type { ResidentId, StaffMember } from '@/data/types'
import { memberById } from '@/data/access/team-store'
import {
  staffEze,
  staffFitzgerald,
  staffMorrison,
  staffNwosu,
  staffPatel,
} from '@/data/fixtures/organisation'
import { residentScopeFor, scopeReaches } from './resident-scope'

const member = (id: string): StaffMember => {
  const found = memberById(id)
  if (found === undefined) throw new Error(`No member of staff with id ${id}`)
  return found
}

/**
 * Every member of the union, each reached by a named person in the fixtures.
 * A scope no fixture reaches is a branch no screen can be reviewed in.
 */
describe('which residents somebody signed in can see', () => {
  it('gives a senior carer every resident, whatever their assignment says', () => {
    expect(residentScopeFor(member(staffNwosu.id))).toEqual({
      kind: 'every_resident',
      because: 'senior_carer',
    })
  })

  it('gives Sunita Patel the whole home, as a decision with a name on it', () => {
    const scope = residentScopeFor(member(staffPatel.id))
    expect(scope.kind).toBe('every_resident')
    if (scope.kind !== 'every_resident' || scope.because !== 'decided')
      throw new Error('expected a decided whole-home scope')
    expect(scope.decidedBy.displayName).toBe('R. Clarke')
  })

  it('gives Ngozi Eze her four named residents and nobody else', () => {
    const scope = residentScopeFor(member(staffEze.id))
    if (scope.kind !== 'named_residents') throw new Error('expected named residents')
    expect(scope.residents).toEqual([
      'res-okafor',
      'res-adeyemi',
      'res-hutchinson',
      'res-pemberton',
    ])
    expect(scopeReaches(scope, 'res-okafor' as ResidentId)).toBe(true)
    expect(scopeReaches(scope, 'res-nwachukwu' as ResidentId)).toBe(false)
  })

  it('says nobody has decided for Douglas Morrison, and reaches nobody', () => {
    const scope = residentScopeFor(member(staffMorrison.id))
    expect(scope).toEqual({ kind: 'not_decided' })
    expect(scopeReaches(scope, 'res-okafor' as ResidentId)).toBe(false)
  })

  it('refuses a role that does not sign into this product', () => {
    expect(() => residentScopeFor(member(staffFitzgerald.id))).toThrow(
      /does not sign into the Care Worker product/,
    )
  })
})
