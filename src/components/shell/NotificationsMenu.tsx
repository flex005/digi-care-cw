import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
} from '@/components/primitives'
import { Icon } from '@/components/icon/Icon'
import {
  NOTHING_IS_SENT,
  NOTIFICATIONS,
  canBeTurnedOff,
} from '@/features/profile/notification-table'
import { isTurnedOff } from '@/features/profile/preference-store'
import { formatCount, pluralise } from '@/lib/format'
import { shellIcons } from './nav.icons'
import styles from './TopBar.module.css'

/**
 * The bell, beside the account menu, as the Admin build's bar carries it.
 *
 * **It carries no count, and that is the honest version of this control.** The
 * Admin's is a button with no handler and an `alertCount` hard-coded to zero;
 * a bell with a number on it says somebody sent you that many things, and
 * nothing in this build sends anything. A count drawn from records instead —
 * doses past their window, notes waiting for review — would be a second way of
 * saying what the screens already say, computed somewhere else and free to
 * disagree with them.
 *
 * **So it opens what is true**: the notifications this product defines, how
 * many of them are on for this reader, the standing fact that nothing is sent,
 * and the way to the preferences that own it. A reader who presses a bell
 * expecting an inbox is told in the place they expected the inbox — which is
 * better than an absence they have to work out for themselves.
 */
export function NotificationsMenu() {
  const router = useRouter()

  return (
    <DropdownMenu>
      {/* Icon-only, so a name and a tooltip, never one or the other (§7). */}
      <Tooltip content="Notifications">
        <DropdownMenuTrigger
          className={styles.iconButton}
          aria-label="Notifications"
          data-notifications
        >
          <Icon name={shellIcons.notifications} size={20} />
        </DropdownMenuTrigger>
      </Tooltip>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <NotificationsSummary />
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/profile')}>
          <Icon name={shellIcons.profile} size={16} />
          Notification preferences
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * What the menu says, split out so it can be read without opening a menu.
 *
 * Radix opens on `pointerdown` and these triggers carry a tooltip as well,
 * which jsdom cannot drive; the browser can and does. Opening is Radix's job
 * and is checked there. What the words claim is this build's job, and it is
 * checked here.
 */
export function NotificationsSummary() {
  const on = NOTIFICATIONS.filter(
    (kind) => !canBeTurnedOff(kind) || !isTurnedOff(kind.id),
  ).length

  return (
    <>
      <p className={styles.menuNote} data-notifications-state>
        <span data-numeric>{formatCount(on)}</span> of{' '}
        <span data-numeric>{formatCount(NOTIFICATIONS.length)}</span>{' '}
        {pluralise(NOTIFICATIONS.length, 'notification').replace(/^\d+\s/, '')} this
        product defines are on for you.
      </p>
      <p className={styles.menuNote} data-nothing-sent>
        {NOTHING_IS_SENT}
      </p>
    </>
  )
}
