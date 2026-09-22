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

- **Search did not work in the Admin build's hook, and worked here by accident.** Confirmed there with a probe test, since removed: "Pemberton" typed, 28 rows still shown. `useResidentFilters` memoises the visible rows on everything but the search text. In the Admin build the list it filters keeps its identity between renders, so typing changes nothing; here the list was rebuilt on every render, which recomputed the memo and hid the bug. Memoising the list for an unrelated reason would have broken search silently. Fixed with the dependency and a test that fails without it. **The Admin build's copy is not fixed**: it is the same line, and changing it is that build's commit.
- **`RequireSignIn` carried `?from=` and nothing read it.** Its docblock said signing in lands where the reader was going; it landed on the start page. The sign-in screen now reads the parameter as it mounts and the pending sign-in carries it through the code and the choice of home, only ever to a page in this product. The same shape as `?timeout=` in Phase 1: a value in the address read after the navigation that dropped it, here read by nobody at all.
- **The placeholder-instrument notice was drawn in the hatch.** The Admin build argued a missing validated instrument is an absence. Here the hatch means nobody has recorded something and appears nowhere else, and the assessments under the notice were recorded; it is now a statement in the info tint.
- **Two cards had no head and so no expand button**, holding only the edit act. The act now sits on the page above the first card on every tab that has no head card of its own.
- **Default list bullets** after every tab name and in the risk flags: a list without `role="list"` keeps its markers in the reset. The screenshot script now reports any list still drawing them.
- **The Care Plan's lead figure was 320px tall**: a flex basis written for a row, applied inside a column.
- From the tab ports, departures from the Admin build rather than the PRD: the box listing what withdrawing a consent did not undo is not hatched (its items are counted facts; only the uncounted one keeps the hatch); a zero among the documents and risk figures is plain rather than red, amber or hatched; the expiring-document finding has no border in the caution fill.

### Open

- **`ConsentBadge` names a pending request's asker by `displayName`**, so a deactivated person would show without "(deactivated)". Shared with the Admin build.
- **A draft over a signed care plan version** renders and is not reached by any fixture.

### After review (17/09/2026)

- **The Care Plan counts over the domains the home keeps**, by `carePlanGaps` beside the risk and consent counts, so the three figures on one record mean one thing by a denominator. A domain the home no longer keeps stays on the list: plain "Not kept at this home" where nothing was written, and its record with a line where something was. Broken on purpose (the denominator put back to all ten): the retired-domain test fails.
- **The tab strip says when it scrolls.** An edge with tabs past it carries "2 more" and a chevron, drawn only while tabs are hidden on that side, and pressing it moves the row. **It sits beside the row, not over it**: the first version laid it over a fade, which read at 1440 and at 390 covered most of the tab the reader was on. The row's own scrollbar is hidden, since the edges now say it scrolls in words. Which tabs are hidden is one function, tested on its own, and the edge is tested against measured positions.
- **The five acts a care worker's "Can" leaves without a reach** are recorded in `docs/DEPARTURES.md` as questions for the PRD's author, with the controlled drug contradiction, which stays as written until Phase 4.
- **The search defect is recorded in the Admin build's `PROGRESS.md`** as a known defect there, not fixed.

---

## Phase 3: care notes (17/09/2026)

**What was built.** The care notes list (CN-01) at `/care-notes`, counted over the viewer's list, with the flagged queue, No note today, Your notes, By shift and All notes; the composer (CN-02) at `/residents/[id]/notes/new` with a sticky subject strip, reached from the record or from a picker at `/care-notes/new` that offers only residents the viewer may write about; the Care Notes tab; note detail with its supervision record and correction chain; Mark reviewed with "Action taken?"; corrections by the author only. Departures are in `docs/DEPARTURES.md`, under Care notes.

**Settled before building**: the flag is the author's; the review outcome and flag reason are in the shared type, in both builds; only the author corrects, the first role-table act sourced from a departure; drafts kept for the session with no dialog; no By author view; voice-to-text refused on the ground that the browser's speech service sends audio to a third party; `--max-warnings 0` on ESLint.

**How.** The shared type, fixtures and loaders were changed here and copied to the Admin build, whose screens were then given the same choice by one agent. Two agents built this build's reading and writing sides in parallel against an agreed interface (`CorrectNoteAct`), and a fourth examined the Admin build's dependency warnings. Screenshots: both roles and a care worker with no list, 1440 and 390, colour and greyscale, 96 captures.

### The shared data layer

- **`FlagReason` and `ReviewOutcome`** on `CareNoteReview`. The fixtures give generated flags a reason or none and generated reviews each of the four outcomes, **derived from the category and day already drawn rather than from a new draw**: another call to the generator would lengthen its stream and move every fixture after it, in both builds. A fixture test holds that every state is reachable.
- **`REVIEW_OUTCOMES` is built from a record keyed by outcome**, so an outcome with no label is a compile error. The first version was a list checked with `satisfies`, which confirms each entry is an outcome and says nothing about an outcome with no entry. Found by the Admin build's agent.
- **`submitCorrectionNote` now makes the checks `submitCareNote` makes**: an empty body and an unexplained shift change are refused, and the body is trimmed. A correction is a care note and had skipped them. Found by the same agent.

### Found and decided on the way

- **The screens' own decisions, reported by the agents and kept**: the "write your own note" link sits on its own line under the refusal, because `ActLine` takes text; the flag is a checkbox, because the switch primitive is not for clinical values; a correction offers no phrase chips and keeps no draft, as in the Admin build; the review is a `Dialog`, not an `AlertDialog`, because it holds a choice and a field; Your notes shows the viewer's notes about residents on their list; By shift says a shift has not started rather than hatching everyone for it.
- **The composer's form surface has no card head**, and so no expand button: a form has nowhere to expand to. The same reasoning as the sign-out screen. It is a question for review whether a form counts as a card under CLAUDE.md §6.
- **"across your 4 residents" has one owner**, `scopeAcross`, beside `scopeDenominator`. The first version rewrote `scopeDenominator`'s "of" into "across" with a regular expression in the screen.
- **List bullets in the resident picker**, caught by the screenshot script's marker check.

### The Admin build's four other dependency warnings

- **Two are one defect** (`SessionProvider.tsx`, lines 33 and 78). Signing out resets the settings store, which reverts a home's name and timezone changed that session, but the provider stays mounted and its memo is not told, so after signing back in the header still shows the changed name and every clinical timestamp renders in the changed zone, while screens that read the store directly show the originals. Confirmed with a probe test through the real sign-in, settings and sign-out screens. The fix is one line in `signOut` (bump the counter after `endSession()`), confirmed against a patched copy; not applied. Recorded in the Admin build's `PROGRESS.md` as a known defect.
- **`NotesTab.tsx` line 68 and `StaffDetailRoute.tsx` line 73 are harmless**: a memo recomputed over an empty list the screen does not use, and a counter whose re-render is what refreshes the screen while the memo reads nothing that could change.
- This build has no settings writes, so its provider is not exposed.

---

## The expand-button sweep (17/09/2026)

CLAUDE.md §6 now says a card showing a subset of something larger carries an expand button to the whole, and a card that is the whole thing carries none. `CardExpand` gained `whole`, which draws no button. Every card that had drawn a "not built" button was checked on its own, 27 of them:

- **24 are the whole thing**, and lost the button: the section cards of General Information, Important People and Future Plans; the head and list cards of Risk Assessments, Care Plan, Consent and Documents; both residents list cards; the later-phase placeholder; the Care Notes tab; the care notes list's no-list card and each of its five views (a view holds every row of that view, and the pills beside it already reach the others); the note detail's own card and its supervision record; and the Status pills specimen.
- **3 are genuine subsets.** Two specimen cards, "Doses this shift" and "Your rounds today", show part of the medication round and the MAR, and keep "not built" until Phase 4 builds them. **The correction card on a note's detail** shows an excerpt of another note, so its button now goes to that note; a note that both corrects one and was corrected by another has two wholes, and gets none rather than a button that picks one.

Two tab tests had encoded the old rule, asserting a "not built" button on every section card, and now assert the act alone.

**While checking that `whole` draws no button, the mutation was reverted with `git checkout`**, which put `Card.tsx` back to the last commit and removed the uncommitted change under test. Re-applied and confirmed; §8 has the entry.

---

## Phase 4: medications — the role table changes first (17/09/2026)

### "Not stated" now asks its question only beyond the list

**A change to the shape approved before Phase 2, and a narrowing of where it applies, not a weakening of it.** The reach a care worker's "Can" rows carried was `not_stated`, and it answered with the question for every resident. For "Record a dose given, not given or PRN" that meant a care worker could record no dose at all, including for the residents on their own list.

The PRD was never silent about those. Table 3's first row gives a care worker "Assigned only" residents, and "Care Notes — write" says "Assigned residents". What the rows below leave unsaid is whether a care worker's "Can" reaches residents **off** their list, and that is what the question was written to ask. Answering it for every resident turned a gap in the document into a care worker who cannot do their job: the shape applied where it does not belong.

So the reach is now `not_stated_beyond_your_list`: a resident on the list answers yes, a resident off it answers with the question, and a care worker with no list gets "nobody has given you a list". The five acts it covers are unchanged, and are still recorded as questions for the PRD's author. A test holds both halves.

### A contradiction is its own answer

"Medications — record Given/Not Given/PRN" gives a care worker "Can (PIN required)"; "Medications — countersign controlled drugs" says "Both must be Senior+". For a controlled drug they cannot both hold, and the build does not choose. A care worker's controlled drug dose is its own act, `record_controlled_drug_dose`, whose grant is `contradicted` and carries both rows; the answer quotes them, and `ActPoint` draws the quotation at the act with Given unavailable. A reader sees a contradiction for the PRD's author, not a refusal that looks decided. For a senior carer the same act is Witness 1, and its completion needs a second signature: the rule used for a handover, earning its place a second time.

`close_omission` is added from MED-01's screen ("care workers can view omissions and cannot close or dismiss one").

### The shared data layer, in both builds

- **`resident_vomiting`** joins the Not given reasons (MED-02 lists six). The fixture draw keeps its five choices so its stream is unchanged; some "other" answers become vomiting, derived from the day.
- **An omission carries its closure**: open, or closed with who, when and why (MED-01). A closure records a decision about the gap and leaves the gap: the cell stays an omission. Older omissions on every third day are closed in the fixtures by a manager with a reason; the three pinned ones stay open. `closeOmission` refuses a blank reason, a cell that is not an omission and one already closed. `getOmissions` now reads this session's records, so a closure shows.
- **A controlled drug dose can be recorded with its second signature still to come**, and `countersignControlledDrug` adds it, refusing the person who gave the dose. The loader had refused a dose without a witness, because the Admin build's round takes both signatures in one act; MED-03 has Witness 2 countersign afterwards with their own PIN. The Admin build's round still never sends one.

