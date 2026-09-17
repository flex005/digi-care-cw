import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isBuilt } from '@/app/routes'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
} from '@/components/primitives'
import type { NavItem } from './nav.icons'
import styles from './NavEntry.module.css'

/**
 * One way into a module, in whichever place draws it: the navigation pill, the
 * icon rail, the bottom tabs, or More.
 *
 * **A module that is not built is present and says so when tried.** Not
 * hidden, because absence from a list is the same bug as a blank cell; not
 * silent, because a control that does nothing says so at the point of the
 * act. A popover rather than a tooltip, so the line appears on a tap as well
 * as under a pointer.
 *
 * **Icon-only entries carry their name twice**: as the accessible name, and in
 * a tooltip for a sighted reader, because an icon with no label is a guess.
 *
 * Built or not is read from the route declaration, never written on the item.
 */
export function NavEntry({
  item,
  className,
  activeClassName,
  disabledClassName,
  children,
  iconOnly = false,
  tooltipSide = 'right',
  onNavigate,
}: {
  item: NavItem
  className: string
  activeClassName: string
  disabledClassName: string
  children: ReactNode
  iconOnly?: boolean
  tooltipSide?: 'top' | 'right' | 'bottom' | 'left'
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  if (!isBuilt(item.module)) {
    return (
      <Popover>
        <PopoverTrigger
          className={[className, disabledClassName].join(' ')}
          aria-label={`${item.label}, not built`}
          data-nav-module={item.module}
          data-built="false"
        >
          {children}
        </PopoverTrigger>
        <PopoverContent side={tooltipSide} align="start" className={styles.note}>
          {item.label} is not built yet.
        </PopoverContent>
      </Popover>
    )
  }

  const active = pathname === item.path || pathname.startsWith(`${item.path}/`)
  const link = (
    <Link
      href={item.path}
      className={[className, active ? activeClassName : ''].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
      aria-label={iconOnly ? item.label : undefined}
      data-nav-module={item.module}
      data-built="true"
      onClick={onNavigate}
    >
      {children}
    </Link>
  )
  return iconOnly ? (
    <Tooltip content={item.label} side={tooltipSide}>
      {link}
    </Tooltip>
  ) : (
    link
  )
}
