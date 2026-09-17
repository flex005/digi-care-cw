# PROGRESS — diGi-Care Care Worker

Appended, never rewritten. Reasoning, bugs and discoveries. Departures from the PRD are in `docs/DEPARTURES.md`.

---

## Phase 0 — Foundation (17/09/2026)

### What exists

- **Next.js 16 App Router, React 19, TypeScript strict**, CSS Modules over `src/styles/tokens.css`, Radix primitives with hand-authored styling. Dependency versions match the Admin build's where both have the package.
- **Tokens** carried from the Admin build value for value; the palette in the brief matched it exactly. The header and the layout block are rewritten: no minimum width, one breakpoint at 1024px, compact gutter and tab bar height added.
- **Fonts** through plain `@font-face` in `tokens.css`, from the committed files.
- **Icon pipeline unchanged.** Turbopack's `query` condition (Next 16.2+) matches the `?react` imports the pipeline already emits, so `scripts/icons` needed no edit. SVGR runs with `svgo: false`: the pipeline has already normalised the icons, and a second optimiser would be a second owner of what an icon looks like.
- **Data layer compiles and its suites pass.** Ported from the Admin build because `src/data` imports them: `lib/format`, `lib/shift`, `lib/review-interval`, `lib/assert-never` (plus `lib/phone`), `features/risk/instrument`, `features/goals/goal-timing`, `features/residents/risk-flag-sources`. `hasNoRiskFlags` lives in `features/residents/RiskFlagsCell.tsx` under the cell's name, so the fixtures guard asks the question the residents list will ask.
- **Session layer**: `SessionProvider` (no default user while signed out), `capabilities.ts` (the PRD role table, each refusal with its one-line reason, and which acts the medication PIN signs), `resident-scope.ts` (the only reader of a resident assignment), `use-viewer.ts`.
- **Client-only boundary**: `src/app/client-only.tsx` holds every screen behind `dynamic(…, { ssr: false })`; route files import nothing else; the fixture clock throws without a window.
- **Shell**: sidebar and top bar on the wide layout; top bar and a bottom tab bar with More on the compact one. Unbuilt modules are present, and say "not built yet" in a popover when tried. Built or not is read from `src/app/routes.ts`. The home is always visible; a switcher appears for somebody at two homes.
- **Screens**: sign-in stand-in, a landing page that says no module is built, a not-found page, and **Specimens** (evidence states, primitives, tokens).
- **New primitives**: `DigitField` (4-digit medication PIN, masked; 6-digit code) and `ActLine` (refused / not built / not performed).
- **Guards**, each broken on purpose once, with the mutation confirmed to have landed: `check-tokens`, `check-hatch`, `check-assignment-reach`, `check-client-only`, `check-figma-export`, plus `icons:check`, ESLint, Stylelint, Prettier, and the route reachability test.
- **CLAUDE.md** (§1–§7 from the Admin build, §8 fresh), **docs/DEPARTURES.md**.

### Edits to copied material

Three, each visible against the baseline commit:

1. `src/data/access/team-store.ts` — Tolu Akinyemi at both homes, so AUTH-07 has somebody to show. **Not yet mirrored into the Admin build's fixtures.**
2. `src/data/fixtures/clock.ts` — throws if evaluated without a window.
3. `src/data/access/record-scope.test.tsx` — the last `describe` removed. It rendered the Admin build's `ResidentProfileRoute` under React Router, which does not exist here. The data-layer scope tests and the provider-unmount test stay. The screen half belongs with the residents profile.

### Decisions taken in the phase

- **Tolu Akinyemi, a senior carer, is the person at two homes**, not a care worker: a care worker's "every resident at the site" names no site once there are two.
- **Compact below 1024px**, not a phone width: a tablet held upright is handheld, and a 248px sidebar would leave it a 520px column.
- **Navigation**: Dashboard; Care delivery (Residents, Care notes, Handover, Medications); Records (Incidents, Risk assessments, Goals, Activities, Consent, Documents); Design reference (Specimens). Compact tabs: Dashboard, Residents, Care notes, Medications, More. Reports, compliance, settings and team are absent, not disabled: neither role has any access, and a disabled item reads as something coming to them.
- **A not-built nav item opens a popover** rather than a tooltip, so the line appears on a tap.
- **The sign-in stand-in offers only people whose access is live.** Folake Adebayo (suspended), Joseph Whitfield (left) and Funke Adeyinka (never given access) are not offered.
- **The token sheet measures contrast from the painted colours.** The Admin build's sheet typed its ratios in, and one had outlived its token (it said 2.20:1 for `--border-unrecorded`, which measures 3.05:1).