### The medication PIN

A PIN chosen this session is checked, and five wrong lock it for fifteen minutes on the real clock, counted per person. Anybody who chose none is told first that nothing is held to check against, and any four digits confirm. `MedicationPinStep` is the one place it is asked, and says what it signs.

### Phase 4, built (17/09/2026)

The medications layout and its four tabs (Omissions, Round, Controlled drug register, Add interim), the MAR chart and the resident's Medications tab. Built by three agents in parallel here and one in the Admin build, against the role table and the shared data changed first. `npm run verify` passes in both builds; 728 tests here, 1,404 there. Looked at in 52 screenshots: both roles and a care worker with no list, 1440 and 390, colour and greyscale.

**What the screens show that the earlier phases did not.** The round asks the medication PIN once per resident, listing every dose and answer it signs. A care worker's controlled drug dose quotes both rows of the role table and stays unavailable — at Rosewood that blocks every resident on Eze's list at the 20:00 round, which is the contradiction's cost made visible rather than hidden. A senior carer's controlled drug dose records as Given plus a hatched "Second signature not recorded", and the register's Awaiting Witness 2 list countersigns it with the PIN, refusing the person who gave it. The omissions screen counts doses with no record over doses due this week, keeps a closed omission hatched with its closure beside it, and gives a care worker one refusal line rather than a disabled button per row.

**Four gaps in the shared data layer, found by the agents and fixed in both builds.**

- **`getMarRecords` read the fixtures unpatched**, so a dose recorded, an omission closed or a countersignature added this session did not show on that resident's chart, while the omissions screen showed it: two screens disagreeing about one cell.
- **The sign-out list called every overlay entry "doses you signed for"**, so closing an omission or countersigning somebody else's dose was described as signing for a dose. The store now counts the three apart.
- **A PRN outcome had a time and no author**, the one clinical record in either build without one. `recordPrnOutcomeFor` now takes who recorded it, and both builds show them.
- **A fixture closure reason had a `?? 'Reviewed.'` fallback**: unreachable, and the fallback pattern the rules forbid. The reasons are a fixed tuple now.

**Left as it is, reported by the round agent**: `recordRound` writes no entry to the session activity log, unlike the other writes; PRN doses before this session are not loaded anywhere; the round's tests pin `?at=` and read the clock in the machine's zone, which is London-equivalent here and would drift elsewhere.

**Two destructive mistakes of my own**, both while tidying agents' work, both recorded in §8: a mutation reverted with `git checkout` took an uncommitted change with it, and a regular expression written to delete a four-line helper deleted most of `omission-views.ts`. The second was recovered from the agent's own record of writing the file, and the typecheck named every missing export.

**One agent stopped on a rate limit** after writing the MAR chart and the resident's Medications tab; its files were complete, and its 46 tests pass.

---

## The dose window, and what refusing an early dose costs (17/09/2026)

### Recording a dose before its window opens is refused

**Decided on review: giving a drug early is a clinical decision and nothing in this product can make one.** A due dose whose window has not opened now offers neither answer, and says why with the hour it opens; the window was already drawn beside the dose and is now stated at the act as well. `docs/DEPARTURES.md`, Medications.

- **Both answers, not only Given.** The instruction was about giving a dose early; the same reasoning refuses Not given. Recording at 19:30 that the 20:00 dose was refused is a record of something that has not happened, and the resident has not been offered it yet. Flagged here rather than assumed: it is the one part of this that goes past the words.
- **Late stays open.** A dose given at 20:40 is recorded at 20:40. `windowOf` already told the three states apart and only `not_open_yet` refuses.
- **The window is its own field on `DoseAccess`**, beside what the register and the role table say, because they are different facts about one dose and both can be true: a care worker at a controlled drug before the round is stopped by the clock *and* by the contradiction in the role table, and a compound state renders as separate facts. The screenshots show both, one above the other, neither hiding the other.
- **Not hatched.** A dose that is not due yet is not a dose nobody has recorded; there is nothing to record. The hatch would claim a gap the chart does not hold, so the "Not recorded yet" mark is not drawn while the window is shut and the line stands in its place. The line is the neutral information tint: not a finding, not a gap, not a refusal of this reader.
- **Quieter at the dose than at the act.** The first version drew the tinted panel at every dose, so a two-dose card carried it three times and it read louder than the critical discrepancy line beside it on the one card that has both. The dose now carries the words alone; the panel is drawn once, at the foot of the card where the dead act button is.

`round-window.test.tsx` holds it at 19:30: neither answer offered, the hour named, no hatch, the card and banner lines, the contradiction drawn beside the window, and a PRN still recordable — as-required is not due at a round, so no window governs it. Broken on purpose twice, each confirmed landed in the code the test reads and then reversed by hand: the buttons' `disabled` without the window (the answers test fails), and `outstanding` returning no `notOpenYet` (the card line and the pure rule fail).

**`round.test.tsx` moved from 19:30 to 20:20.** Every assertion in it was recording a 20:00 dose half an hour before the round, which is now refused. At 20:20 the fixtures have signed for half the round already — the part-recorded state, alternating on the drug's index — so the doses those tests answer are read from `openDosesAt` rather than named.

### The opening count is now unreachable from the round, and this is the ask

**The one controlled drug the register has never counted is Adeyemi's oxycodone**, and the opening balance is asked for where a controlled drug is given against no balance. A dose can be answered only inside its window; inside a window the fixtures sign for half the round, alternating on the drug's index in `medications`; that drug's index is 106, which is even, so at every open window, on every day, it is already on the record. The screen cannot reach the opening count at all.

It is not chance and no clock reaches it: the parity is a property of the drug, not of the hour. Recording it before the window was the only door, and the refusal above closes it.

- **The rule is tested where it lives.** `round-rules.test.ts` is new and pure: the window's three states, a shut round waiting on nobody, the count and the witness each named while missing, what the PIN signs, and a counted balance asking for neither.
- **The screen test is replaced by one that pins the reason**, naming the parity and asserting the dose is not open. The day somebody moves the fixture it fails and the screen test comes back.
- **What would reach it is a fixture change, shared with the Admin build**, so it is an ask rather than a decision: exclude the never-counted drug from the half the fixtures pre-sign, so its dose is always still to give in an open window. Derived, no new draw, no other fixture moves. The alternative is to reach the opening count from the register instead, which is where MED-03 puts the count ("Senior 1 records administration + stock count").

### A rule held by habit rather than by a type

**The PRN outcome with a time and no author was the only clinical record in either build without one**, found in the newest module after eleven phases in which every other record carried an author because somebody remembered. `recordPrnOutcomeFor` now takes who recorded it and both builds show them, but nothing in the types would have stopped it, and nothing stops the next one: `CareNoteReview`, an omission's closure and a stock count each carry their author by construction of the function that writes them, not by a shape the compiler checks. The evidence invariant has a guard for the unrecorded case and none for the unattributed one. **A rule held everywhere by habit is a rule waiting to be missed in the next module**, and this is the record of where it was missed.

### Countersigning an old dose: the register's own logic, and what the fixtures hold

Proposed, not picked. MED-03 says "System prompts Witness 2. Senior 2 taps Countersign + enters own PIN" and says nothing about when. The measurements are at the default clock, Rosewood Court, **89 doses on the register with one signature**:

| Window | Doses still countersignable |
| --- | --- |
| The round's own hour | 0 of 89 |
| The shift the dose was given in (`shiftAt`: early 07–14, late 14–21, night 21–07) | 0 of 89 |
| Until the next stock count on that drug | 0 of 89 |
| 24 hours | 2 of 89 |
| 72 hours | 4 of 89 |

The oldest is 30 days. The youngest is 11.95 hours, given at 07:25 on the early shift while the record stands in the late one.

**The first measurement counted the wrong set, and the screen said so.** It ran over the MAR records — 282 doses, oldest 89 days — which is every controlled drug dose given at the home with no second signature. The register is narrower by construction: `buildRegister` starts at the opening count and nothing before it is on the register at all, because the balance did not exist yet. The screen's own figure, 89 of 1,018, is what showed the difference. The shape of the answer is unchanged, and the table above is the register's.

**Two of those windows come out of the register rather than out of a round number.** A witness statement is an assertion that somebody saw the dose given, and the only notion this build has of who was present is the shift, which it already owns. A stock count sets the balance and audits every line before it, so a signature added afterwards is added to a line that has already been checked — and every one of the 282 has a later count, so the register's own arithmetic has closed on all of them.

**Under any of them, countersigning becomes unreachable in the running build.** A dose recorded this session cannot be countersigned by the person who recorded it, and signing out destroys the session's records, so the only countersignable doses are the fixtures' — and they are all outside. Reaching it again means pinning a fresh awaiting dose in the fixtures, given by somebody else inside the window, which is a shared change and an ask. It is the same shape as the opening count above: a refusal is right and the fixture was built for a screen that never refused.

**What the screen would then have to say** is that 282 doses can never have a second signature: a permanent gap, hatched, with the giver and the hour, and the card's figure carrying it — not a queue of work that looks actionable. That is a finding, and arguably the point.

---

## After review: the window states named, the silence quoted, the fixture moved (17/09/2026)

### Three states at one dose, drawn as three different things

The window rule now says what is true rather than only why a button is dead, and the three states are kept apart:

| When | What the dose draws |
| --- | --- |
| Before the window opens | "Not due yet — the window opens at 20:00 BST. Giving a drug early is a clinical decision, and nothing in this product can make one." Neutral information tint, no hatch, both answers unavailable. |
| Inside the window, nothing recorded | The hatch: "Not recorded yet", and both answers live. Nobody has recorded a dose that is due, which is a gap. |
| The window closed with nothing recorded | The chart's `omitted`: "Nothing recorded", hatched, with the hour the window closed. The Omissions tab counts it. |

**The hatch begins where the window opens.** A dose that is not due yet is not a dose nobody has recorded, and hatching it would claim a gap the chart does not hold. `round-window.test.tsx` asserts the absence of the hatch before the window; `round.test.tsx` asserts its presence after, on the same dose.

### The countersign silence, quoted at the act

MED-03 is quoted in full on the Awaiting Witness 2 card, with what it leaves open, and **every dose stays countersignable at any age**: nothing here is drawn as decided, because nothing has been decided. Each row carries the same silence with that dose's age beside it ("Waiting 30 days. How long after a dose a second signature may still be added is not stated in MED-03."). The quotation is one owner, `COUNTERSIGN_QUOTED`, so the card and the question in `docs/DEPARTURES.md` cannot drift.

