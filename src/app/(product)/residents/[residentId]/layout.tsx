import type { ReactNode } from 'react'
import { ClientOnly } from '../../../client-only'

export default function ResidentProfileLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="residentProfile">{children}</ClientOnly>
}
