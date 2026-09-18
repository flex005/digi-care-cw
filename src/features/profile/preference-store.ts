import { held, type SessionHolding } from '@/data/access/session-holding'
import {
  NOTIFICATIONS,
  canBeTurnedOff,
  type NotificationId,
} from './notification-table'

/**
 * Notification preferences chosen this session, in memory and nowhere else.
 *
 * **Held, because a switch that accepts a change must hand it to something.**
 * A control that forgets the moment the screen re-renders is a control that
 * does nothing, dressed as one that does — and unlike the acts that say so in
 * a line, this one can keep its own state honestly.
 *
 * **What it cannot do is make a notification arrive**, and the screen says so
 * at the switches rather than here: nothing in this build sends anything.
 *
 * Cleared when the session ends, with the medication PINs and the note drafts,
 * and counted on the sign-out screen so the list of what would go is complete.
 */
const off = new Set<NotificationId>()

/**
 * **Refuses a notification Appendix D does not let anybody turn off**, rather
 * than trusting every screen to check first. The same shape as the attendance
 * store refusing a resident who was never invited: the rule lives where the
 * write happens, so a second screen cannot get it wrong.
 */
export function turnOff(id: NotificationId): void {
  const kind = NOTIFICATIONS.find((entry) => entry.id === id)
  if (kind === undefined) throw new Error(`No notification is named ${id}.`)
  if (!canBeTurnedOff(kind))
    throw new Error(`Appendix D does not let “${kind.what}” be turned off.`)
  off.add(id)
}

export function turnOn(id: NotificationId): void {
  off.delete(id)
}

export const isTurnedOff = (id: NotificationId): boolean => off.has(id)

/** What this store would lose. */
export const preferenceHoldings = (): SessionHolding[] =>
  held('notification preferences you changed', off.size)

/** Emptied on sign out, and by tests. */
export function resetNotificationPreferences(): void {
  off.clear()
}