**It is not an `ActLine`.** The four kinds are refusals, an unbuilt control, a consequence that does not happen, and a silence about *which residents* where the control stays unavailable. This silence is about time and the control stays available, so reusing `not_stated` would have made that kind mean two opposite things about availability. It is drawn in the same quiet caption as `ActLine`, with a solid hairline and never a dashed one: the dashed edge belongs to the unrecorded treatment and nothing here is a gap in the record.

### The fixture that made the opening count unreachable

The never-counted drug is now always still to give in a round in progress, by identity rather than by index. The screen test that was replaced by a test pinning the reason is back, and the pinning test now asserts the opposite — that the dose is open — so the two swapped places rather than one being deleted. `docs/DEPARTURES.md`, Fixture changes shared with the Admin build. Not synced to the Admin build in this pass, and nothing there depends on it: its round does not ask for an opening count.

---

## Phase 5: handover (17/09/2026)

**What was built.** The shift handover (HO-01) at `/handover`: the board for the open shift, the four resident groups, recording a status, the dual signature, and earlier handovers still missing one. The data layer was already here — `handover-store.ts`, `getHandoverBoard`, `recordHandoverStatus`, `signHandover` — so this phase is screens and the role table's answers.

- **The board is the home's, not the viewer's list.** HO-01 says every resident at the site, whether or not anybody has got to them, and the incoming shift is taking the whole building. So nothing is counted over the viewer's residents and the head says what it *is* counted over. `scopeNote` is deliberately not used here: it would say "Counted over your list, not the home's" to a care worker, which would be false of this board.
- **What is asked per resident is the act.** `update_handover_status` is `not_stated_beyond_your_list`, like the other four "Can" rows, so a care worker's own residents answer yes and a resident off their list draws the PRD's question at the control. Both are on one screen, row by row, which is the first place in the build where the yes and the question sit side by side in one list.
- **A care worker nobody has given a list is told once**, under the pills, not once per row: six identical refusals down a list is the shape the omissions screen already rejected. The board stays readable, because it is the shift's.
- **The dark card is the not-reviewed count**, the only figure still changeable before the signature. The other three are counted over the residents somebody looked at, never over the home: counting the unreviewed in that denominator would claim a coverage nobody has.
- **Signing is the medication PIN**, per the role table's `confirmation`, and what it signs is said in words before the digits: "…covering 22 of 28 residents. 6 of them have not been looked at at all: this records that, and does not say they are well." The signature stores the counts at the moment it was given, so it can never be read as more than it was.
- **One signature is half a handover**, from the role table's `completion` rather than written on the screen, and the other half stays hatched until the incoming shift signs. A care worker gets the table's refusal on both halves.
- **Nothing is sent.** HO-01's push to the senior on duty when somebody is marked urgent does not happen, and both the head of the screen and the dialog at the act say so.

**Found on the way.** The act column had no width, so where the role table answered with a question the sentence spanned the row and read as a footnote under the record rather than as the answer at the act; it is capped now. The Review control is `size="large"`, which is the 48px touch target the compact layout asks for on a clinical act.

**Mutations run**, each confirmed landed and then reversed: the role-table question skipped in `StatusControl` (the off-list test and the no-list test fail), and the not-reviewed sentence dropped from what the PIN signs (the signature test fails).

Screenshots: both roles and a care worker with no list, 1440 and 390, colour and greyscale.

---

## Phase 6: incidents (18/09/2026)

**What was built.** The incidents list (INC-01) at `/incidents`, and the report form (INC-02 and INC-03 on one screen, as INC-02 asks) at `/incidents/new`. Departures are in `docs/DEPARTURES.md` under Incidents.

**The data layer had a read and no write.** `getIncidents`, `patchedIncidents` and the acknowledge/review/close store were already here from the ported `src/data`; nothing could report one. So `reportIncident` is new in `client.ts`, `keepReportedIncident` in `incident-store.ts`, and `patchedIncidents` now reads this session's reports before the fixtures — a report made on the form and absent from the list is the defect the overlay exists to prevent. `acknowledgeIncident` wraps the store's existing act so it logs and refuses like every other write. A reported incident is listed among what signing out would lose.

- **The reporter's account, and nothing else.** A report is written `reported_not_acknowledged`, with no manager review and no notification decision: those are other people's records, and an incident that arrived with a root cause in it would attribute somebody's conclusion to the person who was there.
- **Refused rather than corrected**: an incident in the future, an empty description or immediate action, and a resident at another home. The subject is chosen rather than given here — the one write surface where §2's route-parameter protection does not apply — so the loader checks what the screen cannot.

**The question at the act, twice on one screen.** Table 3 gives a care worker "Can (any time)" for reporting and does not say whose residents, so the form asks the role table about the resident chosen: one on their list enables the submit, one off it leaves it unavailable with the PRD's question beside it, and "no resident was involved" asks about the role alone because there is no list for it to be about. It is the first screen where the yes and the question are reachable by changing one field.

**Found while building.**

- **A false comment over a false record.** The submit set `emergencyServices: { kind: 'not_called' }` with a comment claiming the form asked. It did not. `EmergencyServicesRecord` has two members and neither is an absence — calling is instantaneous, so there is deliberately no "not yet" — which means a form that does not ask writes "nobody called an ambulance" in the reporter's name. The form now asks, and an answer of called names what they said. **The tell was the comment**: it described a control that was never built, and it was written in the same minute as the line it was wrong about.
- **A const that reached forward at module load.** `HARM_SCALE` was declared above the `HARM_GLOSS` it maps over, which typechecks and throws at import: a blank screen and a reference error. Caught by loading the module in a test before anything used it.
- **The body map fills whatever it is given**, and in a 1,280px card it filled all of it, putting the question's answer two screens below the question. Capped at 320px — on the figure alone, because capping the column wrapped "No injury site marked yet" into its own detail.
- **A third figure said what the dark card already said.** "Waiting longest" repeated the oldest wait from the dark card's foot. INC-01 asks for two figures; it now has two.

**Mutations run**, each confirmed landed and reversed: the role-table question asked for the role instead of the resident (the off-list test fails), and "Not checked yet" drawn as settled rather than hatched (the two-states test fails).

Screenshots: both roles, 1440 and 390, colour and greyscale, list and form, with the form filled far enough to draw the subject card and the body map.

### Housekeeping in the same pass

- **`agentRules: false` in `next.config.ts`.** `next dev` appended a Next.js block to `CLAUDE.md` on every start, which put an uncommitted change into a file whose wording is a stop-and-ask and which nobody here wrote. Confirmed by restarting the dev server and watching the file stay clean.
- **`docs/HANDOVER.md` brought up to date** through Phases 4, 5 and 6, and committed rather than left untracked.

---

## Phase 7: goals and activities (18/09/2026)

**What was built.** The goals queue (GOAL-01) at `/goals`, one goal with its progress and the note form (GOAL-02) at `/goals/[goalId]`, the resident record's Goals tab, the activities calendar (ACT-01) at `/activities`, and one session's attendance (ACT-02) at `/activities/[activityId]`. Departures are in `docs/DEPARTURES.md` under Goals and activities.

**Two writes were missing from the ported data layer**, as in Phase 6: it could read goals and activities and record neither a progress note nor who came. `goal-store.ts` is new (session-held, immutable, no edit and no delete, listed among what signing out would lose), `activity-store.ts` gained attendance keyed by resident rather than a replacement invitation list, and `client.ts` gained `addGoalProgressNote` and `recordActivityAttendance`. Both reads now go through the overlay, so a note written on a goal's detail is in the queue it was reached from.

- **`goal-timing.ts` is ported from the Admin build unchanged**, because the module's central judgement is already made there and is the same here: a goal past its date with a trail of notes that stops short of an outcome is still nobody saying what happened. That is why GOAL-01's lead figure is 5 rather than the 4 a stricter reading gives, and the fixtures produce exactly the figures the PRD quotes — 40 goals, 32 dated, 8 undated.
- **A progress note cannot change a goal's outcome.** The write has no path to it, which is stronger than remembering not to: open, closed and achieved are a manager's decisions.
- **Attendance writes only the residents somebody answered for.** The store refuses an answer naming somebody the session never invited — an attendance record against a resident who was not on the list is the wrong-subject failure with a grid around it.

**The first `SegmentedControl`.** The shape language has described it since Phase 0 — a grey track with a raised white thumb, for one of a small set of presentations of the same data — and nothing had needed it until the week and the list. It is a primitive, with radio semantics, and its docblock says what it is not: never navigation, never a filter.

**Decisions this phase had to take, beyond the brief.**

- **The engagement level has nowhere to live.** ACT-02 asks for one; `AttendanceState` has no field for it and adding one changes data both products share, so the control is drawn disabled with a line saying nothing is kept and why. It is a §9 ask, not a decision taken here.
- **No month view.** ACT-01 asks for Week and Month. A month of sessions is a planning view, and this product is what a shift works from.
- **A part-recorded session is not amber**, because amber is for findings and the unanswered residents are a gap. Both facts are stated instead.

**Found on the way.**

- **A const that reached forward at module load, again.** Caught this time before it shipped: `HARM_SCALE` in Phase 6 taught the shape, so the goal parts were checked by loading the module in a test first.
- **`LaterPhaseTab` had no reason to exist any more.** Goals was the last tab built in a later phase; with `builtIn` gone from `ProfileTab` the component would have thrown for every input. Deleted, and the test that asserted "This tab is built in Phase 7" now asserts the record it opens to.
- **"2 persons joined without being invited."** `pluralise` takes an explicit plural and was not given one.

**Mutations run**, each confirmed landed and reversed: "the resident was not asked" drawn as positive rather than caution (the amber-not-hatched test fails), and the attendance write marking every invited resident rather than only those answered for (the leaves-the-rest-as-gaps test fails).

Screenshots: both roles, 1440 and 390, colour and greyscale, all four screens.

---

## Phase 8: senior carer records (18/09/2026)

**What was built.** The four write-acts Table 3 gives a senior carer and this build could not perform: scoring a risk assessment (RA-02), recording a consent decision, filing a document, and conducting a whole care plan review. Departures are in `docs/DEPARTURES.md` under Senior carer records.

**The data layer already held all four writes.** `recordAssessment`, `recordConsent`, `fileDocument` and `recordWholePlanReview` came across with `src/data` in Phase 0 and had never been called. This phase is screens, the role table's answers, and the rules each act refuses on — which is why it added no store and changed no shared type.

