import { useState } from 'react'
import type { Incident, Resident } from '@/data/types'
import { acknowledgeIncident } from '@/data/access/client'
import { useSignedIn } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActLine, Button, Dialog } from '@/components/primitives'
import { assertNever } from '@/lib/assert-never'
import type { Answer } from '@/app/session/capabilities'
import { typePhrase } from './incident-words'
import styles from './incidents.module.css'

/**
 * Picking an incident up. CW PRD INC-01, Table 3: a care worker cannot, a
 * senior carer can acknowledge, and a manager closes.
 *
 * **Drawn only where the role table says yes**, and only on an incident nobody
 * has picked up. The refusal for everybody else is the list's to draw, once, at
 * its head: forty rows of the same refusal is noise.
 *
 * **It names the subject in the sentence**, and says what acknowledging does
 * not do — it is not the end of the incident, and nobody is told.
 */
export function AcknowledgeControl({
  incident,
  resident,
  onAcknowledged,
}: {
  incident: Incident
  resident: Resident | undefined
  onAcknowledged: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')

  const answer = viewer.ask('acknowledge_incident')
  if (answer.kind !== 'yes') return null

  const about =
    resident === undefined
      ? `the ${typePhrase(incident.type)} with no resident involved`
      : `${resident.fullLegalName}’s ${typePhrase(incident.type)}`

  const confirm = () => {
    acknowledgeIncident({ incidentId: incident.id, by: member.ref })
      .then(() => {
        setOpen(false)
        onAcknowledged(
          `You acknowledged ${about}. ${nextWords(answer)} Nobody was told: nothing is sent from this build.`,
        )
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was acknowledged.'),
      )
  }

  return (
    <>
      <Button
        variant="secondary"
        size="large"
        onClick={() => {
          setError('')
          setOpen(true)
        }}
        data-acknowledge={incident.id}
      >
        Acknowledge
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Acknowledge ${about}?`}
        description="This records that you have picked it up. It does not close it, and it cannot be undone."
        actions={
          <>
            <Button variant="secondary" size="large" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="large"
              onClick={confirm}
              data-confirm-acknowledge
            >
              Acknowledge
            </Button>
          </>
        }
      >
        <p className={styles.dialogFacts}>{nextWords(answer)}</p>
        <ActLine kind="not_performed">
          Nobody is notified: no push to a manager, and no badge anywhere else.
        </ActLine>
        {error === '' ? null : (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    </>
  )
}

/**
 * What still has to happen after this, from the role table's completion rather
 * than written here.
 */
function nextWords(answer: Answer): string {
  if (answer.kind !== 'yes') return ''
  switch (answer.completion.kind) {
    case 'handed_on':
      return `Acknowledging is not the end of it: ${answer.completion.next} is a manager’s act.`
    case 'done_when_done':
      return ''
    case 'needs_a_second_signature':
      return 'It needs a second signature to be finished.'
    default:
      return assertNever(answer.completion)
  }
}