### Found and fixed during the phase

- **The sweep that removed the Admin build's `PRD §` citations broke nineteen sentences** where a citation sat mid-sentence ("respects 's target sizes"). Found by reading every changed comment line against the original; each repaired by hand. The citations pointed at the Admin build's `FRONTEND_PRD.md`, which does not exist here.
- **`PasswordField` imported its icons from the Admin shell's `top-bar.icons.ts`.** Moved to `password-field.icons.ts`.
- **A new nav icon failed at render until `npm run icons` ran**, which is the pipeline working: the generated registry holds only icons in use.
- **ESLint refused `setState` inside the token sheet's measuring effect.** The palette cannot change while a page is open, so the colours are now measured once in a `useState` initialiser, with no effect.
- **Token names rendered as "–purple-900".** Manrope's contextual alternates join `--` into one long dash. The DOM held the right string, and the downscaled review screenshots hid it; a crop at full resolution showed it. A token name copied out of a Figma import would have been wrong. Contextual alternates are now off for token names on the sheet.
- **The skip-to-content link's shadow drew a faint strip across the top-left of every screen**, including every capture. The shadow now applies only while the link is showing.
- **The PIN field's label did not match the password field's** on the same sheet. It now composes the password field's label class, so the two cannot drift.

### Mutations run, and what came back

Each confirmed landed in code the guard reads, then restored:

| Broken on purpose | Result |
| --- | --- |
| hatch gradient added to `TopBar.module.css` | `check-hatch` ✖ names the line |
| `<pattern>` added to `Sidebar.tsx` | `check-hatch` ✖ an SVG hatch pattern |
| `member.residentAssignment` read in `TopBar.tsx` | `check-assignment-reach` ✖ |
| `var(--space-44)` in `TabBar.module.css` | `check-tokens` ✖ not declared |
| fixtures imported by `(product)/page.tsx` | `check-client-only` ✖ names the import |
| `ssr: true` on the first screen | first attempt landed in the docblock and **passed**; re-run in code, ✖ 6 import(), 6 dynamic(), 5 ssr: false (§8) |
| static `./Product` import in `client-only.tsx` | `check-client-only` ✖ |
| `display: grid` in `AppShell.module.css` | `check-figma-export` ✖ grid |
| `fill="url(#hatch)"` in `Sidebar.tsx` | `check-figma-export` ✖ url(#…) |
| `next/font/google` import | `check-figma-export` ✖ a font package |
| `@media (width < 600px)` | `check-figma-export` ✖ names the condition |
| fixture clock imported by a route file, then `next build` | build fails: "The fixtures were loaded without a window…" |
| standing filter removed from the sign-in stand-in | 2 tests fail |
| `/` declared as building the Dashboard | 3 tests fail |
| switcher shown only above two homes | Akinyemi's switcher test fails |

### A finding about the palette, not fixed

Measured on the token sheet: **`--status-positive` is 2.46:1 on `--bg-surface` and `--status-caution` 2.75:1**, both under the 3:1 WCAG 1.4.11 asks of a non-text status indicator (a dot, a bar segment, a border). Critical measures 4.23:1, info 4.93:1 and unrecorded 3.43:1. The inks all pass on their tints. The fills are the brief's values and a token change is a stop-and-ask, so they are unchanged. Wherever a positive or caution fill is the only thing marking a state, the words beside it have to carry it, which §7 already requires.

### Admin build guards not brought across

`check-plurals`, `check-instant-kinds`, `check-percentages`, `check-tel-links`, `check-em-dashes`, `check-selector-specificity`, `check-session-losses`, `check-refusal-handled`, `check-family-writes`, `check-svg-portable`, `check-layout`. Each answers a failure that happened in the Admin build. They come across when a phase here meets the case, not before.

---

## Phase 0 review (17/09/2026)

- **Phase 0 committed** as `9e3d8d3`, after §8 was cut to the comment-mutation entry. The font-ligature account stays above, where the fix is recorded.
- **Two figures refused**, recorded in `docs/DEPARTURES.md`: the combined "Overdue now" figure, and month-on-month change on the residents list. Both are refused on the screen with a standing reason and no number, when the dashboard and the residents list are built.
- **Tolu Akinyemi at both homes in the Admin build too.** Its `team-store.ts` now matches this one line for line; its suite (77 files, 1,365 tests) and `npm run lint` pass. Noted in its `PROGRESS.md`.

### The status fills: proposal, not applied

Measured against every ground the fills sit on in either build: `--bg-surface`, `--bg-surface-sunken`, `--bg-page`, `--purple-50` (selected rows and tinted cards) and each status's own tint (the pill). `--purple-50` is the hardest of them.

| Token | Current | Worst now | Proposed | surface | sunken | page | purple-50 | own tint |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `--status-positive` | `#46bc4a` | 2.13 | `#1b9c28` | 3.60 | 3.45 | 3.32 | 3.12 | 3.33 |
| `--status-caution` | `#f07d13` | 2.38 | `#d26b05` | 3.59 | 3.44 | 3.32 | 3.11 | 3.20 |

- **How they were found**: hue held in OKLCH, lightness stepped down until the worst ground cleared 3.1:1 rather than 3.0, so the boundary is not the pass. At 3.0 the values are `#219f2b` and `#d66d06`, landing on 3.00 and 3.01 against `--purple-50`.
- **Checked twice, by different code.** A Python calculation chose the values; a comparison page computed the ratios again in the browser from the same hex, and the two agree to two places.
- **Leaving `--purple-50` out buys little**: positive would still need `#24a12e`, a lightness drop of 0.084 against 0.100.
- **How far they move.** Positive: OKLCH lightness 0.704 to 0.605, 14%, chroma unchanged. It moves from a light leaf green to a saturated mid green, and halfway to its own ink (ΔE 0.200 to 0.107), so a positive pill reads as one green rather than a light border around dark text. That changes how the palette reads. Caution: 0.707 to 0.637, 10%, chroma 0.172 to 0.158. Still reads as the same orange, slightly burnt; also closer to its ink (0.179 to 0.107), less noticeably.
- **Ink and tint are unchanged**: positive ink 4.99:1 on its tint, caution ink 4.88:1.
- **A third near-miss, not proposed**: `--status-unrecorded` is 2.97:1 on `--purple-50`. It matters only where the hatch's dashed border sits on a selected row.

The comparison page (pills, dots, bar segments and toast edges on each ground, in colour and greyscale) was built outside the repository, because a literal colour may appear only in `tokens.css`.

### Positive darkened; caution kept below 3:1 and guarded (17/09/2026)

- **`--status-positive` is `#1b9c28`.** Caution stays `#f07d13` by decision, recorded in `docs/DEPARTURES.md`, `CLAUDE.md` §4, at the token, and on the token sheet's caution row, which is where somebody would otherwise read 2.75:1 as an oversight.
- **The guard.** The decision rests on "no caution state is carried by colour alone", which would otherwise be the one rule in the build held by a sentence. It is held by construction instead: `scripts/check-caution-carriers.mjs` allows the fill only in `StatusPill.module.css` and `Toast.module.css`, and refuses a status token name built from a variable anywhere but the token sheet, because a script cannot see which status `--status-${tone}` names. `caution-carriers.test.tsx` holds the other half: both components draw their words inside the coloured element, refuse empty words (an empty string satisfies the type, so the refusal is at render), and keep the words required (a `@ts-expect-error` that goes unused, failing typecheck, if either prop becomes optional).
- **What it cannot check, said plainly**: whether the words name the state. `label="Recorded"` on a caution pill passes. Nor whether the words are visible once styled, which is the screenshot's job.
- **Mutations**, each confirmed landed in code and restored: a caution background in `TopBar.module.css` (✖ names the line); `` `var(--status-${t})` `` in `NavEntry.tsx` (✖ "built at run time"); caution removed from `Toast.module.css` (✖ the dead entry, naming Toast); `label` made optional (TS2578, unused `@ts-expect-error`); the label drawn outside the pill, the empty-label refusal disabled, the toast title not drawn (each fails its test).
- **The Admin build is not guarded.** The fill is drawn there in 26 declarations across 17 feature files besides its status pill and toast, and none has been checked for words beside it. Its `PROGRESS.md`, `AM_PRD_STATUS.md` and `tokens.css` record the decision and say that its precondition is not established there.