- **RA-02, the one screen the CW PRD draws.** Placeholder banner on the form as well as the list, a running score that says what it is out of, factor cards carrying each choice's weighting, every factor required before sign-off, interventions, and the medication PIN. The band change is stated before the PIN goes in, because RA-02's push to the assigned care workers does not happen and the person signing is the one who has to say it out loud.
- **Consent is the Admin build's capacity gate, narrowed.** Capacity first and alone; both Mental Capacity Act stages where somebody lacks it; a best-interests decision needing somebody consulted and a reason; the LPA holder offered only where a health and welfare LPA is on record. The assessment it writes names the one decision it was made about.
- **Filing a document stores no file**, and the expiry question cannot be skipped: "nobody knows" is one of its three answers rather than what a blank produces.
- **A review can be completed over gaps and the record carries which ones**, the handover signature's shape, with the outstanding domains named rather than counted.

**Where each act is drawn.** Scoring and recording consent went onto the row they act on, because they act on one template and one consent type; filing a document and conducting a review stayed at the head, because the first is about the file and the second about the whole plan. A care worker meets the role table's reason once in each place, never per row.

**Three fields drawn and not kept**, each with a line at the act and each a change to shared data if it were to be kept: RA-02's interventions, the review's account of what was discussed, and — from Phase 7 — the engagement level. They are the same shape as the photo upload and the PDF export: the control is real, nothing is stored, and the screen says so where it is used.

**Found on the way.**

- **A confirmation owned by the component the write remounts.** The assessment form's "recorded" line lived in the form, and recording reloads the resident, which remounts it — the message was destroyed by the act it was reporting. Hoisted to the route. It is the third time this shape has appeared (the handover's status control, the note review), and the first time it was caught by a test rather than by looking.
- **A test that read the fixtures instead of the overlay.** The first version asserted on `residentById` from the fixtures, which never sees a session write, so a passing write looked like a failing one. Read through `withResidentEdits`, as every screen does.
- **`LaterPhaseTab` had already gone in Phase 7**, so nothing on a resident's record now says a tab is built later.
- **A class that was never added, and nothing said so.** The consent row's act carried `className={styles.rowAct}` and the class was not in the sheet: CSS Modules resolves an undeclared name to `undefined`, React drops the attribute, and the row renders unstyled with no error anywhere. The cause was a shell line — `grep … | head || python3 …` — where the `||` tested `head`'s exit status rather than `grep`'s, so the fallback that would have added the class never ran, and the command reported success. Found by sweeping every `styles.x` in the build against its stylesheet, which is now `scripts/check-css-classes.mjs` and a stage of `npm run lint`. Broken on purpose by removing the class again: it names the file, the class and the sheet. Three apparent misses in the first sweep were false positives — `.table .num`, `.cards > .wide` and `.boxes:focus-within .current` are declared as descendants, and the guard reads whole selectors rather than line starts.

**Mutations run**, each confirmed landed and reversed: the running score reported complete before every factor was answered; the LPA holder offered without a health and welfare LPA on record; a resident with no review date dropped from the queue; the expiry question made skippable; and the CSS class removed from its sheet again.

---

## Phase 9: the dashboard (18/09/2026)

**What was built.** DASH-01 and the Care Home variant DASH-01a at `/`: the head with the scope stated in Table 3's own words, the dark card counting what is already late, four metric tiles, one column per round, six completion bars, and the Already late list with its filter pills and a link on every row into the record it is about. Departures are in `docs/DEPARTURES.md` under Dashboard.

**It adds no store and no record.** `dashboard-figures.ts` is pure arithmetic over what the modules already hold — the round, the care notes, the omissions, the incident log, the handover board, and the three gap counters a resident's tab strip already uses — and `late-items.ts` turns three of those into rows with a route each. Every number on this screen exists somewhere else, and the pair must agree; that is why the phase is second to last.

- **The whole screen is scoped once**, not each figure. Table 3 filters a care worker's dashboard rather than the individual acts, so the residents are narrowed at the top and everything counts over what is left. A care worker nobody has given a list sees the hatched panel and no figures at all: the numbers would be the home's, and this screen is meant to be theirs.
- **The bars are straight and the rounds are columns.** The hatch is a `repeating-linear-gradient`, a gradient cannot follow a curve, and a ring would have to carry the gap in colour alone. DASH-01a asks for rings; it is recorded as a departure rather than solved with an SVG pattern the Figma importer drops.
- **The Incidents bar is the only one with three segments.** Unacknowledged is a finding in `--status-critical`, apart from the hatch, because somebody wrote the incident down: what is absent is a person picking it up, not a record. DASH-01 says this itself, and `CompletionBar` takes the finding as a separate argument so a two-segment bar cannot be handed a third number by accident.
- **The combined "Overdue now" figure stays refused**, as recorded in Phase 4. The dark card carries the count of late things and names the three kinds beneath it, with one line saying why they are not added.

**Three mutations passed, and all three were the test's fault rather than the code's.**

- **Zeroing `dueSoon` changed nothing**, because no screen test read that tile — only the arithmetic had one. Writing the screen test then showed something worse: at the default clock the strict reading of "due in the next 2 hours" returns 0, because a round's window opens on the hour and the fixture clock sits inside one. The tile had been showing a zero that read as a home with nothing coming. `dueSoon` now counts a dose whose window is open or opens within two hours, the tile says "Due now or in the next 2 hours", and the departure from DASH-01's wording is recorded with that reason.
- **Drawing the finding segment with the hatch class passed**, because the test asserted `data-segment` and never the class — exactly the shape §8 already warns about, a guard reporting what it asked rather than what it saw. `completion-bar.test.tsx` now asserts the three segments carry three distinct class names, and the mutation fails.

- **Reversing the Already late sort passed**, and the test that should have caught it is called "is oldest first" and never looked at the order: it checked that each row had a link and a chip. The name asserted what the body did not, which is the §8 shape about a guard reporting what it asked rather than what it saw, wearing a test's clothes. `byOldest` now has a unit test over three known dates, and the screen test asserts the rendered rows are non-decreasing by due date. The same pass fixed a neighbouring test that returned early when it found no rows, so it could pass by testing nothing.

Each was confirmed landed in the code the tests read, then reversed by hand.

**Found on the way.**

- **`check-css-classes` caught a stylesheet deleted out from under a live import.** `HomeRoute` and `home.module.css` went when the dashboard took `/`, and `NotFoundRoute` had been sharing that sheet; the guard named the file, the class and the missing sheet on the next run. It now has `not-found.module.css` of its own. The guard written in Phase 8 found its first real defect eight hours later.
- **One screen, one address.** The navigation's Today entry pointed at `/dashboard` while signing in landed on `/`; the dashboard is at `/` and the rail says so.

**Mutations run**, each confirmed landed and reversed: `dueSoon` zeroed, the finding segment drawn with the hatch, the scope filter removed so a care worker's figures counted the home, and the Already late list sorted newest first.

`npm run verify` passes at the committed tree: 67 test files, 907 tests, icons, typecheck, ten lint stages, format and build.

---

## Phase 10: profile and restricted access (18/09/2026)

**What was built.** PROF-01 at `/profile`, reached from the account menu and the rail: who you are and who changes each part of it, the two credential forms, the PRD's Appendix D in full with its switches, the device settings, where you are signed in, and signing out. Departures are in `docs/DEPARTURES.md` under Profile and settings. It is the last screen in this build.

**The screen is mostly refusals, and one real act.** Four of its six sections describe something this product cannot do — authenticate, store a file, send a notification, or hold a session on another device — so each says what it does not do at the point it is offered. The medication PIN is the exception and it is a genuine one: the PIN is held in this tab and confirms a dose, a handover signature and a risk assessment afterwards, so changing it here changes those. Drawing it inert alongside the rest would have been cheaper and less true. A wrong current PIN counts towards the same five-try lock as a round does, because it is one PIN, and the screen says so before anybody types.

**Appendix D turned out to exist.** The PRD's section D is a heading promising every notification with its channel, timing, role and whether it can be disabled, and reads as a promise with nothing under it; Table 19, eight lines further on, is the table. It is now `notification-table.ts`, typed cell for cell, and it disagrees with PROF-01: PROF-01 names four notifications as the safety-critical ones that cannot be turned off, and Appendix D's own column refuses six and calls two of them safety critical. Neither is preferred. The column decides whether a switch is drawn, the words "safety critical" appear only where the table writes them, and the disagreement is quoted at the act and asserted in a test, so correcting either document fails by name.

**Reports and Compliance, confirmed rather than built.** No route, no rail entry, no link anywhere in the source, and `restricted-access.test.ts` holds all three. The refusal itself stays in `capabilities.test.ts` against Table 3: `check-role-names.mjs` reads test files too, and it was right to reject a second file naming a role — a disputed row must move in one place.

**A guard the codebase had claimed to have for ten phases.** `session-losses.ts` came across from the Admin build with a docblock saying `scripts/check-session-losses.mjs` fails the build if a store is added that the loss list does not ask. That script was never ported. Nobody noticed, because nobody had added a session store since Phase 0 — until this phase added one for the notification preferences. It is written now, it reads both halves (every `*Holdings` export is asked by something that builds the loss list; every `reset*` is called where a session ends), and it is a stage of `npm run lint`.

**Found on the way.**

- **A guard that passed because an import mentioned the name.** The first mutation against the new guard removed `preferenceHoldings()` from the sign-out screen's list and the guard said the store was asked. The mutation had landed in the code the guard reads — the §8 procedure was followed — and the guard was still wrong: it tested whether the name appeared in the file, and the import at the top still carried it. Imports are stripped now, and the mutation fails. New §8 entry.
- **Colour alone carried whether a PIN rule was met.** Caught by looking at the greyscale capture, not by a test. The password rules beside it have carried a mark since Phase 1; these three were new and had only a colour. A mark as well now, and a test that fails without it.
- **The hatch had wandered onto a device list.** "No other session is known" was drawn as a gap chip. A session on another device is not a care record somebody failed to write, and spending the one signal that means "nobody has recorded this" on it would blunt it — the same reasoning that keeps it off a resident's missing photograph. The words carry the whole claim instead, and a test asserts the screen draws no hatch at all.
- **A stale server on the screenshot port, again.** `next start` reported success, the page returned 200, and the log's last lines were an `EADDRINUSE` from a server three phases old. The capture would have been of a build with no profile screen in it. Phase 4 met the same thing; what caught it this time was reading the server log rather than the status code.

**Mutations run**, each confirmed landed in the code under test and reversed by hand: the notification switch drawn on every row including the six the PRD fixes; the PIN change writing a new PIN over a wrong current one; the preference store accepting a notification Appendix D refuses to let anybody turn off; the PIN rule mark removed; and the two against the new guard.

