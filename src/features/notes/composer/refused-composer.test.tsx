import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RefusedComposer } from './NoteComposerRoute'

/**
 * Where the composer would be, refused, says why in words (CLAUDE.md §6).
 *
 * **The assertions read the words, not the element.** The defect this holds
 * was an element that rendered and said nothing; a test that found
 * `[data-note-composer="refused"]` would have passed against it.
 */
const said = (answer: Parameters<typeof RefusedComposer>[0]['answer']) =>
  render(
    <RefusedComposer answer={answer} name="Emmanuel Okafor" />,
  ).container.querySelector('[data-note-composer="refused"]')?.textContent ?? ''

describe('a composer the role table refuses', () => {
  it('says the resident is not on the list, in the same words as the record', () => {
    expect(said({ kind: 'not_on_your_list' })).toContain(
      'Emmanuel Okafor is not on your list.',
    )
  })

  it('says nobody has given the reader a list', () => {
    expect(said({ kind: 'no_list_yet' })).toContain(
      'Nobody has given you a list of residents yet.',
    )
  })

  it('says the role table’s own reason when the role cannot', () => {
    expect(
      said({ kind: 'not_your_role', reason: 'Writing a care note is for a carer.' }),
    ).toContain('Writing a care note is for a carer.')
  })
})
