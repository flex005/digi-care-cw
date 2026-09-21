import { useId, useState } from 'react'
import type { HandoverId, HandoverStatus, IsoDateTime, Resident } from '@/data/types'
import { recordHandoverStatus } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { Button, Dialog, RadioGroup } from '@/components/primitives'
import styles from './handover.module.css'

/**
 * Setting one resident's status on this handover. CW PRD HO-01, where both
 * roles update the board.
 *
 * **Asked of the role table for this resident, and drawn either way.** Table 3
 * gives a care worker their assigned residents and says nothing about the rest,
 * so a resident off their list draws the question rather than a control or a
 * silence: the board is the home's, and whether a care worker may mark somebody
 * on it who is not on their list is for the PRD's author. A care worker nobody
 * has given a list is told that, at the act, rather than shown a live control.
 *
 * **A write surface, so it names the subject** in the title, in the legend and
 * on the button. A status set against the wrong resident is how the wrong
 * person gets watched overnight and the right one does not.
 *
 * **No default.** The radio group opens on nothing chosen, so "All well" is
 * something somebody says rather than something the form said for them. Needs
 * attention and Urgent are refused without a note, by the loader as well as
 * here: a status telling the incoming shift somebody needs attention without
 * saying what for is a signal with nothing behind it.
 */
type Choice = 'all_well' | 'needs_attention' | 'urgent'

const LABELS: Record<Choice, string> = {
  all_well: 'all well',
  needs_attention: 'needing attention',
  urgent: 'urgent',
}

export function StatusControl({
  handoverId,
  resident,
  current,
  onRecorded,
}: {
  handoverId: HandoverId
  resident: Resident
  current: HandoverStatus
  /**
   * What was recorded, for the screen to announce. Not announced here: this
   * control sits in a row that the write moves to another group, so a message
   * owned here would be unmounted by the act it was confirming.
   */
  onRecorded: (residentName: string, status: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [choice, setChoice] = useState<Choice | 'not_chosen'>('not_chosen')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  const label = current.kind === 'not_reviewed' ? 'Review' : 'Change'
  const answer = viewer.ask('update_handover_status', resident.id)
  if (answer.kind !== 'yes')
    return (
      <ActPoint
        answer={answer}
        label={label}
        notBuilt="Recording a handover status is not built."
        residentName={resident.preferredName}
      />
    )

  const needsNote = choice === 'needs_attention' || choice === 'urgent'
  const ready = choice !== 'not_chosen' && (!needsNote || note.trim() !== '')

  const reset = () => {
    setChoice('not_chosen')
    setNote('')
    setError('')
  }

  const submit = () => {
    if (choice === 'not_chosen') return
    const at = now().toISOString() as IsoDateTime
    const status: HandoverStatus =
      choice === 'all_well'
        ? { kind: 'all_well', recordedBy: member.ref, recordedAt: at }
        : { kind: choice, note: note.trim(), recordedBy: member.ref, recordedAt: at }

    recordHandoverStatus({ handoverId, residentId: resident.id, status })
      .then(() => {
        setOpen(false)
        onRecorded(resident.preferredName, LABELS[choice])
        reset()
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was recorded.'),
      )
  }

  return (
    <>
      {/* Large: a clinical act, and on the compact layout a touch target
          (CLAUDE.md §7). */}
      <Button
        variant="secondary"
        size="large"
        onClick={() => {
          reset()
          setOpen(true)
        }}
        data-status-act={resident.id}
      >
        {label}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        title={`How is ${resident.fullLegalName} for this handover?`}
        description={`${resident.preferredName} · ${
          resident.room.kind === 'recorded'
            ? `Room ${resident.room.value}`
            : 'Room not recorded'
        }`}
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
              disabled={!ready}
              onClick={submit}
              data-confirm-status
            >
              {`Record this for ${resident.preferredName}`}
            </Button>
          </>
        }
      >
        <RadioGroup
          legend={`Status for ${resident.fullLegalName}`}
          value={choice === 'not_chosen' ? undefined : choice}
          onValueChange={(value) => setChoice(value as Choice)}
          options={[
            { value: 'all_well', label: 'All well' },
            { value: 'needs_attention', label: 'Needs attention' },
            { value: 'urgent', label: 'Urgent' },
          ]}
        />

        {needsNote ? (
          <div className={styles.field}>
            <label className={styles.fieldLabel} htmlFor={`${id}-note`}>
              What does the incoming shift need to do? (required)
            </label>
            <textarea
              id={`${id}-note`}
              className={styles.textarea}
              rows={4}
              value={note}
              aria-required="true"
              onChange={(event) => setNote(event.target.value)}
              data-status-note
            />
          </div>
        ) : null}

        {/* HO-01 sends an immediate count and a push to the senior on duty when
            somebody is marked urgent. Nothing is sent from here, and the act
            says so where it is performed. */}

        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  )
}
