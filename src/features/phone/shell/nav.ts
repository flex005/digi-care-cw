import { createContext, useContext } from 'react'
import type { Place, TabId } from '../phone-paths'

/**
 * How a phone screen moves: push a place onto the tab it is on, pop back off
 * it, or switch tab. The shell owns the stacks; a screen only asks.
 */
export interface PhoneNav {
  push: (place: Place) => void
  back: () => void
  switchTab: (tab: TabId) => void
}

export const PhoneNavContext = createContext<PhoneNav | null>(null)

export function usePhoneNav(): PhoneNav {
  const nav = useContext(PhoneNavContext)
  if (nav === null) throw new Error('usePhoneNav was reached outside the phone shell.')
  return nav
}

/**
 * Whether the screen asking is the one in front: the top of the tab that is
 * showing. A screen behind another, or on a hidden tab, stays mounted so its
 * scroll survives, and must not take focus.
 */
export const InFrontContext = createContext(true)

export const useInFront = (): boolean => useContext(InFrontContext)
