import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(
    null,
    '',
    '/residents/res-okafor/consent/medical_treatment?at=20:20',
  )
})

import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ConsentTypeId, ResidentId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import {
  allResidents,
  resetSessionResidents,
  withResidentEdits,
} from '@/data/access/resident-store'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { ConsentDecisionRoute, NOTHING_SENT_LINE } from './ConsentDecisionRoute'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/consent/medical_treatment',
  params: { residentId: 'res-okafor', consentType: 'medical_treatment' } as Record<
    string,
    string
  >,
}))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useParams: () => navigation.params,
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

const ROSEWOOD = 'site-rosewood-court' as const
const OKAFOR = 'res-okafor' as ResidentId

beforeEach(() => {
  endSession()
  resetSessionResidents()
  navigation.params = { residentId: OKAFOR, consentType: 'medical_treatment' }
})

const stored = (id: ResidentId = OKAFOR) => {
  const found = allResidents().find((entry) => entry.id === id)
  return found === undefined ? undefined : withResidentEdits(found)
}

const consentOf = (type: ConsentTypeId) => stored()?.consents[type]

async function openGate(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <ConsentDecisionRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1 })
  return { user, ...rendered }
}

const waiting = () =>
  document.querySelector('[data-consent-waiting]')?.textContent ?? ''

describe('the fixtures reach the state this screen is for', () => {
  it('has a consent on this resident that nobody has decided', () => {
    expect(consentOf('medical_treatment')?.kind).toBe('not_sought')
  })
})

describe('the gate', () => {
  it('asks capacity first, and offers nothing else until it is answered', async () => {
    await openGate()
    expect(waiting()).toContain('whether they have capacity for this decision')
    expect(
      screen.queryByRole('radiogroup', { name: 'Who made this decision?' }),
    ).toBeNull()
    expect(screen.getByRole('button', { name: /^Record this for / })).toBeDisabled()
  })

  it('asks both Mental Capacity Act stages where capacity is lacking', async () => {
    const { user } = await openGate()
    await user.click(screen.getByRole('radio', { name: 'They lack capacity for it' }))
    expect(
      screen.getByLabelText('The impairment of, or disturbance in, mind or brain'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('Which part of deciding they cannot do, because of it'),
    ).toBeInTheDocument()
    expect(waiting()).toContain('the impairment or disturbance of mind or brain')
  })

  it('does not offer a best-interests decision where they have capacity', async () => {
    const { user } = await openGate()
    await user.click(screen.getByRole('radio', { name: 'They have capacity for it' }))
    const group = screen.getByRole('radiogroup', { name: 'Who made this decision?' })
    expect(
      within(group).getByRole('radio', { name: /^A best-interests decision/ }),
    ).toBeDisabled()
    expect(group.textContent).toMatch(/so it is theirs to make/)
  })

  it('records a decision in the reader’s name, with the authority on it', async () => {
    const { user } = await openGate()
    await user.click(screen.getByRole('radio', { name: 'They have capacity for it' }))
    await user.type(
      screen.getByLabelText('What was said and seen'),
      'Explained it twice; he repeated it back in his own words.',
    )
    await user.click(screen.getByRole('radio', { name: 'The resident decided' }))
    await user.click(screen.getByRole('radio', { name: 'Consent was given' }))
    await user.click(screen.getByRole('radio', { name: 'Verbally, and recorded here' }))

    await waitFor(() => expect(waiting()).toContain('Everything needed is here'))
    await user.click(screen.getByRole('button', { name: /^Record this for / }))

    await waitFor(() => expect(consentOf('medical_treatment')?.kind).toBe('given'))
    const decision = consentOf('medical_treatment')
    if (decision?.kind !== 'given') throw new Error('not given')
    expect(decision.recordedBy.id).toBe(staffAkinyemi.id)
    expect(decision.method).toBe('verbal')
    expect(decision.by.kind).toBe('the_resident')
    // The assessment names the one decision it was made about, never a general one.
    expect(Object.keys(decision.by.assessment.covers)).toEqual(['medical_treatment'])
    expect(decision.by.assessment.finding.kind).toBe('has_capacity')
  })

  it('says nothing is sent', async () => {
    await openGate()
    expect(screen.getByText(NOTHING_SENT_LINE)).toBeInTheDocument()
  })

  it('refuses a care worker with the role table’s reason', async () => {
    await openGate(staffEze.id)
    expect(document.querySelector('[data-act-line="refused"]')?.textContent).toBe(
      'Recording consent is for a senior carer.',
    )
    expect(screen.queryByRole('button', { name: /^Record this for / })).toBeNull()
  })
})

describe('a consent that already has a decision', () => {
  it('is not decided again here, and says why', async () => {
    navigation.params = { residentId: OKAFOR, consentType: 'care_and_support' }
    // Okafor's care and support consent is on the record already.
    await openGate()
    expect(
      screen.getAllByText(/already has a decision on this record/).length,
    ).toBeGreaterThan(0)
    // Nothing is asked: changing it means withdrawing what is there.
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Record this for / })).toBeNull()
  })
})
