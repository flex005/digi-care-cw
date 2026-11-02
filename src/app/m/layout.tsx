import type { Viewport } from 'next'
import type { ReactNode } from 'react'
import { ClientOnly } from '../client-only'

/**
 * The phone app. `viewport-fit=cover` lets the app draw under the notch and the
 * home indicator, which is what makes `env(safe-area-inset-*)` mean anything
 * (docs/MOBILE_APP_SHELL.md §5). Declared here so it reaches the phone tree and
 * not the desktop one.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function PhoneLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="phoneApp">{children}</ClientOnly>
}
