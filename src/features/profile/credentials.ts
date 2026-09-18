import { unmetRules } from '@/features/auth/password-rules'
import { PIN_RULES } from '@/features/auth/pin-rules'

/**
 * What the two credential forms on PROF-01 require, and what they cannot
 * check.
 *
 * **Phase 1's reasoning, carried forward.** Nothing in this build
 * authenticates anybody: no password is stored, so "current password" has
 * nothing to compare against, and a form that greyed out its button until the
 * current one was "right" would be pretending to a check it never made. The
 * field is required because a real form requires it, and the screen says in
 * one line that what is typed there is not checked.
 *
 * **The medication PIN is the exception, and it is a real one.** A PIN chosen
 * this session is held in memory and is what confirms a dose, a handover
 * signature and a risk assessment afterwards, so changing it here changes
 * those. What does not happen is a credential being stored anywhere, and the
 * screen says that instead of saying nothing happens at all.
 */

/** Both forms ask for three fields; this is what is still missing from one. */
export function outstandingPassword(
  current: string,
  next: string,
  confirm: string,
  forbidden: string[],
): string[] {
  const waiting: string[] = []
  if (current.trim() === '') waiting.push('your current password')
  if (unmetRules(next, forbidden).length > 0)
    waiting.push('a new password that meets every rule')
  if (next.length === 0 || next !== confirm) waiting.push('both new entries matching')
  return waiting
}

export const passwordReady = (
  current: string,
  next: string,
  confirm: string,
  forbidden: string[],
): boolean => outstandingPassword(current, next, confirm, forbidden).length === 0

/**
 * What a PIN change is still waiting for.
 *
 * `currentHeld` is whether this session holds a PIN for the person at all.
 * Where it does not, the current PIN is not asked for: there is nothing to ask
 * about, and a field that accepts any four digits because nothing is held is
 * the blank that means two things.
 */
export function outstandingPin(
  currentHeld: boolean,
  current: string,
  next: string,
  confirm: string,
): string[] {
  const waiting: string[] = []
  if (currentHeld && !/^\d{4}$/.test(current)) waiting.push('your current PIN')
  for (const rule of PIN_RULES) if (!rule.met(next, confirm)) waiting.push(rule.says)
  return waiting
}

export const pinReadyToSubmit = (
  currentHeld: boolean,
  current: string,
  next: string,
  confirm: string,
): boolean => outstandingPin(currentHeld, current, next, confirm).length === 0

/** Said where the current password is typed, because the field looks checked. */
export const CURRENT_PASSWORD_UNCHECKED =
  'Your current password is not checked: no password is stored anywhere in this build, so there is nothing to check it against.'

/** Said at the act, once the new password meets every rule. */
export const PASSWORD_NOT_CHANGED =
  'Nothing is saved: no password is stored, no other session ends, and no email is sent. Signing in still accepts any password that meets these rules.'

/** Said at the PIN act, where the change is real for this session only. */
export const PIN_CHANGED_THIS_SESSION =
  'Your medication PIN is held in this browser tab and nowhere else. Changing it here changes what confirms a dose, a handover signature and a risk assessment for the rest of this session, and signing out loses it.'

/** Said before anybody types, where this session holds no PIN for them. */
export const PIN_NOT_HELD =
  'No medication PIN is held for you this session, so there is no current one to ask for. Choosing one here is the same act as choosing one at account setup.'

/** Said where a wrong current PIN has a consequence beyond this screen. */
export const PIN_LOCK_IS_SHARED =
  'Five wrong entries lock the PIN for 15 minutes here and on a round alike: it is one PIN, not a copy of one.'