Screenshots: both roles, 1440 and 390, colour and greyscale, at `/private/tmp/claude-501/-Users-frankyflex-Documents-digi-care-cw/440b06aa-1a63-4210-af3c-bb85b83e94d5/scratchpad/shots-p10-final`.

---

## The three screens Phase 9 wrote off (18/09/2026)

**What was built.** RA-01 at `/risk-assessments`, CON-01 at `/consent` and DOC-01 at `/documents` — the three home-wide list screens whose rail entries had pointed at nothing since Phase 0. Departures are in `docs/DEPARTURES.md` under *Risk assessments, consent and documents*.

**The mistake, plainly.** Phase 9 recorded in DEPARTURES that these three had no home-wide screen because "a home-wide screen for each is not in the CW PRD". That is false, and it was false when it was written: RA-01, CON-01 and DOC-01 are full screen specifications in `docs/CW_PRD.md`, of the same shape as GOAL-01, ACT-01 and INC-01, which were built without anybody hesitating. The sentence was written from memory of what had been built rather than from the document, and then it stood as a reason — so the next phase read a decision where there had only ever been an omission. **A departure is a claim about the PRD, and a claim about a document is checked against the document.**

**Why nine phases went by.** `isBuilt()` reads the route table, so a rail entry whose module has no route draws "not built yet" on a press rather than a dead link. That is the right behaviour and it is why nothing ever broke: the navigation never lied to a reader. What nothing checked was whether anybody intended it. `scripts/check-nav-reach.mjs` now fails the build for a rail entry with no screen unless somebody names it in `DELIBERATELY_UNBUILT` with a reason, and it also checks the thing `isBuilt` cannot — that a nav item's `path` is the path its route declares, since `isBuilt` matches on the module alone and a drifted path would pass it and 404 on click. Broken on purpose twice: once by removing a route's `module`, which reproduces the original defect exactly, and once by changing a nav path so it no longer matched its route.

**Every figure the PRD quotes, the fixtures already produced.** 78 never assessed of 252, across 28 residents and 9 templates, 9 past their review date. 42 consents never sought of 224, across 28 residents and 8 types, 64 decisions made for somebody rather than by them. 237 of 306 documents carrying an expiry decision — 77% — and the three category rows DOC-01 illustrates, 109/10/5/21, 41/5/1/9 and 34/3/3/4, to the document. Nothing was tuned to match: the counting was written from the record and the numbers came out. They are asserted by number in the tests rather than as `greaterThan(0)`, so a change to either the counting or the fixtures fails by name.

**Decisions this took beyond the brief.**

- **An assessed risk with no review date is a fifth state.** RA-01's tabs are Never assessed, Review overdue and Review due, and a review nobody has scheduled has passed no date — filing it under "overdue" would claim a deadline that was never set. There are 17 at Rosewood. They sit in All and in no other tab, and are counted and named under the second card so they are not a state a reader can only find by scrolling.
- **Who decided outranks what was decided, on the consent list.** An attorney's refusal is "Decided for them", not "Refused". The Refused tab is the resident saying no, and putting somebody else's decision under the resident's name is exactly what the record's decision authority exists to prevent.
- **An expired document still carries an expiry decision.** Somebody decided and the decision ran out, which is a finding; folding it into the missing-decision count would hide the difference the lead figure exists to show.
- **All seven document categories, where DOC-01 illustrates three.** A screen showing three headings tells a reader there are three kinds of document.
- **A row a care worker's list does not reach stays on the list and says so.** The home's gap is the home's whether or not this person was given that resident; what their list decides is whether they can open the record behind the row.

**The hatch gained an eighth form.** RA-01 and CON-01 both specify a dark summary card with a hatched *border*. Composing `.unrecorded` would bring the gradient and the ink with it, painting the tint over `--purple-900` and the unrecorded ink over white text. `.unrecordedEdge` is the dashed edge alone, in the hatch's own file because `check-hatch.mjs` allows that declaration there and nowhere else — which is the rule working rather than being worked around: no other dark card can quietly acquire an edge that says "nobody recorded this" about a figure somebody did record. `ActionCard` takes `gap` to ask for it, and its docblock says what it is not for.

**Found on the way.**

- **Two tests written with an escape hatch, caught before they shipped.** Both had the shape §8 named last phase — `if (shown.length < 2) return expect(true).toBe(true)` — and both were rewritten to assert the fixtures' real figures once those were known. The §8 entry was four hours old and the habit still produced them; what stopped them was reading the test back with its name covered up.
- **A second false claim in the same file.** DEPARTURES said Reports "shows a no-access page". No such page was ever built. Corrected, with what is actually true: no route, no rail entry, no link.

**Mutations run**, each confirmed landed in the code under test and reversed by hand: the consent list flattening who decided into what was decided; the risk list ranking an overdue assessment above one never assessed; the documents screen counting a missing expiry decision as one; and the two against the new guard.

Screenshots of all three, both roles, 1440 and 390, colour and greyscale, at `/private/tmp/claude-501/-Users-frankyflex-Documents-digi-care-cw/440b06aa-1a63-4210-af3c-bb85b83e94d5/scratchpad/shots-p11-final2`. Two things came out of looking at them rather than out of a test: 78 uncapped rows made the risk screen 7,000px at 1440 and 16,000px on a phone, so both lists now page at 25 through the `Pager` the residents list already uses; and the dark card was offering a button to show the tab already on screen, which is the grey-link problem inverted — it is a statement while its own tab is the view, and a button once the reader is somewhere else.

---

## The dashboard's figures row, and a test that expired (19/09/2026)

**The layout.** The dark "Already late" card no longer grows: it holds the left of the row at 380px, and the four metric tiles take the rest two up and two down. It was `flex: 1 1 320px`, which gave the card and the tile strip a share each and left the four tiles in a single line beside the thing they are context for. The card is the reading order's first stop; the tiles are its surroundings.

Flex, never grid: two per row comes from a basis of `calc(50% - var(--space-16) / 2)`, so `2 × (50% − 8px) + 16px` is exactly the row. Measured at five widths rather than assumed — 1440, 1280, 1100 and 900 all give the 380px card and a 2×2 block whose bottom edge meets the card's, and 390 stacks the tiles one per row with no horizontal overflow anywhere.

**Scoped to this screen, deliberately.** `MetricTile` owns its own class and four other modules draw the same card, so the two-up rule is reached through `[data-metric-tile]` from the dashboard's own stylesheet. Residents, Care notes, Handover and Medications keep the row of four they were built with.

**Then the card went to 460px and the two cards below it paired up.** Rounds today on the left, what the record holds on the right, equal width and one height. They are one reading — the rounds are today's doses, the bars are what the record holds across every module — and comparing them meant scrolling between two full-width cards.

**Widening the card is width the tiles lose, and the sum is what broke.** At a 420px basis for the tile block the row stopped fitting just above the compact breakpoint: around 1024 the block dropped below the card and left it alone on a line with 430px of nothing beside it — a band narrow enough that only a measurement finds it, and one nobody would have thought to screenshot. The basis is now the narrowest the block can honestly be, two tiles at their floor plus the gap, and the floor came down from 200 to 180. Measured at 1440, 1280, 1100, 1040, 1024, 980, 900 and 390: card at 460 with the 2×2 beside it and the two cards side by side at every one of them down to 900, everything stacked at 390, and no horizontal overflow anywhere.

**Then the chart was made to grow, which is what the card actually needed.** The footnotes had been pushed to the foot with `margin-top: auto`, and that moved the void rather than filling it: `RoundColumns` held `height: 220px`, so the columns stayed at the top of a card sized by the bars beside them and the notes sat stranded at the bottom with nothing in between. It reads worst in the state a shift actually sees — one round with doses and three still to come — which is what the screenshot showed.

The fixed height is a floor now. `.columns` takes `flex: 1` with `min-height: 220px`, so it fills whatever it is given and resolves to exactly 220 where nothing stretches it — checked on the specimens sheet, which draws the same chart in a column of its own and still measures 220. The notes went back under the legend, where they read.

**The card is 480px and the tile floor is 176px, and both were solved rather than picked.** The floor has to clear two bounds at once: above 171, half a phone's content less the gap, or the tiles sit two across on a 390 screen at less than the strip's own floor; and at or below 180, because at 1024 the content is 892px and the card takes 480 of it. Outside that range something breaks at one end or the other, and both ends were measured.

**The tile block grows at 999 to the card's 1.** So the spare width on a shared row goes to the tiles and the card holds the width it was sized to — but below about 850 the tiles wrap onto their own line, and a card that could not grow sat there at 480px with 300px of white beside it. Now it fills the line it is alone on. Measured at 1440, 1280, 1100, 1024, 980, 900, 820, 768 and 390.

**And a test that was true for one day.** The full verify failed on two tests in `report.test.tsx` that nobody had touched: the date had rolled to the 19th, and the incident form's tests held `'2026-09-18T20:20'` as the expected default and `'2026-09-19T08:00'` as a time "in the future" — which had become the past. Both now derive from `now()`, the same clock the screen reads. A sweep of every test file that imports the fixture clock found no others of that shape: the rest supply their own `now` beside their own records, where the literals and the clock move together. New §8 entry.

---

## One tile height on Residents and Care notes (19/09/2026)

The metric tiles came out 172px on Residents and 192px on Care notes, and the reason was nothing a reader could learn anything from: Care notes has a figure that is a hatched chip with a long label, and Residents has a denominator that wraps to a second line. Both modules put the strip in a `.tileColumn` beside the dark card, the column is stretched to the card's height, and the strip inside sized to its own content — so the slack fell at the bottom of the column and the tile height became a fact about one tile's content.

`MetricTile.module.css` already refuses this inside a strip: `align-items: stretch`, with a comment saying a tile that is taller because its figure is a hatched block rather than a numeral reads as a difference in the data. This is the same refusal one level out — `.tileColumn > section { flex: 1 }`, the idiom both files already use for `.lead`. Both strips are 235px now, and they end where the dark card beside them does: 235 + the 8px gap + the 16px scope note is the card's 259.

**Medications keeps its own height, deliberately.** Its strip sits in the same shape of column, but its dark card is 390px against a 158px strip, and filling that column would give it 358px tiles — a tile sized by a card that happens to be tall is the same defect the other way round. Left as it is, and the difference is worth a look next time that screen is opened.

Measured before and after on all five modules that draw the strip, rather than inferred: Residents 172→235, Care notes 192→235, Handover 315 (stretched by its own card, unchanged), Incidents 291 (unchanged), Medications 158 (unchanged).

