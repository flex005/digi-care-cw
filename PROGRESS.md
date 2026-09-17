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

---

## Visual direction applied (17/09/2026)

The shape language is `docs/cw-dashboard.html`: it wins on radius, density and layout, and Phase 0 wins on token values and meaning.

### What changed

- **Tokens**: `--bg-page` `#eef1f7` (named in the direction, so applied although it is a token value); radii `md` 14, `lg` 20, `xl` 28; `--shadow-card` the reference's two layers; `--card-padding` 22px, the one spacing value off the 4px scale; sidebar layout tokens replaced by `--layout-rail-width` and `--layout-content-max`.
- **Shell**: a pill top bar holding the lockup, the navigation pill, the home and the account; an icon rail in two grouped pills (every module, then profile and sign out); on a compact screen a floating pill of bottom tabs, and no navigation pill. The page scrolls and the rail sticks. The labelled sidebar is gone.
- **Primitives**: every button a pill; `Card` with no border, 28px radius and 22px inside; `CardHead` with a required expand button (`ExpandButton`), which says "not built" when tried if the card leads nowhere yet; `StatusPill` as tint, ink and a dot in the ink colour, sentence case, no border; `AggregateFigure` with no surface of its own and the figure and its denominator on one baseline.
- **New**: `PageHead`, `ActionCard` (the one dark card), `GapCount` (the hatched card counting a gap), `RoundColumns` (one straight column per round, with counts beneath and a legend drawn by the same class as the segments), `shiftHours`, `greetingAt`, and `scopeLine` / `scopeNote` as the one owner of "N residents on your list" and "Counted over your list, not the home's."
- **Specimens**: a Shapes tab first, with every new shape; specimen sections are cards.

### Decisions taken

- **The type scale stays closed.** The reference's 52px and 40px figures are not on it; the dark card and the gap card use `--text-display` (32px). The largest figure on a screen is still the dark card's, by position rather than by an extra step.
- **The rail holds every module, and the pill holds five of them in the reference's order** (Today, Residents, Medications, Handover, Activities), declared once as `PILL_MODULES`. Both mark the module you are in. The dashboard's name in navigation is "Today", as the reference has it.
- **The home stays in the top bar**, as a pill beside the avatar, because §2 requires it visible on every screen and the reference only names it in the dashboard's head.
- **The reference's search and notification buttons are not drawn.** Neither is in this build, and a red dot on a bell is colour carrying a count with no number.
- **The page head sits beside the rail, not above it**, because it belongs to each screen rather than to the shell.
- **The compact layout had to be designed**: the reference at 390px overflows to the right and draws no bottom tabs.
- **Nothing in the chrome is green.**

### Found and fixed

- **The hatch had two sizes, and the heavy one was wrong for bars.** The Admin build's solid-banded chart size read as dark stripes across a tall segment. The reference bands the tint inside a dashed edge, and the dashed edge is what carries a thin segment. So `.unrecordedMark` composes the ordinary hatch, the chart size is removed, and `check-hatch` holds one size; mutated with a second gradient, it failed.
- **The bar hatch was invisible on a grey track.** The tint bands measure nothing against `--bg-page`; the columns now have no fill, and the hatch sits on the card's white as it does in the reference. The current round's outline moved to its recorded part, off the dashed edge.
- **"23 across 37 doses due".** `AggregateFigure` wrote "across" for every count, which is right for notes over residents and wrong for a subset. `relation` is now required.
- **The status pill no longer draws the caution fill**, and `check-caution-carriers` failed on its now-dead entry, naming the pill. The toast is the only carrier, and every record saying "StatusPill and Toast" is corrected.
- **The navigation pill followed the rail's order**, putting Handover before Medications. Caught by the test naming the five in order.
- **"Medications" truncated in the bottom tabs**; More gives its width to the four.
- **The chrome specimen overflowed at 390px**; it scrolls inside its card.

### Two fixes on review

