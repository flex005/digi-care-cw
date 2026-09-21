import { useId, useState } from 'react'
import type { IsoDateTime } from '@/data/types'
import { closeOmission, type Omission } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { Button, Dialog } from '@/components/primitives'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { DialogSubject, drugInSentence } from './subject'
import styles from '../medications.module.css'

/**
 * Closing an omission. CW PRD MED-01: a senior carer can; a care worker cannot
 * close or dismiss one.
 *
 * **Asked of the role table for this row's resident, and drawn only on a yes.**
 * The refusal is the list's to draw, once, at its head.
 *
 * **It records a decision about the gap and leaves the gap.** The dose stays a
 * dose with no record; the closure sits beside it saying who looked, when, and
 * why. So a reason is required, and the confirm stays unavailable until there
 * is one: a closure nobody explained is a dismissal.
 *
 * **The closer and the moment come from the session and the clock**, and the
 * question names the resident, the drug and the round (CLAUDE.md §2).
 *
 * **Nobody is notified**, and the dialog says so at the act.
 */
export function CloseOmissionControl({
  omission,
  onClosed,
}: {
  omission: Omission
  onClosed: (omission: Omission) => void
}) {
  const viewer = useViewer()
  const { member } = useSignedIn()
  const format = useSiteFormat()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (omission.closure.kind === 'closed') return null
  if (viewer.ask('close_omission', omission.resident.id).kind !== 'yes') return null

  const { resident, medication, record } = omission
  const due = `${record.roundTime}, ${format.instantDate(omission.dueAt)}`

  const reset = () => {
    setReason('')
    setError('')
  }

  const confirm = () => {
    if (reason.trim() === '') return
    closeOmission({
      medicationId: record.medicationId,
      date: record.date,
      roundTime: record.roundTime,
      reason,
      by: member.ref,
      at: now().toISOString() as IsoDateTime,
    })
      .then(() => {
        setOpen(false)
        reset()
        onClosed(omission)
      })
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'The omission was not closed.',
        ),
      )
  }

  return (
    <>
      <Button
        variant="secondary"
        size="large"
        onClick={() => setOpen(true)}
        data-close-omission
      >
        Close omission
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        title={`Close the omission for ${resident.fullLegalName}’s ${drugInSentence(medication)} at ${due}?`}
        description="This records that you looked at it and why it is closed. The dose stays a dose with no record."
        actions={
          <>
            <Button
              variant="secondary"
              size="large"
              onClick={() => {
                setOpen(false)
                reset()
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="large"
              disabled={reason.trim() === ''}
              onClick={confirm}
              data-confirm-close
            >
              Close omission
            </Button>
          </>
        }
      >
        <DialogSubject resident={resident} />
        <p className={styles.dialogFacts}>
          {medication.name} {medication.dose}, {medication.route.toLowerCase()}, due{' '}
          <span data-numeric>{due}</span>.
        </p>
        <div className={styles.field}>
          <label className={styles.fieldLabel} htmlFor={`${id}-reason`}>
            Why is it closed? (required)
          </label>
          <textarea
            id={`${id}-reason`}
            className={styles.textarea}
            rows={3}
            value={reason}
            aria-required="true"
            onChange={(event) => setReason(event.target.value)}
            data-close-reason
          />
        </div>
        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  )
}
