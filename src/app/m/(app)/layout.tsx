import type { ReactNode } from 'react'
import { ClientOnly } from '../../client-only'

export default function PhoneAppLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="phoneApp">{children}</ClientOnly>
}