- **Two type steps added above display**: `--text-hero` 52px on a 56px line, for the dark card's figure only, and `--text-figure` 40px on a 44px line, for a figure with its denominator in a card (the gap card and a lead `AggregateFigure`). `check-tokens` now fails if any stylesheet but `ActionCard.module.css` reaches for `--text-hero`, and if that one stops; both mutated, both failed, naming the line. Its heading said "a custom property that does not exist" over a hero finding, which was untrue of it, and now counts findings.
- **The navigation pill lost its white thumb.** A raised thumb on a grey track is the segmented control's shape, for presentations of the same data, and navigation goes to different data. The tab you are on is `--ink-900` at extra-bold against `--ink-500` at medium; checked by screenshot with the real active class applied, since no pill module is built yet. At 390px the pill is not drawn at all: the bottom tabs replace it.

---

## Phase 1 — Authentication (17/09/2026)

### What exists

- **Sign in** (AUTH-04, 06), **the code step** (AUTH-05, and AUTH-03 when setting up an account), **choosing a home** (AUTH-07), **invitations** (an index standing in for the inbox, the email drawn, account setup, and the expired state; AUTH-01, 02), **forgot password** in four screens (AUTH-08), **signed out by inactivity**, **the session expiry warning** in the shell, and **the sign-out confirmation** listing what would be lost (AUTH-09). Outside the shell they share `AuthPage`: the grey page, the logo, one white card, no dark panel.
- **A pending sign-in held in the session** (`awaiting_code`, `choosing_home`), so each step is reachable only by passing the one before it and a reload starts at sign-in.
- **The rules as predicates**: `password-rules.ts` (five, rendered as "N of 5 rules met" and used to refuse a sign-in), `pin-rules.ts` (and the one it cannot check), `lockout.ts` (five refusals, fifteen minutes, real clock), `session-timeout.ts` (twelve hours, `?timeout=` read once).
- **`TextField`**, taking its label and input from the password field.
- **`medication-pins.ts`**: the PIN chosen at setup is held for the session and counted at sign-out.
- **Fixtures, in both builds**: invitations good for three days; Hannah Price's expired invitation. The Admin suite passes with them (77 files, 1,366 tests).

### Decisions taken

- **The address a person signs in with is the Admin build's derivation**, so it is the same in both products.
- **"Who would you like to sign in as?"** replaces the stand-in, labelled as a demonstration; it fills a password that meets every rule, so a reviewer can reach each role without inventing one.
- **Setting up an account grants access for the session** rather than stopping at "nothing was created", so AUTH-02, AUTH-03 and the first dashboard are one reachable path.
- **The sign-out confirmation is a panel, not a card**: it has nowhere to expand to, and an expand button that could only say "not built" would be noise.
- **`autoFocus` on the code field has a named ESLint exception** at the call site: the PRD asks for it and the screen has one field.

### Found and fixed

- **`?timeout=` did nothing.** The timeout module read the address when the shell's code loaded, after signing in had navigated twice and dropped the query. Found when the screenshot walk timed out waiting for the warning. It is now read once by the session provider on its first render. `session-end.test.tsx` renders under an address carrying `?timeout=10`, drops it, and asserts the warning; mutated back to reading the address at render (confirmed landed), it failed.
- **The read-only fields rendered as the browser's own inputs.** `.readOnly` composed `.input` in the same file, which composes from `password-field.module.css`, and the chain did not resolve. It now composes from the password field directly; no other stylesheet has that chain.
- **A test asserted `expect(container).toBeTruthy()`** under the name "says nothing is sent before anything else", which could not fail. It now asserts the not-performed line is the form's first element, and moving the line below the field fails it.

### Mutations run, and what came back

Each confirmed landed, then restored:

| Broken on purpose | Result |
| --- | --- |
| an unknown address refused as "No account uses that address" | the naming-neither-field test fails |
| the lock not checked on submit | the lockout test fails |
| a two-home person signed straight in after the code | the choose-a-home test fails |
| `1234` allowed as a PIN | the PIN rule test and the setup test fail |
| the nothing-sent line moved below the code field | the first-element test fails |
| no sign-out when the session reaches zero | the expiry test fails |
| the sign-out button without its count | the sign-out list test fails |
| the warning reading `?timeout=` from the current address | the kept-timeout test fails |