---

## The resident's record: no edit controls, and a composer in a dialog (19/09/2026)

**Four tabs stopped saying whose job the editing is.** General Information, Important People and Future Plans each drew a disabled "Edit profile" with the role table's refusal beside it, and Needs drew "Edit care plan" the same way. Table 3 gives both roles `Read only` on both acts, whatever the resident, so these were acts no reader of this product can ever perform — drawn four times on one record, each telling a care worker about an admin's or a manager's job.

**CPLN-01 asked for exactly this and the build had not done it**: "No Edit button, no Finalise button, no PIN entry for care workers". The Needs tab had an Edit button. That is the thing worth noticing rather than the tidy-up: the control was added so that a refusal could be attached to it, and then carrying the refusal became the reason the control existed. §6 says a control that *does nothing* must say so at the point of the act; it does not ask for a control to exist so that something can be said. Where an act is refused to everybody who can sign in, drawing nothing implies nothing, and that is the honest screen.

The three acts that stay are the ones a reader here performs: scoring an assessment, recording a consent decision and filing a document are live for a senior carer and refused for a care worker in the table's words. The rules for editing are untouched in `capabilities.ts` and still tested in `capabilities.test.ts`; four screen tests now assert the stronger thing — that the tab draws no control that writes at all, and repeats none of the role table's refusal text.

**Writing a care note moved to the head and into a dialog.** The act was a link under the card's subtitle, reading as a footnote to it, and it navigated to a second address. It is now a button at the right of the card's head, and it opens the composer over the record.

- `NoteComposerRoute` was split: `NoteComposer` holds the draft handling, the role answer and the save, and takes only what to do afterwards; the route is a wrapper that navigates, and the dialog is a wrapper that closes. No second copy of the composer.
- **The subject travels with it.** `NoteForm` draws `SubjectStrip`, so the photo, name, room and date of birth are on the write surface in the dialog as they were on the page. §2 does not relax because the surface is a dialog.
- **The list behind the dialog re-reads on save**, because the page it replaced got its fresh read by navigating. A dialog closing over a list that still showed the record as it stood a moment before would be an absence meaning "no note" immediately after one was written. Mutation-tested: dropping the reload from the read's dependencies fails the new test.
- A dialog holding a form is 880px where a confirmation is 560 — `NoteForm` is laid out for 880 and had 512. The gutter is kept, so at narrow widths they are the same panel.

---

## The head of a resident's record, rearranged (19/09/2026)

Built to the reference: the photograph, then the preferred name over the full legal name, then room, date of birth and home as label-and-value pairs divided by a rule — the label quiet, the value not, because what a reader scans for is the number and "Room 213" in one weight makes the word and the number equally loud. At the right, the GP and the next of kin as two chips, each with the role above the name and the number.

**The call button went with it, and that is the part worth arguing.** It placed no call and carried "Calling is not built: this is a design specification." — a line that existed only because the button did. What a care worker needs is the number, which they dial on the handset in their hand. A chip that states it promises nothing it cannot do, so there is nothing left to disclaim. Same shape as the edit controls earlier today: §6 asks a control that *does nothing* to say so; it does not ask for a control to exist so that something can be said. Tap-to-call stays in RES-02, where a developer will find it.

**A contact nobody has recorded keeps the hatch and does not become a chip.** "GP not recorded" sits beside a recorded next of kin looking nothing like it, checked on Okafor, who has exactly that pair. A gap that borrowed the chip's shape would read as a contact somebody had entered.

**Found by looking at 390 rather than by a test.** The divider is a `border-left` on the second and third fact, and a border-left follows its item onto a wrapped line and lands at the start of it — at 390 the third fact began with a rule dividing nothing. Worse, the comment I had just written claimed it "goes when they wrap onto their own lines", which it did not: CSS cannot ask whether an item wrapped. Below the breakpoint they stack one per line with no rule, and the comment now says what is true.

**And one the linter caught.** The chip's prop was `role`, which on a JSX element is the ARIA attribute as far as `jsx-a11y` and a reader are concerned. It is `heading` now.

**Then the row was centred.** It was top-aligned, which hung the photograph and the two chips off the top of a block whose height the name and the three facts set: the chips ended level with "Ada" and the lower half of the avatar sat against nothing. Measured after: the avatar, the name block and the contacts all centre on the same line, and the row fills the card's content box exactly.

---

## Reading a care note: the row, the five facts, and the correction panel (19/09/2026)

**"Open this note" moved to the right of the row.** Under the body it read as another line of the record rather than as the thing to do with it.

**The five facts became five shapes.** Category, author, time, shift and mood were one size, one colour and one weight in a row — "Social and Emotional D. Morrison 19/09/2026 19:22 BST Late shift mood good" read as a single grey string, and a reader scanning a page of notes for *when* had to parse *what about* first. The category is a filled chip because it is what the eye sorts by, the author is the darkest because a record's author is the fact this product exists to keep visible, the time is quiet and tabular, the shift is outlined so it qualifies the time beside it rather than competing with it, and the mood is a neutral chip.

**None of them carries a status colour**, and that was the constraint worth holding. A category tinted amber or green would say something about the note nobody recorded. The mood especially: `MoodBadge`'s docblock already argued it stays quiet at every score, and it was right — "mood low" in amber makes how somebody seemed one afternoon look like something to action, and "mood good" in green is the product calling an ordinary day good news. It is a chip on neutral ground, which is quiet without being indistinguishable from the timestamp it sat beside.

**The correction panel stopped naming whose note it is.** It drew a disabled "Add a correction" with the role table's reason and a line reading "Only C. Nwosu, who wrote it, can correct it", plus "speak to C. Nwosu". The author is already on the note a line above. The refusal was telling a reader about somebody else's job — the third time today that shape has come up, after the resident record's edit controls and the head's call button. What is theirs is writing their own note, so that is the only thing there now, as a button that opens the composer over the note rather than a link to a second address.

**The immutability line lost its second sentence**: "A care note is never changed once saved. A correction is kept with it."

---

## A resident's medications tab and the MAR chart (19/09/2026)

**Open MAR moved to the right of the head and is the only act there.** "Add interim medication" was beside it, disabled, carrying the role table's reason — a clinician or a manager adds one, and neither role that signs in here is either. Fourth time today for that shape, after the record's edit controls, the head's call button and the note's correction panel: a control nobody reading this product can use, whose only content is whose job it is. The rule is untouched in `capabilities.ts`, and the Medications *module* still has its Add interim tab, which is where a statement about the act belongs.

**On the MAR**, the way back out is above the card now, in every state the screen can be in rather than only where the chart loads — inside the card it was the last thing under the legend, which is the bottom of a chart people scroll. The month nav, the export and the bounds of the record are one right-aligned group beside the heading; they were three stacked blocks under it, so finding out which month was on screen meant descending the card. The export's "no file is produced" line is gone: a sentence about what this build cannot do, on a screen whose subject is the record.

**The layout took three attempts and a measurement to get right**, which is the part worth writing down. The group kept dropping onto its own full-width line below the heading. The cause was `flex-basis: auto` on it: an auto basis is the group's *max-content* width — the nav, the export and the whole bounds sentence side by side, about 1060px — so with the heading's own 260 the row overflowed and both items wrapped to full-width lines. Two screenshots read as "nearly right, nudge it"; the measurement said head and group were each 1264px wide at different tops, which named the cause immediately. A basis of zero lets the row divide what it has, and the sentence wraps inside the group where it belongs.

---

## The MAR chart, brought in line with the Admin build's (19/09/2026)

Read the Admin build's chart rather than guessing at it. Four things it had that this one did not: a sticky header, a bounded scroll box for the header to stick within, a per-row total at the right, and a sticky totals column. All four are in now, and all four were confirmed by measuring the scrolled chart rather than by looking at a screenshot: after scrolling 200px down and 600px across, the first header row sits exactly at the box's top, the second exactly 32px below it, the medication column holds at left 108 and the totals column at right 1416.

**The row total is where the care went.** It is Rule 4 on every row — "33 given of 38 due", with "1 with no record" above it in the unrecorded ink — and the two are never summed, because a dose nobody recorded and the row's coverage are different facts. The denominator is what the record covers *for that medicine*, never the row's cells: most cells on a row are another medicine's round, and counting them would put a denominator on the row that nothing was ever expected against, growing whenever somebody else's medicine gained a round time.

**Two mutations, and the second one taught something.** Zeroing the scheduled count failed the new test at once. Counting a medicine's *unscheduled* rounds — exactly the defect the comment warns about — **passed**, because the assertion was only `denominator <= cells.length`. Tightening it to count the cells' looks then came out off by one, which was the real find: **a recorded "nothing was due" draws exactly as a round the medicine is not on.** To a reader those are the same thing and should look the same; to the row's denominator they are not, and nothing in the DOM could tell them apart. The cell now carries `data-recorded`, the test asserts the denominator exactly, and the mutation fails.

That is the third time this week a test has been tightened twice before it held. The shape each time: the first assertion was a bound rather than an equality, and a bound is satisfied by a great many wrong answers.

---

## The MAR chart, the rest of the way to the Admin build's (19/09/2026)

Five things the reference had that this one did not, read out of the Admin build rather than guessed at: the week/month range, the omissions banner with its filter, the legend above the grid, glyph-only cells, and the range's own heading.

**The week and month were already written down as owed.** CLAUDE.md §6 names this exact case when it explains what a segmented control is for — "the MAR's week and month" — and only the month had been built. The grid model moved from "a month and a history" to "the days you hand it", which is a smaller thing to reason about: `daysIn(anchor, range, history)` clips to the record at both ends, as the month view always did, so no column stands for a day the record does not reach.

**The words came out of the cells and stayed on the page.** They were added when this was ported, with a docblock arguing every state should carry a shape, a word and a sentence. A week of them is a wall of text in which the one hatched cell is harder to find than it is among shapes — which is the opposite of what the screen is for. The shapes and the sentences remain, and the legend sits above the grid where it is read before the grid rather than after it.

**Two rules had to hold while that happened**, and both cost more than the change itself:

- A dose given without its second signature is two facts, and §1 forbids putting the second "in small print". At glyph density there is no room for the words, so it takes the unrecorded dashed edge — an eighth form in the hatch's own file — over the settled fill it keeps. Never a third fill: averaging a record and a gap gives a state that is neither.
- A closed omission keeps its hatch and gains a glyph, because closing is a decision about the gap rather than a filling of it.

