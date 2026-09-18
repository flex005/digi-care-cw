# CLAUDE.md — diGi-Care Care Worker

Rules that hold in every session. The PRD is `docs/CW_PRD.md`; where this build departs from it, `docs/DEPARTURES.md` says so and why. This file is the short list that must never be violated, whatever the task looks like.

**What this is.** A running design specification for the diGi-Care Care Worker product. It is copied into Figma and developers build the real thing from it. UI only: no backend, no database, no authentication, typed fixtures for everything in `src/data/`. **The running build is not the deliverable; a Figma import of it is.**

**Scope.** Care Home only. The PRD's hospital, domiciliary and supported living variations are out. Two roles sign in: **Care Worker** and **Senior Carer**, with what each can do taken from the PRD's role table and held in `src/app/session/capabilities.ts`.

**The CW PRD's role table (Table 3) is the authority for what these two roles can do, in both builds.** Decided 17/09/2026 over the Admin build's permission table, whose cells for these roles predate both PRDs and cite no source, and which cannot express "assigned residents only", "both shifts must sign" or "acknowledge, a manager closes". This build does not inherit that table with corrected values. **The CW PRD is marked draft, for design and engineering review, with no approvers named**: it is the better of the two documents and it is not signed off, so every role rule lives in `capabilities.ts` and no screen compares role names itself, which keeps a disputed row to one edit. (The shape that file should take is proposed in PROGRESS.md, 17/09/2026, and not yet built.) Every other role (managers, the auditor, the activities coordinator) appears here as a *subject* of records, never as a viewer, and no branch exists for them. Biometric sign-in, GPS check-in and shared-device mode are stated as unavailable rather than drawn.

**One home, two products.** The Admin & Manager build (`~/Documents/digi-care`) describes the same organisation from the same fixtures. `src/data` was copied from it. A fact about Rosewood Court (28 residents, eight consent types, four round times) is a fact about the home, not a screen decision, and the two products must not disagree about it.

**Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Radix primitives (hand-authored styling) · plain CSS + CSS Modules over custom properties · SVGR through Turbopack.

---

## 1. The Evidence Invariant — the rule this product exists to protect

**A blank must never be able to mean either "no" or "nobody has looked yet".** In a care record those are opposites. Everything below follows from that.

- **No clinical or compliance status is optional.** Every one is a closed discriminated union with an explicit unrecorded member. No `status?:`, no `| null`, no `| undefined`, no default parameter standing in for a missing record. The compiler must reject a screen that forgot the unrecorded case.
- **Unrecorded gets the hatched treatment** (`--status-unrecorded`, dashed border, diagonal hatch) plus visible text saying what is missing. Never empty space. Never a solid neutral fill. Never a RAG colour. **Never decoration**: the hatch means nobody has recorded this, and it appears nowhere else. If it becomes texture, the only thing this product exists to say stops being visible.
- **The hatch has exactly one owner, in one size**: a CSS `repeating-linear-gradient` of the tint inside a dashed edge, in `src/styles/unrecorded.module.css`, reached through `<Unrecorded>`, `<GapCount>` or `composes:`. The dashed edge is what carries a thin bar segment. Never an SVG pattern, anywhere, for any chart: the Figma importer drops `url(#…)`, and a hatched gap arrives as a blank that reads as a recorded value. `scripts/check-hatch.mjs` holds this.
- **A compound state renders as separate facts.** Given-but-no-second-signature is a green "Given" pill *and* a hatched "Second signature not recorded". Never merged into one pill with the gap in small print.
- **Recorded and unremarkable renders quietly.** Plain text, not a filled pill. Quiet is not hidden: author and timestamp still show. Never reach for this to calm down a *gap*.
- **A claim over a filtered set carries the filter, or it is false.** A gap marker inside "Medication notes only" asserts an absence that is an artefact of the view. Suppress the claim or name the filter.
- **A recorded negative is not an unrecorded value.** "Checked: no injury found" is a complete record and looks settled. "Not checked yet" looks unfinished. Never the same treatment.
- **Every aggregate carries its denominator.** No bare counts, no bare percentages, anywhere. Use the `Aggregate` type. Where coverage is too thin to support a claim, render **Insufficient Evidence**, which is not a milder Red; it is the absence of a finding.
- **A zero is a finding, not a gap.** "0 residents with no care note in 48 hours" is a plain zero. Hatching it claims a gap the record says is not there.
- **Absence from a list is the same bug as a blank cell.** All nine risk assessment templates are listed even if none is completed. All eight consent types. All ten care plan domains.

