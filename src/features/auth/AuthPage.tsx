import type { ReactNode } from 'react'
import { Logo } from '@/components/brand/Logo'
import styles from './AuthPage.module.css'

/**
 * The frame for every screen before somebody is signed in: the grey page, the
 * logo, and one white card holding the step.
 *
 * **No dark panel.** The one dark card on a screen is the thing somebody acts
 * on next, and signing in is not that; a brand panel beside the form would
 * spend the colour on decoration.
 *
 * `after` sits under the card: the ways out of this step.
 */
export function AuthPage({
  title,
  lede,
  children,
  after,
  ...rest
}: {
  title: string
  lede?: string
  children: ReactNode
  after?: ReactNode
} & Record<`data-${string}`, string | undefined>) {
  return (
    <main className={styles.page} {...rest}>
      <div className={styles.column}>
        <span className={styles.logo}>
          <Logo variant="lockup" height={32} title="Radiant digicare" />
        </span>
        <section className={styles.card}>
          <div className={styles.heading}>
            <h1 className={styles.title}>{title}</h1>
            {lede === undefined ? null : <p className={styles.lede}>{lede}</p>}
          </div>
          {children}
        </section>
        {after === undefined ? null : <div className={styles.after}>{after}</div>}
      </div>
    </main>
  )
}

/** The fields and actions inside the card, spaced as one form. */
export function AuthStack({ children }: { children: ReactNode }) {
  return <div className={styles.stack}>{children}</div>
}

/** The step's primary act, full width, and anything beside it. */
export function AuthActions({ children }: { children: ReactNode }) {
  return <div className={styles.actions}>{children}</div>
}

/** A link-styled way out of a step, drawn as a quiet pill so it reads as a control. */
export const authLinkClass = (): string => styles.link ?? ''
