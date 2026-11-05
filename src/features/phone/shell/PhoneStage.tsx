import { useLayoutEffect, type ReactNode } from 'react'
import { PhoneApp } from './PhoneApp'
import styles from './shell.module.css'

/**
 * The phone app as `/m` shows it: one frame on a plain backdrop, and the
 * document locked so nothing but the app's own pane scrolls.
 *
 * **The frame is the app's container, not a picture of a phone.** No notch, no
 * status bar, no home indicator (docs/MOBILE_APP_SHELL.md §12): a capture of
 * this page arrives in Figma as the app and nothing to delete. On a laptop the
 * frame is 390 x 844; on a phone it is the screen, because the phone tree's
 * viewport is 390 wide and the frame never exceeds its container.
 */
export function PhoneStage({ children }: { children?: ReactNode }) {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add(styles.lockedRoot)
    return () => root.classList.remove(styles.lockedRoot)
  }, [])

  return (
    <div className={styles.stage}>
      <div className={styles.frame} data-phone-frame>
        <PhoneApp>{children}</PhoneApp>
      </div>
    </div>
  )
}
