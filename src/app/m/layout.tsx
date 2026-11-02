import type { ReactNode } from 'react'
import { ClientOnly } from '../client-only'

export default function PhoneLayout({ children }: { children: ReactNode }) {
  return <ClientOnly screen="phoneShell">{children}</ClientOnly>
}
