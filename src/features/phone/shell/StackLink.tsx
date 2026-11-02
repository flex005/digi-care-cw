import type { MouseEvent, ReactNode } from 'react'
import { pathOf, type Place } from '../phone-paths'
import { usePhoneNav } from './nav'

/**
 * A way to another place on the phone: pushed onto the stack, never a document
 * load (docs/MOBILE_APP_SHELL.md §2).
 *
 * **Still an anchor with a real address**, so it reads as a link, can be opened
 * in a new tab with a modifier, and survives a reload. A plain tap pushes.
 */
export function StackLink({
  to,
  className,
  children,
  label,
}: {
  to: Place
  className: string
  children: ReactNode
  /** The accessible name, where the visible content alone would not be one. */
  label?: string
}) {
  const nav = usePhoneNav()
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return
    event.preventDefault()
    nav.push(to)
  }
  return (
    <a href={pathOf(to)} className={className} onClick={onClick} aria-label={label}>
      {children}
    </a>
  )
}
