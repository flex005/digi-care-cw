import { useSyncExternalStore } from 'react'
import { Toast } from '@/components/primitives'

/**
 * The confirmation that a note was saved, shown after the composer has gone.
 *
 * **Why it is not a toast inside the composer.** Saving navigates to the
 * resident's Care Notes tab, which unmounts the composer and any toast it
 * rendered, so the confirmation would vanish with the screen that raised it.
 * The composer announces here and `SavedNoteToast`, mounted once beside the
 * toast viewport, draws it.
 *
 * A toast is never the only record of anything: the saved note is on the tab.
 */
interface Announcement {
  id: number
  title: string
  description: string | 'none'
}

let current: Announcement | 'none' = 'none'
let sequence = 0
const listeners = new Set<() => void>()

export function announceNoteSaved(title: string, description: string | 'none'): void {
  sequence += 1
  current = { id: sequence, title, description }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const read = () => current

export function SavedNoteToast() {
  const announcement = useSyncExternalStore(subscribe, read, read)
  if (announcement === 'none') return null
  return <Shown key={announcement.id} announcement={announcement} />
}

function Shown({ announcement }: { announcement: Announcement }) {
  const open = useSyncExternalStore(
    subscribe,
    () => current === announcement,
    () => false,
  )
  return (
    <Toast
      open={open}
      onOpenChange={(next) => {
        if (!next && current === announcement) {
          current = 'none'
          listeners.forEach((listener) => listener())
        }
      }}
      tone="positive"
      title={announcement.title}
      {...(announcement.description === 'none'
        ? {}
        : { description: announcement.description })}
    />
  )
}
