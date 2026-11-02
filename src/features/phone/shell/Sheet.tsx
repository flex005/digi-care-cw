import * as Dialog from '@radix-ui/react-dialog'
import { useRef, useState, type PointerEvent, type ReactNode } from 'react'
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
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  cancel = 'Cancel',
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** The words on the control in the top-left: "Cancel", or "Done" where nothing is lost. */
  cancel?: string
  children: ReactNode
}) {
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
      <Dialog.Portal>
        <Dialog.Overlay className={styles.sheetOverlay} />
        <Dialog.Content
          className={styles.sheet}
          aria-describedby={undefined}
          style={
            drag > 0
              ? { transform: `translateY(${drag}px)`, transition: 'none' }
              : undefined
          }
          data-sheet
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
          <div className={styles.sheetBody}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