### The one to remember from Phase 1

**A parameter read after the navigation that made it irrelevant is invisible to every test.** `?timeout=` was read when the shell's code loaded, which is after sign-in has navigated twice and dropped the query, so it silently did nothing. Every unit test rendered the banner with the value already in hand, the suite was green, and only walking the real flow in a browser showed a warning that never came. Where a value arrives in the address, read it where the address is still the one it arrived in.

### Looking at the Admin build's screens, and the first look that was not one

The Admin build's Team and invitation screens were screenshotted with the new fixtures before its commit; what they show is in that build's `PROGRESS.md`.

**The first set of screenshots showed the old fixtures, and came from my command, not the build.** The line started `rm -f …/admin/*.png` on an empty folder. zsh fails a glob that matches nothing, which stopped the `&&` chain before `vite build` ran. The `tail` of the build log that followed then read the log left over from an earlier build, and the preview served that build's `dist`: seven-day expiry, no Hannah Price. Every line read was true of something, and none of it was the build under review. It is the Admin build's "the previous dist was checked" entry, arrived at through the shell. What caught it was the screenshot contradicting the change: "Expires 22/09/2026" for an invitation sent 15/09. **Before trusting a screenshot of a build, confirm the bundle it came from contains the change**: its mtime, a string only the change introduced, and the bundle name the server actually serves.

---

## How this build says what a role can do (proposed 17/09/2026, approved and built in Phase 2)

The CW PRD's role table is the authority for care worker and senior carer access. The Admin build's shape (a level per module) cannot hold what those roles do, so this build needs its own. Proposed here, before anything depends on it.

**One entry per act the PRD names, never per module.** Each says, per role, whether the role may, and if so over which residents; how it is confirmed; whether finishing it needs somebody else; and where the rule came from.

```ts
interface CareAct {
  module: NavModuleId
  source:
    | { kind: 'role_table'; row: string } // "Care Notes — write"
    | { kind: 'screen'; screen: string } // "MED-03"
    | { kind: 'departure'; see: string } // docs/DEPARTURES.md
  roles: Record<SignInRole, Grant>
  confirmation: 'none' | 'medication_pin'
  completion:
    | { kind: 'done_when_done' }
    | { kind: 'needs_a_second_signature'; by: 'incoming_senior_carer' | 'second_senior_witness' }
    | { kind: 'handed_on'; next: string; by: 'manager' } // acknowledged here, closed by a manager
}

type Grant =
  | { kind: 'may'; over: 'your_residents' | 'every_resident' | 'no_resident' | 'not_stated' }
  | { kind: 'may_not'; reason: string; whoDoes: 'senior_carer' | 'manager' | 'clinician_or_manager' | 'admin' }
```

**Screens ask a question, never a role.** `ask(viewer, act, resident?)` answers in terms a screen can draw:

```ts
type Answer =
  | { kind: 'yes'; confirmation: 'none' | 'medication_pin'; completion: CareAct['completion'] }
  | { kind: 'not_your_role'; reason: string } // the one line at the act
  | { kind: 'not_on_your_list' } // scope, never blame
  | { kind: 'no_list_yet' } // nobody has given this care worker residents
  | { kind: 'not_stated' } // the PRD is silent: the screen must not guess
```

What each part is for:

- **`over`** holds "assigned residents only" as the viewer's `ResidentScope`, rather than as a level. **`not_stated`** makes the PRD's silences visible: Table 3 says a care worker can record a dose, not over whose residents, and a screen reaching `not_stated` is a decision to raise, not a default to pick.
- **`completion`** holds "both shifts must sign", "Witness 2" and "acknowledge, a manager closes" as facts about the act. So a screen can show a signature as half the record, not the whole of it.
- **`source`** names the Table 3 row or screen for every cell. A row that moves on review is found by name, and a test holds each cell against a hand-typed copy of that row, never against the table itself.
- **Kept to one file, and guarded.** A check fails on `'care_worker'` or `'senior_carer'` in any screen, so no role rule can escape the file. The CW PRD is a draft; this is what makes a disputed row one edit.

