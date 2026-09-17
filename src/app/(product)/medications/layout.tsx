import type { ReactNode } from 'react'
import { ClientOnly } from '../../client-only'

export default function MedicationsLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="medicationsLayout">{children}</ClientOnly>
}