If you find yourself writing a fallback like `?? 'Low risk'`, `|| 'None'`, `?? 0`, or `?? '—'` for anything clinical or compliance-related, stop. That fallback is the bug this product is being built to prevent.

## 2. Wrong-subject writes

- Every write surface carries a persistent, non-collapsing subject header: resident photo, name, preferred name, room, DOB.
- Subject identity comes from the route parameter. Never from navigation history, "last viewed", or component state.
- Confirmation dialogs name the subject in the sentence. "Record 08:00 medications for Emmanuel Okafor?", never "Are you sure?".
- The active home is always visible in the header, on both layouts, including for somebody who works at only one home.

## 3. Icons

- **No icon library. Ever.** Do not install `lucide-react`, `react-icons`, `@heroicons`, or any equivalent, for any reason, including "just for this one icon".
- Icons come from the Aligned Line Icons set in `src/assets/icons/<CATEGORY>/` (3,559 SVGs, 57 category folders). Never hand-edit those files. `scripts/icons` is the pipeline and is not replaced.
- **Names are namespaced by category** because filenames repeat across folders: `<Icon name="add-remove-delete/add-01" />`.
- `npm run icons` generates `registry.names.generated.ts` (the full name union) and `registry.generated.ts` (only the icons used). **Never hand-edit either.** A name not in the folder fails the build. Icon names written in data belong in a `*.icons.ts` file, which is what the usage scanner reads.
- One `<Icon name="..." />` component. No raw `<svg>` in feature code, no direct imports from `src/assets/icons`.
- If a needed icon is not in the folder: **stop and ask.** Do not substitute an inline SVG, an emoji, a glyph, or a similar-looking icon.

## 4. Colour, type and layout

- **Colour only from tokens.** No hex, `rgb()`, `hsl()`, or named colours in any component. `src/styles/tokens.css` is the single place a literal may appear. Stylelint and `scripts/check-tokens.mjs` enforce this; do not disable, weaken, or add exceptions.
- **Each status has a fill, an ink and a tint.** `--status-X` is for fills, dots, bars, borders and icons. `--status-X-ink` is for text on the tint. Text in the fill colour fails contrast and is a review blocker.
- **The caution fill is below 3:1 by decision, so it never marks a state alone.** `--status-caution` is drawn only by `Toast`, which renders its required title inside the coloured edge and refuses an empty one; the status pill uses the caution ink and tint and never the fill. A caution dot, bar or edge anywhere else fails `scripts/check-caution-carriers.mjs`, and so does a status token name built from a variable. The guard cannot check that the words name the state; review does. The positive fill was darkened to clear 3:1 instead. `docs/DEPARTURES.md`.
- **The type scale is closed.** Eleven steps, five weights, all in `tokens.css`. A twelfth step is a conversation, not a local override. `--text-hero` (52px) is the dark card's figure and nothing else, held by `check-tokens`; `--text-figure` (40px) is a figure with its denominator in a card.
- **Fonts are the five committed Manrope files, through plain `@font-face` in `tokens.css`.** Never `next/font`, which renames the family to a hash, and never `@fontsource/manrope`, whose woff2 files name themselves "Manrope ExtraLight". `src/assets/fonts/README.md` has the account.
- No dark mode. One palette.
- Spacing is the 4px scale, with one exception set by the visual direction: a card's internal padding, `--card-padding`, 22px.
- **The shape language is `docs/cw-dashboard.html`.** It wins over the Admin build on radius, density and layout; the tokens, evidence states and primitives from Phase 0 win on meaning. In short:
  - **Chrome is fully rounded.** The top bar, the rail's two groups, every rail button and every button take `--radius-pill`.
  - **Cards float on the grey page** (`--bg-page`): white, `--radius-xl`, `--shadow-card`, no border, `--card-padding` inside.
  - **Navigation**: a pill of the five shift modules (`PILL_MODULES`) inside the top bar, and an icon rail in two grouped pills: every module, then the account and signing out. On a compact screen the rail becomes bottom tabs and the pill leaves. The page scrolls; the rail sticks.
  - **The page head is personal**: a greeting with the first name, the shift, the home and the list beneath, the primary act as a pill on the right (`PageHead`).
  - **One dark card per screen** (`ActionCard`, `--purple-900`): the thing the reader acts on next, with the largest figure on the screen. Its figure still carries what it is out of.
