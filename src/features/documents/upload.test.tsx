import { vi } from 'vitest'

vi.hoisted(() => {
  window.history.replaceState(null, '', '/residents/res-okafor/documents/new?at=20:20')
})

import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ResidentId } from '@/data/types'
import { staffAkinyemi, staffEze } from '@/data/fixtures/organisation'
import { residentDocuments, resetSessionDocuments } from '@/data/access/document-store'
import { endSession } from '@/data/access/session-losses'
import { renderSignedIn } from '@/test/render-signed-in'
import { UploadDocumentRoute } from './UploadDocumentRoute'
import { EMPTY_UPLOAD, expiryFrom, outstanding } from './upload-rules'

const navigation = vi.hoisted(() => ({
  pathname: '/residents/res-okafor/documents/new',
  params: { residentId: 'res-okafor' } as Record<string, string>,
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
  resetSessionDocuments()
})

async function openForm(id = staffAkinyemi.id) {
  const user = userEvent.setup()
  const rendered = renderSignedIn(id, <UploadDocumentRoute />, ROSEWOOD)
  await screen.findByRole('heading', { level: 1 })
  return { user, ...rendered }
}

const waiting = () => document.querySelector('[data-upload-waiting]')?.textContent ?? ''
const filed = () =>
  residentDocuments(OKAFOR).filter((entry) => entry.id.includes('session'))

async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  option: RegExp,
) {
  const trigger = screen.getByRole('combobox', { name: label })
  trigger.focus()
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('option', { name: option }))
}

describe('the rules', () => {
  it('will not file a document nobody has answered the expiry question about', () => {
    expect(outstanding(EMPTY_UPLOAD)).toContain('whether it expires')
    expect(
      outstanding({ ...EMPTY_UPLOAD, expiry: 'expires', expiresOn: '' }),
    ).toContain('the date it expires')
  })

  /*
   * "Does not expire" is a decision with a name on it; "nobody knows" is the
   * absence of the fact an expiry date is made of. They are not the same, and
   * the form produces whichever was chosen.
   */
  it('tells a recorded permanence from an unknown validity', () => {
    const on = '2026-09-18' as const
    expect(
      expiryFrom({ ...EMPTY_UPLOAD, expiry: 'does_not_expire' }, staffAkinyemi, on),
    ).toEqual({ kind: 'does_not_expire', decidedBy: staffAkinyemi, on })
    expect(
      expiryFrom({ ...EMPTY_UPLOAD, expiry: 'not_recorded' }, staffAkinyemi, on),
    ).toEqual({ kind: 'not_recorded' })
  })
})

describe('the form', () => {
  it('asks for what the document is and offers no file to choose', async () => {
    await openForm()
    expect(screen.queryByRole('button', { name: 'Choose a file' })).toBeNull()
    expect(screen.getByLabelText('Title')).toBeTruthy()
    expect(document.querySelector('[data-act-line]')).toBeNull()
  })

  it('files a document against this resident, in the reader’s name', async () => {
    const { user } = await openForm()
    expect(filed()).toHaveLength(0)

    await user.type(screen.getByLabelText('Title'), 'Hospital discharge summary')
    await choose(user, 'Which part of the file it goes in', /^Health and clinical/)
    await user.click(screen.getByRole('radio', { name: /^It does not expire/ }))

    await waitFor(() => expect(waiting()).toContain('Everything needed is here'))
    await user.click(screen.getByRole('button', { name: /^File this for / }))

    await waitFor(() => expect(filed()).toHaveLength(1))
    const document_ = filed()[0]!
    expect(document_.title).toBe('Hospital discharge summary')
    expect(document_.category).toBe('health_clinical')
    expect(document_.filedBy.id).toBe(staffAkinyemi.id)
    expect(document_.owner).toEqual({ kind: 'resident', residentId: OKAFOR })
    // No file in this build, and the record says so rather than inventing one.
    expect(document_.file.kind).toBe('not_retrievable')
    expect(document_.expiry.kind).toBe('does_not_expire')
  })

  it('files an unknown validity as one, and says what that means', async () => {
    const { user } = await openForm()
    await user.type(screen.getByLabelText('Title'), 'Letter from the GP')
    await choose(user, 'Which part of the file it goes in', /^Correspondence/)
    await user.click(screen.getByRole('radio', { name: /^Nobody knows/ }))

    expect(screen.getByText('Filed with its validity unknown')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^File this for / }))
    await waitFor(() => expect(filed()).toHaveLength(1))
    expect(filed()[0]!.expiry.kind).toBe('not_recorded')
  })

  it('offers a care worker nothing to file with, and no reason either', async () => {
    await openForm(staffEze.id)
    expect(document.querySelector('[data-act-line]')).toBeNull()
    expect(document.body.textContent).not.toContain(
      'Uploading a document is for a senior carer.',
    )
    expect(screen.queryByRole('button', { name: /^File this for / })).toBeNull()
  })
})
