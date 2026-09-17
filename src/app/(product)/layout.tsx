import type { ReactNode } from 'react'
import { ClientOnly } from '../client-only'

export default function ProductLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="shell">{children}</ClientOnly>
}
