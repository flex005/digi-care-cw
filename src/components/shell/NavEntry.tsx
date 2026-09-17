import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isBuilt } from '@/app/routes'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/primitives'
import type { NavItem } from './nav.icons'
import styles from './NavEntry.module.css'

/**
 * One way into a module, in whichever layout draws it.
 *
 * **A module that is not built is present and says so when tried.** It is not
 * hidden, because absence from a list is the same bug as a blank cell, and it
 * is not silent, because a control that does nothing says so at the point of
 * the act. A popover rather than a tooltip, so the line appears on a tap as
 * well as under a pointer.
 *
 * Built or not is read from the route declaration, never written on the item,
 * so the navigation cannot drift from the screens.
 */
export function NavEntry({
  item,
  className,
  activeClassName,
  disabledClassName,
  children,
  onNavigate,
}: {
  item: NavItem
  className: string
  activeClassName: string
  disabledClassName: string
  children: ReactNode
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
        <PopoverContent side="right" align="start" className={styles.note}>
          {item.label} is not built yet.
        </PopoverContent>
      </Popover>
    )
  }

  const active = pathname === item.path || pathname.startsWith(`${item.path}/`)
  return (
    <Link
      href={item.path}
      className={[className, active ? activeClassName : ''].filter(Boolean).join(' ')}
      aria-current={active ? 'page' : undefined}
      data-nav-module={item.module}
      data-built="true"
      onClick={onNavigate}
    >
      {children}
    </Link>
  )
}
