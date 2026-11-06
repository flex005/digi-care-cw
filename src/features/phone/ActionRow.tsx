import { Children, type HTMLAttributes, type ReactNode } from 'react'
import styles from './phone.module.css'

/**
 * A row of actions on the phone. **Never stacked, at any count.**
 *
 * - **One or two share the width equally**, side by side. A label too long for
 *   its half wraps to two lines inside its own pill; no label is shortened to
 *   fit, because the wording is deliberate.
 * - **Three or more are a rail** that scrolls sideways and bleeds past the
 *   gutter to the screen edge, so the next action is visibly cut off. The cut
 *   is the affordance: without it nobody can tell there is more, and an action
 *   nobody knows exists does not exist.
 *
 * The rail is the one horizontal scroller the shell allows, and it never
 * scrolls vertically: the pane is still the one vertical scroll of its layer
 * (docs/MOBILE_APP_SHELL.md §1). It must sit inside the gutter it bleeds past.
 */
export function ActionRow({
  children,
  ...rest
}: { children: ReactNode } & Omit<HTMLAttributes<HTMLDivElement>, 'className'>) {
  const count = Children.toArray(children).length
  const shape = count >= 3 ? 'rail' : 'pair'
  return (
    <div
      {...rest}
      className={shape === 'rail' ? styles.actionRail : styles.actionPair}
      data-action-row={shape}
    >
      {children}
    </div>
  )
}
