import { useState } from 'react'
import { parseRgb, type Rgb } from './contrast'

function measure(tokens: readonly string[]): Map<string, Rgb> {
  const probe = document.createElement('span')
  probe.style.position = 'absolute'
  probe.style.visibility = 'hidden'
  document.body.appendChild(probe)
  const measured = new Map<string, Rgb>()
  for (const token of tokens) {
    probe.style.color = `var(${token})`
    const rgb = parseRgb(getComputedStyle(probe).color)
    if (rgb !== undefined) measured.set(token, rgb)
  }
  probe.remove()
  return measured
}

/**
 * The colour each token resolves to in this browser, read from the rendered
 * page rather than from tokens.css, so what is measured is what is painted.
 *
 * **Measured once, on the first render.** There is one palette and no theme
 * switching, so a token cannot change colour while the page is open, and a
 * figure that could not change does not need an effect to keep it current.
 * Where there is no style engine (the test environment) nothing resolves, and
 * the sheet says "not measured" rather than printing a figure.
 */
export function useTokenColours(tokens: readonly string[]): Map<string, Rgb> {
  const [colours] = useState(() => measure(tokens))
  return colours
}
