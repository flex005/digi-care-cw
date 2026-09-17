import { contrastRatio, formatRatio } from './contrast'
import { useTokenColours } from './use-token-colours'
import styles from './specimens.module.css'

/**
 * Every colour, type step, spacing step, radius and shadow, drawn from the
 * tokens themselves. Nothing here holds a literal, so the sheet cannot drift
 * from tokens.css.
 */

const BRAND = [
  '--purple-900',
  '--purple-600',
  '--purple-400',
  '--purple-200',
  '--purple-50',
]
const SURFACES = ['--bg-page', '--bg-surface', '--bg-surface-sunken']
const INKS = ['--ink-900', '--ink-700', '--ink-500', '--ink-400']
const BORDERS = ['--border-strong', '--border-subtle', '--border-unrecorded']
const STATUSES = ['positive', 'caution', 'critical', 'info', 'unrecorded'] as const

const TYPE_STEPS = [
  'display',
  'h1',
  'h2',
  'h3',
  'body',
  'body-sm',
  'caption',
  'micro',
  'mono-num',
]
const WEIGHTS = ['regular', 'medium', 'semibold', 'bold', 'extrabold']
const SPACES = [4, 8, 12, 16, 20, 24, 32, 40, 48, 64]
const RADII = ['sm', 'md', 'lg', 'xl', 'pill']

const MEASURED = [
  ...BRAND,
  ...SURFACES,
  ...INKS,
  ...BORDERS,
  ...STATUSES.flatMap((s) => [
    `--status-${s}`,
    `--status-${s}-ink`,
    `--status-${s}-tint`,
  ]),
]

function Swatch({ token, meta }: { token: string; meta?: string }) {
  return (
    <div className={styles.swatch}>
      <div className={styles.swatchChip} style={{ backgroundColor: `var(${token})` }} />
      <span className={styles.swatchName}>{token}</span>
      {meta === undefined ? null : <span className={styles.swatchMeta}>{meta}</span>}
    </div>
  )
}

export function TokenSheet() {
  const colours = useTokenColours(MEASURED)

  const ratio = (foreground: string, background: string): string => {
    const a = colours.get(foreground)
    const b = colours.get(background)
    return a === undefined || b === undefined
      ? 'not measured'
      : formatRatio(contrastRatio(a, b))
  }

  return (
    <div className={styles.sheet}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Colour</h2>
        <p className={styles.sectionNote}>
          Values live only in src/styles/tokens.css. Every contrast figure on this sheet
          is measured from the colours the browser painted.
        </p>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Brand</span>
          <div className={styles.swatches}>
            {BRAND.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Surfaces</span>
          <div className={styles.swatches}>
            {SURFACES.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Ink, on --bg-surface</span>
          <div className={styles.swatches}>
            {INKS.map((token) => (
              <Swatch key={token} token={token} meta={ratio(token, '--bg-surface')} />
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Borders</span>
          <div className={styles.swatches}>
            {BORDERS.map((token) => (
              <Swatch
                key={token}
                token={token}
                meta={
                  token === '--border-unrecorded'
                    ? `${ratio(token, '--status-unrecorded-tint')} on the unrecorded tint`
                    : undefined
                }
              />
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Status: fill, ink, tint</h2>
        <p className={styles.sectionNote}>
          The fill is for dots, bars, borders and icons. The ink is for text on the
          tint. Text in the fill colour fails contrast.
        </p>
        {STATUSES.map((status) => (
          <div key={status} className={styles.group}>
            <span className={styles.groupTitle}>{status}</span>
            <div className={styles.swatches}>
              <Swatch
                token={`--status-${status}`}
                meta={`${ratio(`--status-${status}`, '--bg-surface')} on surface`}
              />
              <Swatch
                token={`--status-${status}-ink`}
                meta={`${ratio(`--status-${status}-ink`, `--status-${status}-tint`)} on tint`}
              />
              <Swatch token={`--status-${status}-tint`} />
            </div>
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Type: nine steps, five weights</h2>
        {TYPE_STEPS.map((step) => (
          <div key={step} className={styles.typeRow}>
            <span className={styles.typeToken}>--text-{step}</span>
            <span
              style={{
                fontSize: `var(--text-${step}-size)`,
                lineHeight: `var(--text-${step}-line)`,
                fontVariantNumeric: step === 'mono-num' ? 'tabular-nums' : undefined,
              }}
            >
              {step === 'mono-num'
                ? '08:04 · 1,024mg · 46 of 50'
                : 'Emmanuel Okafor · Room 14'}
            </span>
          </div>
        ))}
        <div className={styles.group}>
          <span className={styles.groupTitle}>Weights</span>
          <div className={styles.row}>
            {WEIGHTS.map((weight) => (
              <span key={weight} style={{ fontWeight: `var(--weight-${weight})` }}>
                {weight}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Spacing, radii, elevation</h2>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Spacing</span>
          {SPACES.map((space) => (
            <div key={space} className={styles.spacingRow}>
              <span className={styles.typeToken}>--space-{space}</span>
              <span
                className={styles.spacingBar}
                style={{ width: `var(--space-${space})` }}
              />
            </div>
          ))}
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Radii</span>
          <div className={styles.row}>
            {RADII.map((radius) => (
              <span
                key={radius}
                className={styles.radiusChip}
                style={{ borderRadius: `var(--radius-${radius})` }}
              >
                {radius}
              </span>
            ))}
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupTitle}>Elevation</span>
          <div className={styles.row}>
            <span
              className={styles.shadowChip}
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              --shadow-card
            </span>
            <span
              className={styles.shadowChip}
              style={{ boxShadow: 'var(--shadow-overlay)' }}
            >
              --shadow-overlay
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