- **Flex, not grid, wherever both would work.** Figma has no grid; its importer builds auto-layout from flex and gap. A table is a `<table>`.
- **Two layouts, one breakpoint**: compact below 1024px (bottom tab bar), wide from 1024px (sidebar). Chosen by CSS alone, never by reading the window in script, so a capture at a width gets that width's layout. The breakpoint is written out in `tokens.css`.
- `scripts/check-figma-export.mjs` holds grid, `url(#…)`, fonts and the breakpoint.

## 5. Primitives

- **No component library that ships styling.** No shadcn, no MUI, nothing with its own appearance. Do not run the shadcn CLI: it installs `lucide-react` and overwrites the stylesheet.
- Primitives are hand-authored in `src/components/primitives/`, thin wrappers over Radix, which supplies behaviour and accessibility and no appearance. Styled to our tokens from the first line.

## 6. Conventions

- **Every product module is loaded in the browser, never on a server. This is a rule, not a workaround.** The fixtures are built against a moment: the instant the page loads, or the one `?at=` asks for. A server rendering at a different moment produces a second record of the same fact. Route files import only `client-only.tsx` and name a screen; every screen is reached through `dynamic(…, { ssr: false })`. `scripts/check-client-only.mjs` holds the imports, and the fixture clock throws if it is ever evaluated without a window.
- **A control that does nothing says so, in one short line at the point of the act, never a paragraph and never behind a click.** `<ActLine>`: `refused` (this role cannot; the words come from `CARE_ACTS`), `not_built`, `not_performed` (recorded here, and the consequence in the world does not happen: nothing is sent, nobody is notified), or `not_stated` (the PRD lets this role act and does not say for which residents; the words are the question for its author, and the control stays unavailable rather than guessing either way). The last kind is the one that matters most: a reader who believes the manager was told may not telephone the manager. No screen may claim a notification, an email or a push was sent.
- **Scope, never blame, and said out loud.** A figure counted over the viewer's residents says so in the pattern "4 of your 9 residents", with "Counted over your list, not the home's." beneath it. The wording has one owner, `scopeLine` and `scopeNote`. A care worker sees the residents they were given: `ResidentScope` from `src/app/session/resident-scope.ts`, the only reader of a resident assignment. Nothing that counts, ranks or renders a gap may read the assignment. `scripts/check-assignment-reach.mjs` holds this.
- **The medication PIN is named the medication PIN**, including where it signs a handover or a risk assessment. It is chosen by the person. It is not the Admin build's signing code.
- **One shape, one meaning.** A grey track with a raised white thumb = a segmented control: one of a small set of mutually exclusive presentations of the same data, such as the MAR's week and month. A grey track with **no** thumb, the tab you are on in heavier, darker type = navigation, in the top bar only. Navigation is different data, not a different view of it, so it never takes the thumb. Underline strip = navigation within a page. Pill = filter.
- **A card showing a subset of something larger has an expand button** in its top right corner: a 36px grey circle with a diagonal arrow, going to the whole. `CardHead` requires the card to say which it is. **A card that is the whole thing has no button**: a form, a record's own detail, a list that is already every row. It has nowhere to expand to, and an affordance that does nothing when pressed is the grey-link problem inverted: a control that looks reachable and is not. A subset card whose whole is not built yet keeps the button and says so when it is tried.
- **No figure stands alone.** Every number carries what it is out of, on its own baseline: "23 of 37 due", "4 of your 9 residents". `AggregateFigure` requires the caller to state the relation, `of` for a subset and `across` for a count over a population of something else.
- **Nothing is green because it is empty.** Positive is for a state somebody recorded. Nothing due, nothing late and nothing to show are plain words, never a green dot.
- **A value whose correct rendering depends on where it appears gets one owner**, and the call site asks that owner (`pluralise`, `formatLateness`, `formatAttributionOn` and the rest in `src/lib/format.ts`).
- **Amber is for findings.** Never for a gap, a notice, or a recorded administration.
- British English in code and UI copy. Dates `DD/MM/YYYY`, times 24-hour. Relative time only alongside an absolute timestamp.
- **Clinical timestamps render in the home's timezone, never the viewer's.**
- Every clinical record shows its author and timestamp. Always visible, never hover-only.
- Care notes are immutable after submission. No edit control. No delete.
- No `any`. No `@ts-expect-error` without a comment naming what removes it.
- No `localStorage` / `sessionStorage` for record data. In-memory only. **No draft survives a sign-out.**
- No placeholder or lorem text. No `console.log`. No commented-out code.
- Fixtures stay messy on purpose. Do not clean up fixture data to make a screen look better. The gaps are the test.

