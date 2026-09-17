import { createContext, useContext } from 'react'
import type { ResidentProfile } from '@/data/access/client'
import type { Medication } from '@/data/types'

/**
 * The resident whose record is open, for every tab beneath the profile head.
 *
 * **From the route parameter and nothing else** (CLAUDE.md §2). The layout
 * loads it by the id in the address and provides it here, and a tab reads it
 * here rather than being handed a resident by whatever screen came before.
 *
 * Only a record the viewer may open reaches this context: the layout asks the
 * role table first, and a resident not on the viewer's list never loads into a
 * tab.
 */
export interface OpenRecord extends ResidentProfile {
  /** Everything prescribed, for what the medication figure is out of. */
  medications: Medication[]
}

export const ProfileContext = createContext<OpenRecord | undefined>(undefined)

export function useOpenRecord(): OpenRecord {
  const record = useContext(ProfileContext)
  if (record === undefined)
    throw new Error('A profile tab was rendered outside the resident profile.')
  return record
}
