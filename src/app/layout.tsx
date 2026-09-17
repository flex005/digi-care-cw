import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ClientOnly } from './client-only'
import '@/styles/tokens.css'
import '@/styles/reset.css'
import '@/styles/base.css'

export const metadata: Metadata = {
  title: 'diGi-Care Care Worker',
  description: 'Design specification for the diGi-Care Care Worker product.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

/**
 * The document, and nothing that reads a record. See `client-only.tsx` for
 * why every product module is loaded in the browser.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <ClientOnly screen="product">{children}</ClientOnly>
      </body>
    </html>
  )
}
