import { afterEach, describe, expect, it } from 'vitest'
import { PASSWORD_RULES, unmetRules } from './password-rules'
import { PIN_RULES, pinReady } from './pin-rules'
import {
  ATTEMPTS_BEFORE_LOCK,
  lockState,
  recordFailure,
  resetLockouts,
} from './lockout'
import { destinationFrom } from './destination'

describe('password rules', () => {
  const forbidden = ['ngozi', 'eze', 'rosewood', 'court']

  it('counts five rules, and a password meeting every one meets them all', () => {
    expect(PASSWORD_RULES).toHaveLength(5)
    expect(unmetRules('Kept-Safe-2026!', forbidden)).toEqual([])
  })

  it('names each rule a password breaks', () => {
    expect(
      unmetRules('short', forbidden)
        .map((rule) => rule.id)
        .sort(),
    ).toEqual(['capital', 'length', 'number', 'symbol'].sort())
    expect(unmetRules('Rosewood-2026!', forbidden).map((rule) => rule.id)).toEqual([
      'not_name',
    ])
  })

  it('holds the PRD minimum of ten characters, at the boundary', () => {
    expect(unmetRules('Abcdef-12!', forbidden)).toEqual([])
    expect(unmetRules('Abcde-12!', forbidden).map((rule) => rule.id)).toEqual([
      'length',
    ])
  })
})

describe('medication PIN rules', () => {
  it('refuses 0000 and 1234, and any PIN whose entries differ', () => {
    expect(pinReady('0000', '0000')).toBe(false)
    expect(pinReady('1234', '1234')).toBe(false)
    expect(pinReady('4821', '4812')).toBe(false)
    expect(pinReady('4821', '4821')).toBe(true)
  })

  it('does not claim to check the birth year', () => {
    expect(PIN_RULES.map((rule) => rule.says).join(' ')).not.toMatch(/birth/i)
  })
})

describe('the lockout', () => {
  afterEach(() => resetLockouts())
  // Pinned instants: a lock is about the real clock, and a test reading it would
  // pass or fail by the minute it ran.
  const at = Date.UTC(2026, 8, 17, 20, 20)

  it('locks an address on the fifth refusal, for fifteen minutes, and not before', () => {
    for (let attempt = 1; attempt < ATTEMPTS_BEFORE_LOCK; attempt++) {
      expect(recordFailure('n.eze@rosewoodcourt.example', at).kind).toBe('open')
    }
    const locked = recordFailure('N.Eze@rosewoodcourt.example', at)
    expect(locked).toEqual({ kind: 'locked', until: at + 15 * 60_000 })
    expect(lockState('n.eze@rosewoodcourt.example', at + 15 * 60_000 - 1).kind).toBe(
      'locked',
    )
    expect(lockState('n.eze@rosewoodcourt.example', at + 15 * 60_000).kind).toBe('open')
  })
})

describe('where signing in lands', () => {
  it('is the page the reader was going to, query and all', () => {
    expect(destinationFrom('?from=%2Fresidents%2Fres-okafor%2Fconsent')).toBe(
      '/residents/res-okafor/consent',
    )
    expect(destinationFrom('?from=%2Fresidents%3Fat%3D20%3A20')).toBe(
      '/residents?at=20:20',
    )
  })

  it('is the start for anything that is not a page in this product', () => {
    for (const search of [
      '',
      '?from=',
      '?from=https%3A%2F%2Felsewhere.example',
      '?from=%2F%2Felsewhere.example',
      '?from=residents',
      '?from=%2Fsign-in%2Fcode',
      '?from=%2Fsigned-out',
      '?from=%2Fsign-out',
      '?from=%2Finvitation%2Fstaff-n-eze',
    ])
      expect(destinationFrom(search), search).toBe('/')
  })
})
