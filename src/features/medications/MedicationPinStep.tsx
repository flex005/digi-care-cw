import { useState } from 'react'
import { useSignedIn } from '@/app/session/use-session'
import {
  checkMedicationPin,
  hasChosenPin,
  pinLock,
  type PinCheck,
} from '@/app/session/medication-pins'
import { ActLine, Button, DigitField } from '@/components/primitives'
import { formatClockTime } from './pin-wording'
import styles from './MedicationPinStep.module.css'

/**
 * The medication PIN, asked at the point of an act that it confirms: a dose
 * given, a PRN dose, a countersignature (CW PRD MED-02, MED-03).
 *
 * **Named the medication PIN wherever it is asked**, and saying what it signs:
 * `signs` is the act in words, "Given: morphine sulfate 2.5mg for Emmanuel
 * Okafor". A PIN field that did not say what it was confirming is a signature
 * on a blank page.
 *
 * **Honest about what it can check.** A PIN chosen this session is checked, and
 * five wrong lock it for fifteen minutes on the real clock. Anybody who chose
 * none has nothing to check against: the first line says so, before anybody
 * types, and any four digits confirm, as any six digits pass the sign-in code.
 */
export function MedicationPinStep({
  signs,
  confirmLabel,
  onConfirmed,
  onCancel,
}: {
  signs: string
  confirmLabel: string
  onConfirmed: () => void
  onCancel: () => void
}) {
  const { member } = useSignedIn()
  const [pin, setPin] = useState('')
  const [result, setResult] = useState<PinCheck | undefined>(() => pinLock(member.id))
  const held = hasChosenPin(member.id)
  const locked = result?.kind === 'locked'

  const confirm = () => {
    const check = checkMedicationPin(member.id, pin)
    setResult(check)
    if (check.kind === 'confirmed' || check.kind === 'not_held') onConfirmed()
    else setPin('')
  }

  return (
    <div className={styles.step} data-pin-step={held ? 'held' : 'not_held'}>
      {held ? null : (
        <ActLine kind="not_performed">
          No medication PIN is held for you in this build, so nothing is checked: any
          four digits confirm.
        </ActLine>
      )}
      <p className={styles.signs}>{signs}</p>
      <DigitField
        label="Enter your medication PIN"
        length={4}
        value={pin}
        onValueChange={setPin}
        masked
        hint={hint(result)}
        // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by pressing the act it confirms, with one field and nothing else to do; MED-02 asks for the PIN at once
        autoFocus
      />
      <div className={styles.actions}>
        <Button variant="secondary" size="large" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          size="large"
          disabled={locked || pin.length !== 4}
          onClick={confirm}
          data-pin-confirm
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}

function hint(result: PinCheck | undefined): string {
  if (result === undefined) return '4-digit PIN to confirm.'
  switch (result.kind) {
    case 'wrong':
      return `That is not your medication PIN. ${result.left} ${result.left === 1 ? 'try' : 'tries'} left before it locks for 15 minutes.`
    case 'locked':
      return `Your medication PIN is locked after five wrong tries. It opens again at ${formatClockTime(result.until)}.`
    case 'confirmed':
    case 'not_held':
      return '4-digit PIN to confirm.'
  }
}