## 7. Accessibility

- WCAG 2.2 AA. Colour never the sole carrier of meaning. Visible focus ring, never removed.
- The MAR grid is a real `<table>` with header associations and full-sentence accessible names per cell.
- Icons are `aria-hidden` unless labelled. Icon-only controls need a visible adjacent label or an `aria-label` plus tooltip.
- Touch targets on the compact layout are at least 48px tall where they are navigation or clinical acts.

## 8. Standing checks

Earned in this build. Each entry is here because something went wrong here, and says what caught it.

- **A mutation that edits a comment and passes is a mutation that never ran.** Phase 0 proved the client-only guard by replacing the first `ssr: false` in `client-only.tsx` with `ssr: true`. The guard passed. The replacement had landed, and the diff said so, but the first occurrence was in the file's docblock, and the guard reads code with comments stripped. It is the same shape as a replacement that matches nothing and leaves the previous run's result standing: in both, the check reports on a defect that was never put in front of it, and a pass reads as proof. **Confirm the mutation landed in the code the guard reads, not in the file**, and only then read the verdict. Re-run against the code, it failed as it should.

- **A guard can be real and still check less than the rule it stands for.** `check-caution-carriers` holds the caution departure: the fill is below 3:1 on the condition that no caution state is carried by colour alone. It can check that words sit inside the colour. It cannot check that the words name the state: a caution pill reading "Recorded" passes. The check is exact about its own subject, and that subject is narrower than the rule. It is the same family as a reachability guard that finds a link rather than a visible one. **The tell: say what the guard's success line would still print if the rule were broken in the way nobody wrote a mutation for.** Where the answer is "a tick", the remainder is a review question, and it is written down as one rather than counted as covered. The approval this guard stands behind was given on a claim about the Admin build that nobody had checked; checked, two of its 26 caution places were colour alone.

- **A defect can be invisible because the code around it happens to produce the right answer, and copying that code to where the accident does not hold is what reveals it.** The residents list's filter hook never included the search text in its memo. In the Admin build the list it filters keeps its identity between renders, so typing a name has never narrowed the list, and nobody noticed. Copied here, where the list was rebuilt on every render and recomputed the memo anyway, search worked, by accident. What surfaced it was a lint warning read as a warning rather than noise, and a probe in the Admin build confirmed it: "Pemberton" typed, 28 rows still shown. **The tell is that nobody noticed a feature not working**: no test typed into the search, and a screen that shows everybody looks like a search that matched everybody. When a dependency list is incomplete, write the test that fails under the conditions that make it live, here a list that keeps its identity, before adding the dependency.

- **Undoing a mutation with version control undoes everything else in the file too.** Checking that the new `whole` kind of card draws no button, the mutation was reverted with `git checkout` on `Card.tsx`, which restored the file to the last commit and took the uncommitted change under test with it: the `whole` kind, the type and the conditional were gone, and the suite would have gone on to test the old rule. It was caught only because the next command printed nothing where a line was expected. **Revert a mutation by reversing the edit that made it, the same way it was made, and confirm the file then holds the change under test**, not merely that the mutation is gone.

