import * as RadixToast from '@radix-ui/react-toast'
import styles from './Toast.module.css'

/**
 * Toast. Thin wrapper over @radix-ui/react-toast.
 *
 * Radix renders these into a live region, which is how the "live regions
 * announce alerts, omissions and save confirmations" is satisfied.
 *
 * A toast is transient, so it is never the only record of anything. A save
 * confirmation may appear here; the saved record itself appears on the page.
 */

export const ToastProvider = RadixToast.Provider

export type ToastTone = 'info' | 'positive' | 'caution' | 'critical'

export interface ToastProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  tone?: ToastTone
}

const TONE: Record<ToastTone, string> = {
  info: '',
  positive: styles.positive,
  caution: styles.caution,
  critical: styles.critical,
}

export function Toast({
  open,
  onOpenChange,
  title,
  description,
  tone = 'info',
}: ToastProps) {
  // A toast with no title is an edge of colour alone. See StatusPill.
  if (title.trim() === '')
    throw new Error(
      `A ${tone} Toast was given no title, so its colour would carry the state alone.`,
    )
  return (
    <RadixToast.Root
      open={open}
      onOpenChange={onOpenChange}
      className={[styles.toast, TONE[tone]].filter(Boolean).join(' ')}
    >
      <RadixToast.Title className={styles.title}>{title}</RadixToast.Title>
      {description ? (
        <RadixToast.Description className={styles.description}>
          {description}
        </RadixToast.Description>
      ) : null}
    </RadixToast.Root>
  )
}

export function ToastViewport() {
  return <RadixToast.Viewport className={styles.viewport} />
}
