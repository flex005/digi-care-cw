import type { ReactNode } from 'react'
import { SessionProvider } from '@/app/session/SessionProvider'
import { ToastProvider, ToastViewport, TooltipProvider } from '@/components/primitives'

/** The providers every screen sits inside, signed in or not. */
export function Product({ children }: { children?: ReactNode }) {
  return (
    <SessionProvider>
      <TooltipProvider delayDuration={200}>
        <ToastProvider>
          {children}
          <ToastViewport />
        </ToastProvider>
      </TooltipProvider>
    </SessionProvider>
  )
}