**The test that nearly went wrong.** `isHatched` was `/unrecorded/.test(className)`, and `composes:` puts both class names on the element — so the new underline matched it, and "nothing else in the grid is hatched" started failing on a cell that is not hatched at all. The fix is a boundary in the pattern, but the lesson is the one §8 keeps repeating: a check written against a class *name* is a check against a naming convention, and the convention had one more member than it did yesterday.

**And a bug the screenshot caught rather than a test.** The totals column header read "This month" while the range was a week — a denominator naming a span the chart was not showing. It follows the range now, with a test.

**Three more the eye caught and the measurement named.**

- **Every dose sat 7 to 9px left of its own round time.** The `<td>` carried `text-align: center` and the cell is a flex box, which that does not move: the square sat at the left of a 51px column while 08:00 was centred over it. Header centres were 374, 425, 476 and the cells' were 367, 416, 468. `margin-inline: auto`, and they are 375, 425, 476.
- **The legend's swatch was 72 by 48 beside a 34px cell** — two and a half times the area of the thing it explains, so the legend was showing a reader something they would not meet in the grid. Two causes: `--mar-cell` was declared on `.grid`, and the legend draws the same cell from outside the table, so the variable resolved to nothing there; and a rule forced the swatch to 4.5rem by 3rem on top of that. The variable belongs to the screen, and the override is gone.
- **Two legend entries explained a cell by showing nothing at all.** "Not started" and "Not held" are the near-white empty cell, which reads in the grid against the rules between columns and vanishes on the legend's white card. A faint edge makes the empty box an empty box wherever it is drawn — not the info outline, which is heavier and coloured and means the opposite.

The legend's notes are a phrase each now rather than a sentence: "recorded, with who and when", "window closed, nobody wrote". Ten of them in sentences was a paragraph above a chart nobody had read yet.

**Then two legend entries still had no swatch, and the cause was worth the afternoon.** "Not started" and "Not held" were not missing their swatch: it was **2 pixels square**. `.cellQuiet { composes: cellNotDue }`, and `.cellNotDue { composes: cell }` — **`composes:` does not chain.** The element came out with `cellQuiet cellNotDue` and no `cell`, so the width, the height and the `display: flex` were simply absent and a 1px border round a zero box was the whole of it.

Nothing in the build said so. Both classes exist, `check-css-classes` was happy, the typechecker has no opinion, the screen rendered. The CSS reads correctly — you have to know the rule to see it. It was found by somebody looking at the legend and saying two entries had no box, and named by measuring the elements rather than by reading the file.

`check-css-classes.mjs` fails on a composition whose target is itself a composition now, and says which base to name directly. Broken on purpose by putting the original line back: it names the file, the class, the chain and the fix. No other sheet in the build has one. New §8 entry.

The swatch is also aligned to the first line of its words rather than centred on all of them, so an entry whose note runs to three lines no longer drops its swatch a line and a half below the title it belongs to.

**And the fix for the grid's alignment was itself the cause of the legend's.** Centring the dose under its round time was done with `margin-inline: auto` on the cell — which is right in a table cell and wrong in the legend, where the same cell is a flex item and an auto inline margin absorbs the row's free space. Each swatch was pushed right by a different amount depending on how long its words were: 25px on "Given", less on "No record, closed", which is exactly the ragged spacing that got reported. One rule, correct where it was written and wrong everywhere else the same cell is drawn.

The cell is `inline-flex` now, so the `<td>`'s own `text-align: center` centres it and nothing has to reach into the box from outside. Measured after: every legend entry has its swatch flush at the item's left edge with the same 8px gap to the words, and the grid's cells centre on 375, 425, 476 under headers at 374, 425, 476.

**The doses were also pinned to the top of their rows.** A row is as tall as the medication beside it — name, dose, tags — and the square sat at the top of that, level with nothing. `vertical-align: middle`: 23px above and 24px below in an 81px row.

---

## Where an act sits, four screens at a time (19/09/2026)

Four small changes with one rule behind them: **the act goes at the right of the card's head, and the way out goes above the card on the left.** Under the head an act reads as a footnote to the subtitle; in the head's action slot the way *out* reads as the thing the screen is for — which on the assessment form is scoring, at the foot of it.

- Scoring a risk assessment: "Back to Ada's assessments" moved from the head's action slot to a pill above the head, the shape the MAR now uses.
- A resident's documents: "File a document" moved from under the findings, where it read as a fourth finding, to the right of the head.
- The care plan: "Edit care plan" is gone — and **CPLN-01 asked for that in as many words**, "No Edit button, no Finalise button, no PIN entry for care workers". That is the second screen today where the PRD had already said not to draw a control the build was drawing. The first was the Needs tab. Both were added to carry a refusal, and then carrying the refusal became the reason they existed.
- Consent: the head stopped announcing "Recording a decision is on each consent type below" to somebody who may record one. The control is a few lines below and in view; the sentence was a signpost to the thing beside it.

The two screen tests that covered the removed controls now assert the stronger thing — that the tab draws no such control and repeats none of the role table's reason.

---

## Taking the refusals out (19/09/2026)

The design owner asked for everything to do with manager cautions, greyed-out buttons and lines explaining that the build is not connected to a backend, a family portal or an admin panel. Surveyed first: **68 `ActLine`s (22 not_built, 35 not_performed, 3 not_stated, 8 refused), 33 `ActPoint`s across 29 files, 53 disabled controls.** Two-thirds of it turned out to be one edit.

**`ActPoint` was the lever.** It drew a disabled `Button` plus the line for whichever answer the role table gave, so every screen that asked the table got the refusal for free — and narrowing it to "draw the PRD's open question and nothing else" took out thirty-odd unavailable controls across twenty-eight screens in one file. The rest was per-file: 65 `ActLine`s, six always-disabled controls, and the constants that fed them.

**The one that can mislead rather than merely declutter is `not_performed`**, and it was flagged before cutting. "Nothing is sent: no manager is told" is the line whose removal leaves a screen that could be read as a screen that sends. It is in `docs/DEPARTURES.md` in full instead — the deliverable is read by developers, and the place a developer looks for what the real thing must do is that file, not a caption inside a rectangle.

Two kinds of disabled control stayed, and the distinction is what makes the rest defensible: **a submit button waiting on its own form**, and **a dose before its round window opens**. Neither says anything about what this product cannot do; both are about what has not happened yet, and both become live without the reader going anywhere.

**The sweep found one screen that was only a refusal.** Add interim's entire content was the role table's reason — neither role adds an interim medication — so the tab, the route and the screen went with it. `check-nav-reach` still passes at 13 items.

Three mechanical failures worth writing down, all of the same shape: **a JSX element removed from inside a conditional leaves the conditional behind.** `{settingUp ? (\n) : null}` is a syntax error, and it happened five times — in `CodeStep`, `MedicationPinStep`, `OmissionsRoute`, `CareNotesRoute` and `ReviewNoteControl`. The typechecker caught every one, which is the point: the script that did the removal could not have known, and did not have to.

**One removal went to the wrong occurrence.** Deleting `const viewer = useViewer()` from `CareNotesRoute` took the first one in the file, which belonged to a different component, and the typecheck named five call sites that had lost their binding. Replacing an exact string that occurs twice is the same defect as a pattern that matches too much (§8, the fifth entry): assert the count, or address the occurrence.

53 tests across 22 files then asserted the thing that had just been removed. Every one was rewritten to assert the new truth rather than deleted, and most got a stronger claim than they had: not "the refusal says X" but "nothing draws a control and the reason appears nowhere on the screen".

## Writing over the record, not at a second address (19/09/2026)

Filing a document, recording a consent decision and scoring a risk assessment all opened a page. Each is now a dialog over the record it is about, following `NoteComposer`: the route keeps the page head and the way out, the form keeps the fields, the role question and the save, `SubjectStrip` travels inside the form. The addresses stay and still work.

**A tab that writes had no way to re-read the record.** The Consent tab reads `resident.consents` from the profile context, which the layout loads once; a decision recorded in a dialog would have left "never sought" on screen beside it. `OpenRecord` gained `reload()`. In this record that is the difference between an absence and a record, which is the whole invariant.

**A dialog inside a dialog was worth a test, and the test was wrong before the code was.** Signing off an assessment opens the medication PIN step in its own dialog. Asserting two dialogs failed — Radix hides the outer one from the accessibility tree while the inner is open, so the count stays at one. The behaviour was right; the assertion assumed a tree Radix deliberately does not build.

Interventions can now be removed one at a time, drawn only where there is more than one row, so the last one cannot be taken away and nothing there is a control that refuses.

---

## Acts at the end of the row, and four more dialogs (20/09/2026)

Nine corrections in one pass, and they turned out to be two rules.

**The first is the row-level twin of a rule already written down.** "The act goes at the right of the card's head" was settled four screens at a time last week; the same thing inside a list row had never been said, so five lists had grown the opposite habit — the act inside the content column, under the words it acts on. Care notes, handover, omissions, the register and the round's doses all moved. The shape that keeps it there is the same in each: `flex: 0 0 auto` and an auto inline-start margin, so the content keeps the width it needs and the act takes only its own.

**The handover's was diagnosable rather than a matter of taste.** Its act column carried `flex: 0 1 380px` — sized for a refusal line the build stopped drawing in the last pass — which was wide enough that the row wrapped it underneath the status. The layout had been correct for content that no longer existed.

**`ActionCard` was build-wide, so it was the one worth measuring.** The foot fact and the act now share a line and wrap to two where the card is too narrow. Measured after: on Omissions they are one line with the act flush at the foot's right edge; on the register the button is long enough to wrap, which is the designed behaviour rather than a miss.

**The four figures cards are one height by construction, not by luck.** `align-items: stretch` was already on the row and on the tiles, and the tiles still sat at their content height — because the tile row itself did not grow inside its column. One rule (`flex: 1 1 auto` on the tiles) plus moving the scope note out of that column, and the register measures 255px on all four.

**The second rule is the one from last week, applied to what was left.** Five more acts opened a page; they open a dialog now. The correction is the one that was actually wrong rather than merely inconvenient: it replaced the button with the form *in place*, which pushed the note being corrected off the top of the screen — the only thing a correction is written against.

**The documents one had a defect behind it.** "Upload a document" on the home's library was a link to `/residents`: it did not open a form at all, it sent the reader to find a person, open their record, find the Documents tab and file it there, with nothing bringing them back. The dialog asks who the document is about and draws no form until it has an answer, which is the same question the old route asked by navigation, asked in place — and it refuses the wrong-subject failure before a field exists.

**A nested dialog measured as one, and the assertion was what was wrong.** Scoring an assessment opens the PIN step in its own dialog; asserting two `role="dialog"` elements failed, because Radix hides the outer one from the accessibility tree while the inner is open. Written down here because it is the second time this week that a test encoded a DOM the library deliberately does not build.

