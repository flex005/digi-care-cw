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
 * Whether a card shows part of something larger, and where the whole is.
 *
 * **Required, so every card says which it is** (CLAUDE.md §6):
 *
 * - `link`: a subset, and the button goes to the whole.
 * - `not_built`: a subset whose whole is not built yet. The button is drawn and
 *   says so when tried.
 * - `whole`: the card is the whole thing (a form, a record's own detail, a list
 *   already holding every row). **No button**: there is nowhere to expand to,
 *   and a button that does nothing on press is a control that looks reachable
 *   and is not.
 */
export type CardExpand =
  { kind: 'link'; href: string } | { kind: 'not_built' } | { kind: 'whole' }

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
      {expand.kind === 'whole' ? null : <ExpandButton what={title} expand={expand} />}
    </header>
  )
}

/**
 * The small grey circle with a diagonal arrow in a card's top right corner.
 * 36px: large enough for a thumb.
 */
export function ExpandButton({
  what,
  expand,
}: {
  what: string
  expand: Exclude<CardExpand, { kind: 'whole' }>
}) {
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