- **A replacement written as a pattern can match far more than the text in view.** Removing a four-line helper from an agent's file, the pattern allowed an optional docblock in front of it, written lazily across any characters; it matched from the file's first docblock down to the helper and deleted most of a file that had never been committed. It was recovered from the agent's own record of writing it, and caught only because the typecheck that followed named every export as missing. The same day's other entry is the same failure by a different tool: an undo sized by what it was meant to touch rather than by what it could. **Replace exact text, asserted to occur once, and check what the file still exports before moving on.**

- **A shell line can report success while the part that mattered never ran.** Adding a CSS class to a stylesheet, the command was `grep … | head -2 || python3 …`: the `||` tests the exit status of the last command in the pipe, so `head` succeeding meant the fallback that would have written the class never ran, and the line reported success. The class was then referenced by a component and was not in the sheet, which CSS Modules resolves to `undefined` — React drops the attribute, the element renders unstyled, and neither the typechecker nor any test that asserts on text or roles can see it. Two failures in one: an idiom that guarded the wrong thing, and a defect class nothing in the build could catch. `scripts/check-css-classes.mjs` now holds the second. **Do not put a guard after a pipe, and where a command's purpose is to change a file, check the file, not the command's exit status.**

- **A test's name can assert what its body never checks, and the suite reads as coverage of the name.** Phase 9's Already-late list had a test called "is oldest first, and every row reaches the record it is about". Reversing the sort passed it: the body checked that each row carried a link and a "Past its date" chip, and nothing in it ever compared two rows. Two more of that phase's tests had the same defect in different clothes — one asserted `data-segment` while the rule under test was which class the segment carried, and one returned early when it found no rows, so it could pass by testing nothing. The common shape is that the assertion could not have disagreed with the code: the name carried the claim and the body carried something cheaper to write. **Read a test by its assertions with the name covered up, and where the name claims an order, a class or a refusal, write the mutation that would break exactly that and watch it fail.**

- **"The name is in the file" is not "the file uses it", and a guard that cannot tell has a hole exactly the width of an import.** Phase 10's session-losses guard checks that every store's `*Holdings` export is asked by something that builds the sign-out list. The first mutation removed the call from the sign-out screen and the guard passed: the import at the top of the file still carried the name, and the guard was matching the name anywhere in the text. The §8 procedure had been followed — the mutation was confirmed landed in the code the guard reads, not in a comment — and it was still a false pass, because what the guard read was too generous rather than too narrow. **A reference count that includes imports, type positions and re-exports counts declarations of intent, not uses**; strip them, or match the call shape, and re-run the mutation against the stricter version before trusting the tick. The same day's other find is its mirror: a test whose name claimed an order its body never compared.

## 9. Stop and ask

Ask before doing anything expensive to reverse:

- Installing any dependency not already in `package.json`.
- Adding, renaming or removing a design token, or introducing a colour, type step or breakpoint.
- Changing the shape of a fixture type, especially a status union. Changing fixture *facts* that the Admin build shares, because the two products describe one home.
- Restructuring folders, routing, or the app shell.
- Changing anything in `docs/CW_PRD.md`.
- Wording in this file outside §8. §8 entries are added as they are earned, and reported.
- Deleting or rewriting existing working code to accommodate new code.
- Any workaround that would relax a rule in this file "temporarily".

When something in the spec is ambiguous or looks wrong, say so and wait. Do not pick the interpretation that is easiest to build.

## 10. Working cadence

- Build **one phase at a time**, in the agreed order. Stop at the end of each phase for review. Before starting a phase, restate what you are about to build and wait for approval.
- **Reports in chat are short**: what to look at, and anything needing a decision.
- **Reasoning, bugs and discoveries go in `PROGRESS.md`**, appended. **Departures from the PRD go in `docs/DEPARTURES.md`**, each with its reason.
- Every screen is reviewed against all seven states before it is called done: Loading · Empty · Partial · Populated · Stale · Error · Read-only. And as **both roles**, at **1440 and 390 wide**, by screenshot, in colour and in greyscale.
- `npm run verify` before a phase is reported. Read the summary line of every stage, not the last line of the run.
- A new guard is broken on purpose before it is trusted, and the mutation is confirmed to have landed.
- "Done" is a claim about the git history, and is checked there.
