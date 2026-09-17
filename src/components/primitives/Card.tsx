import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/icon/Icon'
import { shellIcons } from '@/components/shell/nav.icons'
import { Popover, PopoverContent, PopoverTrigger } from './Popover'
import styles from './Card.module.css'

/**
 * A white card floating on the grey page: 28px radius, the two-layer shadow,
 * no border, 22px inside. The visual direction's surface for everything.
 */
export interface CardProps {
  children: ReactNode
  /** Off for content that runs edge to edge, such as a table. */
  padded?: boolean
  className?: string
}

export function Card({ children, padded = true, className }: CardProps) {
  return (
    <section
      className={[styles.card, padded ? styles.padded : '', className]
        .filter(Boolean)
        .join(' ')}
      data-card
    >
      {children}
    </section>
  )
}

/**
 * Where a card's expand button goes.
 *
 * **Required, because every card has one.** A card that leads nowhere has to
 * say so rather than drop the button, or a reader learns that the button is
 * sometimes there and stops looking for it. `not_built` draws the button and
 * says, when tried, that the screen behind it does not exist yet.
 */
export type CardExpand = { kind: 'link'; href: string } | { kind: 'not_built' }

export interface CardHeadProps {
  title: string
  /** One line: the scope, or where a denominator belongs. */
  subtitle?: string
  expand: CardExpand
}

export function CardHead({ title, subtitle, expand }: CardHeadProps) {
  return (
    <header className={styles.head}>
      <div className={styles.heading}>
        <h2 className={styles.title}>{title}</h2>
        {subtitle === undefined ? null : <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <ExpandButton what={title} expand={expand} />
    </header>
  )
}

/**
 * The small grey circle with a diagonal arrow in a card's top right corner.
 * 36px: large enough for a thumb.
 */
export function ExpandButton({ what, expand }: { what: string; expand: CardExpand }) {
  const arrow = <Icon name={shellIcons.expand} size={16} />
  if (expand.kind === 'link') {
    return (
      <Link href={expand.href} className={styles.expand} aria-label={`Open ${what}`}>
        {arrow}
      </Link>
    )
  }
  return (
    <Popover>
      <PopoverTrigger
        className={styles.expand}
        aria-label={`Open ${what}, not built`}
        data-expand="not_built"
      >
        {arrow}
      </PopoverTrigger>
      <PopoverContent align="end" className={styles.note}>
        The screen behind {what} is not built yet.
      </PopoverContent>
    </Popover>
  )
}
