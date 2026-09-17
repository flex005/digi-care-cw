/**
 * WCAG contrast between two colours, as the browser resolved them.
 *
 * **Computed, not typed in.** The Admin build's token sheet carried its ratios
 * as hand-measured constants, and one of them outlived the token it described:
 * `--border-unrecorded` was re-pointed to measure 3.05:1 while the sheet went on
 * saying 2.20:1. A ratio read from the rendered colours cannot disagree with the
 * token beside it.
 */
export type Rgb = [number, number, number]

/** Parses `rgb(r, g, b)` or `rgb(r g b)` as `getComputedStyle` returns it. */
export function parseRgb(value: string): Rgb | undefined {
  const match = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value)
  if (match === null) return undefined
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function channel(value: number): number {
  const scaled = value / 255
  return scaled <= 0.04045 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x,
  ) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** "4.99:1". Two places, because WCAG thresholds are stated to two. */
export const formatRatio = (ratio: number): string => `${ratio.toFixed(2)}:1`
