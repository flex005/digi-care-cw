import type { Viewport } from 'next'
import type { ReactNode } from 'react'

/**
 * The phone tree's viewport.
 *
 * **390 wide, so a phone lays the app out at the width it is designed at** and
 * scales it to its screen: the frame the app sits in is 390 wide and never
 * wider than its container, so on a phone it is the screen. A desktop browser
 * ignores the declaration, so on a laptop the frame is the frame. That is how
 * one shell has two containers without asking the width of either.
 *
 * `viewport-fit=cover` lets the app draw under the notch and the home
 * indicator, which is what makes `env(safe-area-inset-*)` mean anything
 * (docs/MOBILE_APP_SHELL.md §5).
 */
export const viewport: Viewport = {
  width: 390,
  /*
   * **Declared, as undefined, to remove the root layout's `initial-scale=1`.**
   * Next copies every key a child layout names, an undefined one included, and
   * an inherited scale of 1 beside a width of 390 makes a 430-wide phone lay
   * out at 430 and a 375-wide one overflow. Without a scale the phone fits 390
   * to its screen. Checked against the emitted tag, not assumed.
   */
  initialScale: undefined,
  viewportFit: 'cover',
}

export default function PhoneTreeLayout({ children }: { children: ReactNode }) {
  return children
}