Every placement in this pass was checked by measuring the elements in the running build — right edges against their row's, tops against the content beside them — rather than by looking at a screenshot and agreeing with it.

---

## The card foot, and a page that was asking the wrong way (20/09/2026)

**The `ActionCard` foot went back.** Putting the fact and the act on one line was reaching for the right thing by the wrong means: what was actually wrong is that on a card stretched to the height of the tiles beside it, the rule and the button sat halfway down with empty colour underneath. `margin-top: auto` on the foot says that directly and keeps the shape the card always had. Measured: the Omissions card is 390px and the button's underside is 24px clear of the card's, which is the card's own padding rather than a number anybody chose.

**Signing out was a page, and the page was the defect.** Leaving the screen to be asked whether you want to leave the screen loses what you were looking at before you have agreed to lose anything — and "Stay signed in" then put you on the home page, not back where you were. It asks over the screen now, from the rail, the account menu and the profile's two ways in; `/sign-out` stays as the same question at its own address, and both render one `SignOutConfirmation`.

**Two things worth writing down came out of it.**

The dialog is opened by a module-level counter, the shape `SavedNoteToast` already uses. The first version started `answered` at 0, so **a dialog mounted after a question had been asked opened on it** — which showed up as the next test in the file finding the page hidden behind a modal nobody had opened. It is not a test artefact: a sign-in after a sign-out mounts a second shell, and it would have opened on the first shell's question. `useState(() => asked)` starts each dialog even with what has already been asked.

**`check-session-losses` earned its keep.** The three `*Holdings` calls moved from `SignOutRoute.tsx` into the new file, and the guard failed by name on all three on the first run — which is exactly the half of it that exists to catch a store falling out of the list. The fix was to point the guard at the file that now composes the list; the alternative, that nobody noticed a sign-out had stopped warning about a resident's drafts, is the failure it was written for.

The rail's new test was broken on purpose before it was trusted: the click was changed back to a navigation, the mutation confirmed in the file, and the test failed on the missing dialog. Reversed by hand, not by `git checkout` (§8).

---

## The phone, surveyed before it was changed (20/09/2026)

The build had **twenty** compact rules in it. That is the measure of the problem: a desk layout narrowed, not a phone layout designed.

**The survey came first.** All 24 screens at 390 wide, each asked four questions: does the page scroll sideways, how tall is it, what overflows the viewport, and how many controls are under 44px. It named things no screenshot would have:

- The MAR's `.controlsSide` carried `min-width: 420px` on a 358px screen — **62px of overflow that put the whole page into horizontal scroll**, which is the one thing a chart that scrolls inside its own card must not do, because then two things scroll sideways and neither is the chart.
- The resident record's tab strip had **205px for eleven tabs**, because the two "N more" counters were taking 109px of 358 to say how many tabs did not fit. The counters were the reason the tabs did not fit.
- The MAR chart began at **y=1,936** — two full screens below the top of the page it is the whole point of.
- 33 controls under 44px on the residents list, 28 on medications, 22 on the round.

**The biggest change is the one about where a record's context belongs.** `ProfileHeader` drew the identity, the risk flags and the three routine cards above all eleven tabs. On a phone that is 1,900px of preamble in front of whatever somebody opened. Below the breakpoint they are the front page's, and the identity card and tab strip stay everywhere. What made this safe to do rather than merely tempting is that the wrong-subject check does not live here: every dialog that writes draws `SubjectStrip`, with the photograph, name, room, date of birth and allergies, which is what CLAUDE.md §2 actually asks for.

**Two tables became lists, and the a11y lint decided how.** The first attempt was the standard one — `display: block` on the table elements with the roles written back on — and `jsx-a11y/no-redundant-roles` refused it, correctly: that technique trades real semantics for a stated imitation of them. So each screen carries both renderings and CSS picks, which is what §4 wants anyway. The register's list is honestly a list; the desk's table is honestly a table.

**A sticky rule that was right at 1440 and wrong at 390.** "A total that scrolls away is a total nobody reads" gave the MAR two sticky columns, which on a 358px window left 108px of chart between them. Unsticking the total was a three-line change that took two attempts, and the second one is the entry worth keeping:

**`position: static` on a class loses to `position: sticky` on a descendant selector.** `.grid thead th` pins the header to the top; `.totalHead` pins it to the right. Overriding `position` in the compact block did nothing to the header — a class cannot outrank `.grid thead th` — so the cell stayed stuck horizontally while its own column scrolled away from it. The tell was measured, not seen: the "This week" header at x=262 with its column at x=892. Releasing `right` instead of fighting `position` stops the horizontal stick and leaves the vertical one, which is the half still worth having. **When an override does nothing, read what else sets the property before changing the value again.**

**A fix whose probe could not see it.** The switch grows its hit area with a `::after` overlay, so the button's own box stays 24px and the survey went on counting it as a short target. Hit-tested instead — `elementFromPoint` at 14px above and below its centre, both landing on the switch — after the first probe returned `none` at every offset because the element was below the fold and nothing was there to hit. A measurement that cannot fail is not a measurement.

**What got worse, and is reported rather than buried.** The register is 39,913px on a phone against the table's 24,103. A list costs about 65% more height than a table, and buys a screen that can be read at all. It is the one number this pass moved the wrong way.

---

## Documents, brought level with the Admin build (22/09/2026)

**The instruction was "exactly like the one on the admin", and the first useful thing was to find out what that meant.** Read both builds side by side before touching anything. What already matched was most of it: the three findings never summed, all seven categories always listed, the coverage figure and its wording, the hatch treatment, the broken-reference row. Ours was clearly derived from theirs.

What differed came to six things, and **the CW PRD sided with the Admin build on every one** — which turned the job from "copy their design" into "close a gap we had recorded as a decision". DOC-01 names the "Expiry tracking >" link in as many words, and its care-worker story is access to clinical letters and DNAR forms during care delivery, which needs a viewer. Our DEPARTURES said "no such screen exists in this build, and a link to one would be a dead affordance" — sound about the link, wrong about the conclusion. The answer to a link with no screen is the screen.

**The role table needed checking before any of it.** Table 3 makes a care worker read-only on documents; opening one is reading. So the viewer and the queue are both roles', and the only senior-carer act on the module stays filing.

**The ordering change is the one that is a design argument rather than a port.** The home library was ordered "as an emergency needs them", which is right for one resident's library, where a reader is looking for a document they can name. On the home's library nobody is looking for a category — they are looking for what has gone out of date, and a fixed order puts the same heading first every day of the year. The test for it asserts the property (each category's expired-plus-expiring is not greater than the one before it) rather than a list of ids, so it cannot be satisfied by a coincidence of today's fixtures.

**A defect fell out of the reading.** The home library drew a "Filing a document" card to a care worker: a head, a subtitle, and nothing underneath, because the `ActPoint` inside it stopped rendering when the refusal sweep landed two days ago. The sweep's own rule covers it — a control neither reader can use is not drawn, and neither is the furniture built to hold it — but the sweep only removed controls, not the cards built around them. Worth checking the other screens for the same shape.

**And the calendar surfaced an old one.** `document-library.test.ts` pinned `TODAY = '2026-09-18'` while every expiry in the fixtures is `daysAgo`/`daysAhead` of the fixture clock. By the 22nd a document one day inside the window was three days past it, one figure moved from expiring to expired, and the assertion failed on a tree nobody had touched. Confirmed it predated this work by stashing the change and watching it fail anyway. This is the §8 entry this repo already carries, found a second time in a second file: **the tell is a test that reads fixtures built from `now()` and asserts against a date typed by hand.**

Verified by walking the three screens at 1440 and 390: the link resolves, the queue draws 24 expired rows with its claim carrying both the filter and the denominator, the viewer renders the sample with the banner above it and names the two records that rely on Okafor's DNAR form, and neither width scrolls sideways.

## The category rows, drawn as the Admin draws them (22/09/2026)

A screenshot of the Admin's table, and "design it like that". The shape is four figures in four fixed columns — name, on file, expired, expiring within 30 days, and the hatched chip — with the figure over its own label. Ours had been three status pills that appeared only when their count was above zero.

**The pills were the wrong primitive twice over.** A pill is a state somebody recorded; these are counts. And drawing one only when it is non-zero means a row with nothing wrong looks like a row that stopped talking — which is the invariant this product exists for, read the other way round. A zero is a finding, and "0 expired" is a claim a reader can act on.

Two rules bent the copy slightly and both are worth stating. The figures are coloured on `--status-critical-ink` and `--status-caution-ink` rather than the fills, because text in a fill colour fails contrast and the caution fill is `Toast`'s alone. And the hatched chip stays conditional, because hatching a zero claims a gap the record says is not there.

**The screen was telling a lie I had introduced two commits earlier.** The card's subtitle still read "in the order an emergency needs them" after the rows had moved to urgency order. Caught by looking at the rendered screen rather than the diff. The test that now covers it asserts the order *and* the sentence, because a heading claiming one order over a list in another is a screen telling a reader something it is not doing.

Measured after: the three figure columns start at 479, 684 and 889 on every one of the seven rows — one set of values, not seven.

## The bell, the grid, and a fix for something that was not broken (22/09/2026)

Both controls went in easily. What took the afternoon was believing a test.

Neither menu opened in jsdom. The failure was chased into the `Tooltip` primitive, which really does drop the props an `asChild` parent hands it — `Tooltip` takes `content`, `children` and `side` and ignores the rest, so a `DropdownMenuTrigger asChild` wrapping it loses its own handler. That looked like the answer, and it was changed.

The menus still did not open. A check in a real browser, driven with `element.click()`, agreed they were shut — which felt like confirmation and was the opposite. **Radix opens a menu on `pointerdown`.** The same check driven with the pointer sequence the component actually listens for opened both menus, with the right contents, and had been doing so the whole time. The `Tooltip` change was reverted: it was a speculative fix to a real-but-unrelated shortcoming, made because a broken probe said the component was broken.

Two tells were available before any of that. The trigger already carried `aria-haspopup="menu"` in the dumped HTML, so the composition was reaching the element — whatever was wrong, it was not that the trigger had been lost. And the account menu sits two inches away with no tooltip and works; running the same probe against it would have shown the probe failing on a control known to be fine. That is now a §8 entry: **make the probe fire what the component listens for, and confirm the probe can pass at all.**

The tests ended up split: what the menus *say* is read directly from `NotificationsSummary` and `AppList`, and *that they open* is left to Radix and checked in a browser. Pretending jsdom can drive a tooltip-wrapped pointer-driven trigger would have meant a test that passes for the wrong reason.
