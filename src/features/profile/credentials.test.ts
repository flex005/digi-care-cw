import { beforeEach, describe, expect, it } from 'vitest'
import {
  outstandingPassword,
  outstandingPin,
  passwordReady,
  pinReadyToSubmit,
} from './credentials'
import {
  isTurnedOff,
  preferenceHoldings,
  resetNotificationPreferences,
  turnOff,
  turnOn,
} from './preference-store'

const FORBIDDEN = ['kwame', 'osei', 'rosewood', 'court']
const GOOD = 'Harmattan!27'

describe('changing a password', () => {
  it('asks for the current one, although nothing can check it', () => {
    expect(outstandingPassword('', GOOD, GOOD, FORBIDDEN)).toContain(
      'your current password',
    )
    expect(passwordReady('', GOOD, GOOD, FORBIDDEN)).toBe(false)
    expect(passwordReady('anything at all', GOOD, GOOD, FORBIDDEN)).toBe(true)
  })

  it('holds the new one to the account’s own rules', () => {
    expect(passwordReady('old', 'short1!', 'short1!', FORBIDDEN)).toBe(false)
    expect(passwordReady('old', 'Rosewood!27x', 'Rosewood!27x', FORBIDDEN)).toBe(false)
  })

  it('will not finish on two entries that differ', () => {
    expect(outstandingPassword('old', GOOD, `${GOOD}x`, FORBIDDEN)).toContain(
      'both new entries matching',
    )
  })
})

describe('changing a medication PIN', () => {
  it('asks for the current PIN only where one is held', () => {
    expect(outstandingPin(true, '', '2846', '2846')).toContain('your current PIN')
    expect(outstandingPin(false, '', '2846', '2846')).toEqual([])
    expect(pinReadyToSubmit(false, '', '2846', '2846')).toBe(true)
  })

  it('applies the account’s own PIN rules to the new one', () => {
    expect(pinReadyToSubmit(false, '', '1234', '1234')).toBe(false)
    expect(pinReadyToSubmit(false, '', '0000', '0000')).toBe(false)
    expect(pinReadyToSubmit(false, '', '284', '284')).toBe(false)
    expect(pinReadyToSubmit(true, '1111', '2846', '2846')).toBe(true)
  })
})

describe('what a preference change holds', () => {
  beforeEach(() => {
    resetNotificationPreferences()
  })

  it('refuses a notification appendix D does not let anybody turn off', () => {
    expect(() => turnOff('medication_round_due')).toThrow(/does not let/)
    expect(() => turnOff('controlled_drug_discrepancy')).toThrow(/does not let/)
    expect(isTurnedOff('medication_round_due')).toBe(false)
  })

  it('remembers one that can be, and counts it among what signing out loses', () => {
    turnOff('new_handover')
    expect(isTurnedOff('new_handover')).toBe(true)
    expect(preferenceHoldings()).toEqual([
      { what: 'notification preferences you changed', count: 1 },
    ])
    turnOn('new_handover')
    expect(preferenceHoldings()).toEqual([])
  })

  it('is empty again once the session ends', () => {
    turnOff('new_handover')
    resetNotificationPreferences()
    expect(isTurnedOff('new_handover')).toBe(false)
  })
})
