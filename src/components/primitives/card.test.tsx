import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Card, CardHead } from './Card'
import { TooltipProvider } from './Tooltip'

const head = (expand: Parameters<typeof CardHead>[0]['expand']) =>
  render(
    <TooltipProvider>
      <Card>
        <CardHead title="Doses this shift" expand={expand} />
      </Card>
    </TooltipProvider>,
  )

describe('which cards carry an expand button', () => {
  it('links a subset card to its whole', () => {
    head({ kind: 'link', href: '/medications' })
    expect(
      screen.getByRole('link', { name: 'Open Doses this shift' }).getAttribute('href'),
    ).toBe('/medications')
  })

  it('draws the button for a subset whose whole is not built, and says so', () => {
    head({ kind: 'not_built' })
    expect(
      screen.getByRole('button', { name: 'Open Doses this shift, not built' }),
    ).toBeTruthy()
  })

  it('draws no button on a card that is the whole thing', () => {
    const { container } = head({ kind: 'whole' })
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('[data-expand]')).toBeNull()
  })
})
