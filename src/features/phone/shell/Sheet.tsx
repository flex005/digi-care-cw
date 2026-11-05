import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { useFrame } from './nav'
import styles from './shell.module.css'

/** How far down a sheet has to be dragged before letting go closes it. */
const CLOSES_AT = 96

/**
 * A sheet: what the phone does instead of a route for anything short — a
 * picker, a confirmation, a form (docs/MOBILE_APP_SHELL.md §3).
 *
 * It rises over the screen you are on, which stays visible behind it, dimmed.
 * **It closes three ways**: dragging the handle down past a threshold, Cancel
 * in its own top-left, or a tap on the dimmed screen. Radix supplies the focus
 * trap, the escape key and the accessible name; the look is ours.
 *
 * **Full height, for a task too tall for a short sheet**: a composer, a picker
 * with a search. It covers the whole app, pins `head` under its title (the
 * subject of a write, CLAUDE.md §2), and scrolls its body as the one pane of
 * its layer. **While it is open the screen beneath cannot scroll or be
 * reached**: its tab is made inert and its pane stops scrolling, so the person
 * can scroll exactly one thing (docs/MOBILE_APP_SHELL.md §1).
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  cancel = 'Cancel',
  height = 'short',
  head,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The words on the control in the top-left: "Cancel", or "Done" where nothing is lost. */
  cancel?: string
  /** A short sheet sized to what it holds, or one covering the whole app. */
  height?: 'short' | 'full'
  /** Pinned under the title, outside the scrolling body. */
  head?: ReactNode
  children: ReactNode
}) {
  const frame = useFrame()

  /* The lock: only the tab that is showing, and only what this sheet changed. */
  useEffect(() => {
    if (!open || height !== 'full' || frame === null) return
    const tabs = [...frame.querySelectorAll<HTMLElement>('[data-tab]')].filter(
      (tab) => !tab.hasAttribute('inert'),
    )
    const panes = tabs.flatMap((tab) => [
      ...tab.querySelectorAll<HTMLElement>('[data-scroll-pane]'),
    ])
    for (const tab of tabs) tab.setAttribute('inert', '')
    for (const pane of panes) pane.style.overflowY = 'hidden'
    return () => {
      for (const tab of tabs) tab.removeAttribute('inert')
      for (const pane of panes) pane.style.overflowY = ''
    }
  }, [open, height, frame])

  const [drag, setDrag] = useState(0)
  const from = useRef<number | null>(null)

  const down = (event: PointerEvent<HTMLDivElement>) => {
    from.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (from.current === null) return
    setDrag(Math.max(0, event.clientY - from.current))
  }
  const up = () => {
    if (from.current === null) return
    from.current = null
    if (drag > CLOSES_AT) onOpenChange(false)
    setDrag(0)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal container={frame ?? undefined}>
        <Dialog.Overlay className={styles.sheetOverlay} />
        <Dialog.Content
          className={
            height === 'full' ? `${styles.sheet} ${styles.sheetFull}` : styles.sheet
          }
          aria-describedby={undefined}
          style={
            drag > 0
              ? { transform: `translateY(${drag}px)`, transition: 'none' }
              : undefined
          }
          data-sheet={height}
        >
          <div
            className={styles.sheetGrab}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <span className={styles.sheetHandle} aria-hidden="true" />
            <div className={styles.sheetHead}>
              <Dialog.Close className={`${styles.sheetCancel} ${styles.press}`}>
                {cancel}
              </Dialog.Close>
              <Dialog.Title className={styles.sheetTitle}>{title}</Dialog.Title>
              <span className={styles.sheetSide} aria-hidden="true" />
            </div>
          </div>
          {head === undefined ? null : <div className={styles.sheetPinned}>{head}</div>}
          <div
            className={
              height === 'full'
                ? `${styles.pane} ${styles.sheetBody} ${styles.sheetBodyFull}`
                : styles.sheetBody
            }
            data-sheet-pane={height === 'full' ? '' : undefined}
          >
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
