# CLAUDE.md — diGi-Care Care Worker

Rules that hold in every session. The PRD is `docs/CW_PRD.md`; where this build departs from it, `docs/DEPARTURES.md` says so and why. This file is the short list that must never be violated, whatever the task looks like.

**What this is.** A running design specification for the diGi-Care Care Worker product. It is copied into Figma and developers build the real thing from it. UI only: no backend, no database, no authentication, typed fixtures for everything in `src/data/`. **The running build is not the deliverable; a Figma import of it is.**

**Scope.** Care Home only. The PRD's hospital, domiciliary and supported living variations are out. Two roles sign in: **Care Worker** and **Senior Carer**, with what each can do taken from the PRD's role table and held in `src/app/session/capabilities.ts`. Every other role (managers, the auditor, the activities coordinator) appears here as a *subject* of records, never as a viewer, and no branch exists for them. Biometric sign-in, GPS check-in and shared-device mode are stated as unavailable rather than drawn.

**One home, two products.** The Admin & Manager build (`~/Documents/digi-care`) describes the same organisation from the same fixtures. `src/data` was copied from it. A fact about Rosewood Court (28 residents, eight consent types, four round times) is a fact about the home, not a screen decision, and the two products must not disagree about it.

**Stack:** Next.js 16 App Router · React 19 · TypeScript strict · Radix primitives (hand-authored styling) · plain CSS + CSS Modules over custom properties · SVGR through Turbopack.

---

## 1. The Evidence Invariant — the rule this product exists to protect

**A blank must never be able to mean either "no" or "nobody has looked yet".** In a care record those are opposites. Everything below follows from that.

- **No clinical or compliance status is optional.** Every one is a closed discriminated union with an explicit unrecorded member. No `status?:`, no `| null`, no `| undefined`, no default parameter standing in for a missing record. The compiler must reject a screen that forgot the unrecorded case.
- **Unrecorded gets the hatched treatment** (`--status-unrecorded`, dashed border, diagonal hatch) plus visible text saying what is missing. Never empty space. Never a solid neutral fill. Never a RAG colour.
- **The hatch has exactly one owner**: a CSS `repeating-linear-gradient` in `src/styles/unrecorded.module.css`, reached through `<Unrecorded>` or `composes:`. Never an SVG pattern, anywhere, for any chart: the Figma importer drops `url(#…)`, and a hatched gap arrives as a blank that reads as a recorded value. `scripts/check-hatch.mjs` holds this.
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
- **The type scale is closed.** Nine steps, five weights, all in `tokens.css`. A tenth step is a conversation, not a local override.
- **Fonts are the five committed Manrope files, through plain `@font-face` in `tokens.css`.** Never `next/font`, which renames the family to a hash, and never `@fontsource/manrope`, whose woff2 files name themselves "Manrope ExtraLight". `src/assets/fonts/README.md` has the account.
- No dark mode. One palette.
- Spacing is the 4px scale only.
- **Flex, not grid, wherever both would work.** Figma has no grid; its importer builds auto-layout from flex and gap. A table is a `<table>`.
- **Two layouts, one breakpoint**: compact below 1024px (bottom tab bar), wide from 1024px (sidebar). Chosen by CSS alone, never by reading the window in script, so a capture at a width gets that width's layout. The breakpoint is written out in `tokens.css`.
- `scripts/check-figma-export.mjs` holds grid, `url(#…)`, fonts and the breakpoint.

## 5. Primitives

- **No component library that ships styling.** No shadcn, no MUI, nothing with its own appearance. Do not run the shadcn CLI: it installs `lucide-react` and overwrites the stylesheet.
- Primitives are hand-authored in `src/components/primitives/`, thin wrappers over Radix, which supplies behaviour and accessibility and no appearance. Styled to our tokens from the first line.

## 6. Conventions

- **Every product module is loaded in the browser, never on a server. This is a rule, not a workaround.** The fixtures are built against a moment: the instant the page loads, or the one `?at=` asks for. A server rendering at a different moment produces a second record of the same fact. Route files import only `client-only.tsx` and name a screen; every screen is reached through `dynamic(…, { ssr: false })`. `scripts/check-client-only.mjs` holds the imports, and the fixture clock throws if it is ever evaluated without a window.
- **A control that does nothing says so, in one short line at the point of the act, never a paragraph and never behind a click.** `<ActLine>`: `refused` (this role cannot; the words come from `CARE_ACTS`), `not_built`, or `not_performed` (recorded here, and the consequence in the world does not happen: nothing is sent, nobody is notified). The last kind is the one that matters most: a reader who believes the manager was told may not telephone the manager. No screen may claim a notification, an email or a push was sent.
- **Scope, never blame.** A care worker sees the residents they were given: `ResidentScope` from `src/app/session/resident-scope.ts`, the only reader of a resident assignment. Nothing that counts, ranks or renders a gap may read the assignment. `scripts/check-assignment-reach.mjs` holds this.
- **The medication PIN is named the medication PIN**, including where it signs a handover or a risk assessment. It is chosen by the person. It is not the Admin build's signing code.
- **One shape, one meaning.** Underline strip = navigation. Pill = filter. Segmented control = one of a small set of presentations of the same data.
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