It replaces today's `CARE_ACTS`, which says only holds or refused, and folds `resident-scope.ts` in as the reach half of the answer.

---

## Phase 2: the resident record, read side (17/09/2026)

**What was built.** The role table in its approved shape (`capabilities.ts`: per act, per role, a grant with its reach, confirmation, completion and source; `answerFor` and `useViewer().ask`), and `check-role-names.mjs`. The residents list (RES-01). A resident's record (RES-02, RES-03): the head, the five risk flags, the tab strip with gap words, eight read-only tabs, and three tabs that open to the phase that builds them. Departures are in `docs/DEPARTURES.md`, under Resident record.

**How.** The list, the record's frame and the role table were written here; the eight tabs were ported from the Admin build by four agents in parallel, each owning its own files, then merged (their two copies of the field list became one) and reviewed by screenshot: both roles, 1440 and 390, colour and greyscale, 108 captures.

**The role table, and the silences it keeps.** Where Table 3 says only "Can" for a care worker, the reach is `not_stated`, and a screen that reaches it draws the question rather than an answer: recording a dose, reporting an incident, adding a goal progress note, recording attendance, and updating handover status. Where it says only "Can" for a senior carer, the reach is the viewer's list, which for a senior carer is the whole home by Table 3's first row, so there is nothing narrower to be silent about. **One row reads against itself and is left for Phase 4**: "countersign controlled drugs: Both must be Senior+" says the first signer of a controlled drug is a senior carer, and the row above lets a care worker record a dose. The table records both as written.

**The guard's limit.** `check-role-names` fails on either role's name and on a comparison against `.role` or `.roleName`. Its success line would still print over `viewer.roleName.includes('Senior')`, or over a map keyed by the words "Senior carer". Those are review questions, written down as such.

### Found on the way

- **Search did not work in the Admin build's hook, and worked here by accident.** `useResidentFilters` memoises the visible rows on everything but the search text. In the Admin build the list it filters keeps its identity between renders, so typing changes nothing; here the list was rebuilt on every render, which recomputed the memo and hid the bug. Memoising the list for an unrelated reason would have broken search silently. Fixed with the dependency and a test that fails without it. **The Admin build's copy is not fixed**: it is the same line, and changing it is that build's commit.
- **`RequireSignIn` carried `?from=` and nothing read it.** Its docblock said signing in lands where the reader was going; it landed on the start page. The sign-in screen now reads the parameter as it mounts and the pending sign-in carries it through the code and the choice of home, only ever to a page in this product. The same shape as `?timeout=` in Phase 1: a value in the address read after the navigation that dropped it, here read by nobody at all.
- **The placeholder-instrument notice was drawn in the hatch.** The Admin build argued a missing validated instrument is an absence. Here the hatch means nobody has recorded something and appears nowhere else, and the assessments under the notice were recorded; it is now a statement in the info tint.
- **Two cards had no head and so no expand button**, holding only the edit act. The act now sits on the page above the first card on every tab that has no head card of its own.
- **Default list bullets** after every tab name and in the risk flags: a list without `role="list"` keeps its markers in the reset. The screenshot script now reports any list still drawing them.
- **The Care Plan's lead figure was 320px tall**: a flex basis written for a row, applied inside a column.
- From the tab ports, departures from the Admin build rather than the PRD: the box listing what withdrawing a consent did not undo is not hatched (its items are counted facts; only the uncounted one keeps the hatch); a zero among the documents and risk figures is plain rather than red, amber or hatched; the expiring-document finding has no border in the caution fill.

### Open

- **Care plan counts ignore the home's domain settings**, as in the Admin build. Risk assessments and consent count over what the home asks; if a retired domain should leave the Care Plan count, that belongs in `record-gaps.ts` beside the other two.
- **`ConsentBadge` names a pending request's asker by `displayName`**, so a deactivated person would show without "(deactivated)". Shared with the Admin build.
- **At 1440 the tab strip shows nine of eleven tabs** and scrolls for the rest, with no mark that it does. The tab you are on is always scrolled into view.
- **A draft over a signed care plan version** renders and is not reached by any fixture.
