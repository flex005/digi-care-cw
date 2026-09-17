import { useState } from 'react'
import type { Answer } from '@/app/session/capabilities'
import type {
  HandoverId,
  HandoverSignature,
  IsoDate,
  IsoDateTime,
  Shift,
} from '@/data/types'
import { signHandover } from '@/data/access/client'
import { now } from '@/data/fixtures/clock'
import { useSignedIn, useSiteFormat } from '@/app/session/use-session'
import { useViewer } from '@/app/session/use-viewer'
import { ActPoint } from '@/components/layout/ActPoint'
import { Button, Dialog } from '@/components/primitives'
import { StatusPill, Unrecorded } from '@/components/status'
import { assertNever } from '@/lib/assert-never'
import { formatDate, pluralise } from '@/lib/format'
import { SHIFT_NAMES } from '@/lib/shift'
import { MedicationPinStep } from '@/features/medications/MedicationPinStep'
import styles from './handover.module.css'

/**
 * One half of the dual signature. CW PRD HO-01, Table 3: "Handover — sign off:
 * Care Worker cannot; Senior Carer can (both shifts must sign)".
 *
 * **Two signatures, given separately, because a handover is two claims**: the
 * outgoing shift saying what they are handing over, and the incoming shift
 * saying they have it. One signature covering both would let a shift walk out
 * having told nobody, with nothing on the record to show it.
 *
 * **Unsigned is a drawn state, not a blank.** A handover nobody accepted is a
 * shift change nobody took responsibility for.
 *
 * **The signature records the counts at the moment it was given.** Signing with
 * six residents nobody looked at does not mean they are well; it means handed
 * over with six holes, and the record says which. The confirmation says so
 * before the PIN goes in.
 *
 * **Confirmed with the medication PIN**, which is what the role table asks for
 * and what this build calls the thing a person chooses at account setup.
 */
export function SignatureCard({
  handoverId,
  side,
  shift,
  signature,
  reviewed,
  notReviewed,
  date,
  siteName,
  onSigned,
}: {
  handoverId: HandoverId
  side: 'outgoing' | 'incoming'
  shift: Shift
  signature: HandoverSignature
  reviewed: number
  notReviewed: number
  date: IsoDate
  siteName: string
  onSigned: (words: string) => void
}) {
  const { member } = useSignedIn()
  const viewer = useViewer()
  const format = useSiteFormat()
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const role = side === 'outgoing' ? 'Handing over' : 'Taking over'
  const total = reviewed + notReviewed
  const act = side === 'outgoing' ? 'Sign as handing over' : 'Sign as taking over'

  switch (signature.kind) {
    case 'signed':
      return (
        <div className={styles.signature} data-signature={side} data-signed="true">
          <p className={styles.signatureRole}>
            {role} · {SHIFT_NAMES[shift]} shift
          </p>
          <StatusPill
            tone="positive"
            label="Signed"
            detail={format.attribution(signature.by.displayName, signature.at)}
          />
          {/* What the signature covered. Never a bare "signed". */}
          <p className={styles.signatureCounts}>
            <span data-numeric>
              {signature.reviewed} of {signature.reviewed + signature.notReviewed}
            </span>{' '}
            residents reviewed when this was signed
            {signature.notReviewed > 0
              ? `, and ${signature.notReviewed} had not been looked at`
              : ''}
            .
          </p>
        </div>
      )
    case 'not_signed':
      break
    default:
      return assertNever(signature)
  }

  const answer = viewer.ask('sign_handover')
  const signs = `${act} for the ${SHIFT_NAMES[shift].toLowerCase()} shift at ${siteName} on ${formatDate(date)}, covering ${reviewed} of ${pluralise(total, 'resident')}${
    notReviewed > 0
      ? `. ${notReviewed} of them have not been looked at at all: this records that, and does not say they are well`
      : ''
  }.`

  const confirm = () => {
    signHandover({
      handoverId,
      side,
      by: member.ref,
      at: now().toISOString() as IsoDateTime,
      reviewed,
      notReviewed,
    })
      .then(() => {
        setSigning(false)
        onSigned(
          side === 'outgoing'
            ? `Handed over, awaiting countersign. ${reviewed} of ${pluralise(total, 'resident')} reviewed${notReviewed > 0 ? `, ${notReviewed} not looked at` : ''}.`
            : `You have taken over the handover. Both shifts have now signed.`,
        )
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Nothing was signed.'),
      )
  }

  return (
    <div className={styles.signature} data-signature={side} data-signed="false">
      <p className={styles.signatureRole}>
        {role} · {SHIFT_NAMES[shift]} shift
      </p>
      <Unrecorded
        label="Not signed"
        detail={
          side === 'outgoing'
            ? 'nobody has handed this shift over'
            : 'nobody has accepted this handover'
        }
      />
      <p className={styles.signatureCounts}>{completionLine(answer)}</p>

      {answer.kind === 'yes' ? (
        <>
          <Button
            size="large"
            onClick={() => {
              setError('')
              setSigning(true)
            }}
            data-sign={side}
          >
            {act}
          </Button>
          <Dialog
            open={signing}
            onOpenChange={setSigning}
            title={`${act}?`}
            description={`${siteName} · ${SHIFT_NAMES[shift]} shift · ${formatDate(date)}`}
          >
            {signing ? (
              <MedicationPinStep
                signs={signs}
                confirmLabel={act}
                onConfirmed={confirm}
                onCancel={() => setSigning(false)}
              />
            ) : null}
          </Dialog>
        </>
      ) : (
        <ActPoint answer={answer} label={act} notBuilt="Signing is not built." />
      )}

      {error === '' ? null : (
        <p className={styles.formError} role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * What finishing this act still needs, taken from the role table's completion
 * rather than written here. "Both shifts must sign" is a fact about the act.
 */
function completionLine(answer: Answer): string {
  if (answer.kind !== 'yes')
    return 'A handover is complete only when both shifts have signed it.'
  switch (answer.completion.kind) {
    case 'needs_a_second_signature':
      return answer.completion.by === 'the_other_shift'
        ? 'One signature is half a handover: it is complete only when the other shift has signed too.'
        : 'One signature is half this record: a second senior carer signs it too.'
    case 'done_when_done':
    case 'handed_on':
      return ''
    default:
      return assertNever(answer.completion)
  }
}
