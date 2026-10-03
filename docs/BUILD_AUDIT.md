# Build audit — diGi-Care Care Worker

Read-only audit, 03/10/2026, at commit `a71e96c`. Nothing in this repository was
changed to produce it except this file.

Written for a session that knows the diGi-Care **Admin & Manager** build and
nothing about this one. Where the two differ, that is said plainly, because the
most expensive mistake available here is assuming the other build's conventions
apply.

---

> **Written 03/10/2026, as a read-only audit, and landed unchanged except for two
> answers.** Items 2 and 5 of the final section were answered by the design owner the
> same day and are struck through there with the answer beside them. Everything else
> is as it was found. **Two things have changed in the build since**: the fixture clock
> now says when a `?at=` request could not be read (`CLOCK_REQUEST`, `CLOCK_INSTANT`
> and `CLOCK_NEEDS_SAYING` are new, and `MovedClockLine` draws on the last of them),
> and `Incident` has gained `evidence` and `urgency`. §7's account of the failing MAR
> test is history: it was pinned and passes.

## 1. What this is

**The product.** The **diGi-Care Care Worker & Senior Carer** product. Its own
`CLAUDE.md` opens: _"A running design specification for the diGi-Care Care Worker
product. It is copied into Figma and developers build the real thing from it. UI
only: no backend, no database, no authentication, typed fixtures for everything in
`src/data/`."_ And, in the same paragraph: **"The running build is not the
deliverable; a Figma import of it is."**

That sentence governs everything else. This is not an application being shipped.
It is a specification that happens to run, and decisions here are made for what
survives a Figma import and what a developer reads afterwards.

**Scope.** Care Home only. The PRD covers Hospital, Domiciliary and Supported
Living; those are explicitly out.

**Repo and remote.** `digi-care-cw`, remote
`https://github.com/flex005/digi-care-cw.git`, branch `main`, clean and level with
origin at the time of audit.

**Deployment — nothing found, and that is the finding.** There is no `vercel.json`,
no `netlify.toml`, no `Dockerfile`, no `.env*`, no `.github/` directory and no CI
configuration of any kind. A search of every tracked file for an `http(s)://` URL
returns exactly one hit, a Google Fonts stylesheet link inside
`docs/cw-dashboard.html`, which is a static design reference rather than part of the
app. `next.config.ts` contains no rewrites, redirects, `basePath` or `assetPrefix`.

**So: I found no evidence this is deployed anywhere, and I did not find a URL to
be wrong about.** I cannot confirm it is *not* deployed — a deployment could be
configured outside the repository, in a hosting dashboard nobody has committed. If
a URL is needed, ask the person who opens the site. Do not infer one.

**Stack** (from `package.json` and `CLAUDE.md`, which agree):

| | |
|---|---|
| Framework | Next.js 16, App Router |
| UI | React 19 |
| Language | TypeScript, strict |
| Styling | Plain CSS + CSS Modules over custom properties. **No Tailwind, no CSS-in-JS** |
| Primitives | Radix, hand-authored styling. **No component library that ships styling** |
| Icons | Local SVG set through SVGR/Turbopack, generated registry |
| Tests | Vitest + Testing Library, jsdom, `vitest-axe` |
| Tooling | ESLint, Stylelint, Prettier, husky + lint-staged |

Note for the other session: this is **Next.js App Router**, not Vite + React Router.
Routing, data loading and the file layout are not the Admin build's.

**Maturity.**

- 554 files under `src/` (`.ts`/`.tsx`/`.css`), of which 232 are components and 80
  are CSS modules.
- 79 test files, **1041 tests**.
- 10 custom guard scripts in `scripts/`.
- 54 declared routes.
- `CLAUDE.md` 153 lines, `PROGRESS.md` 951, `docs/DEPARTURES.md` 456,
  `docs/HANDOVER.md` 190, `docs/CW_PRD.md` 309.

**Does the suite pass right now? No — 1040 of 1041 pass; one fails.** Details in §7.
`npm run lint` (all twelve stages) and `npm run typecheck` both pass.

---

## 2. What exists

### Routes

54 declared in `src/app/routes.ts`, which is a manifest held against the `page.tsx`
files on disk **in both directions** by `routes.test.ts` — a declared route with no
file and a file with no declaration both fail.

**Signed out (12):** `/sign-in`, `/sign-in/code`, `/sign-in/home`, `/signed-out`,
`/forgot-password` ×4, `/invitation` ×4.

**Shell (42):** `/` (dashboard), `/residents`, `/care-notes`, `/care-notes/new`,
`/handover`, `/goals`, `/goals/[goalId]`, `/activities`,
`/activities/[activityId]`, `/incidents`, `/incidents/new`, `/medications`,
`/medications/round`, `/medications/register`, `/reviews`, `/risk-assessments`,
`/consent`, `/documents`, `/documents/expiry`,
`/documents/category/[categoryId]`, `/documents/[documentId]`, `/profile`,
`/specimens`, `/sign-out`, and the resident record: `/residents/[residentId]` plus
`needs`, `people`, `future-plans`, `notes`, `notes/new`, `notes/[noteId]`,
`medications`, `medications/mar`, `risk-assessments`,
`risk-assessments/[templateId]`, `care-plan`, `care-plan/review`, `goals`,
`consent`, `consent/[consentType]`, `documents`, `documents/new`.

**Stubs: none.** The shell can render "`<module>` is not built yet" for a nav item
whose module has no route (`NavEntry.tsx`), but **all 13 nav modules have routes** —
I checked the two lists against each other and the difference is empty.
`check-nav-reach.mjs` enforces this and reports "0 deliberately unbuilt".

### Modules

`activities · care-notes · consent · dashboard · documents · goals · handover ·
incidents · medications · profile · residents · risk-assessments · specimens`

Plus two things that are **not** nav modules and are easy to miss:

- **Care plans** are a tab on the resident record (`/residents/[id]/care-plan`),
  not a module.
- **Reviews** has a route (`/reviews`) but no nav entry pointing at it.

**Deliberately absent:** Reports, Compliance, Settings and Team Management. Not
stubbed — absent, because neither role has access. `nav.icons.ts` says so in a
comment, and `capabilities.ts` refuses `open_compliance_and_reports` and
`open_settings_and_team` to both roles.

### Role model

Two roles sign in: **Care Worker** and **Senior Carer**. Covered in §4.

### Guards and `verify`

`npm run verify` = `icons:check && typecheck && lint && format:check && test && build`.

`npm run lint` is twelve stages — ESLint, Stylelint, then ten bespoke guards:

| Guard | What it holds |
|---|---|
| `check-css-classes` | Every `styles.x` exists in the sheet. A missing class renders as *no* class, silently |
| `check-tokens` | No colour literal outside `tokens.css`; `--text-hero` used by the dark card alone |
| `check-hatch` | The unrecorded hatch has one owner, one size, and appears nowhere else |
| `check-assignment-reach` | Only four places may read a resident assignment; nothing that counts or ranks may |
| `check-client-only` | Every screen loads in the browser only; no route file reads a record |
| `check-figma-export` | No CSS grid, no `url(#…)`, committed fonts only, one breakpoint |
| `check-caution-carriers` | The caution *fill* is drawn only by `Toast`, which carries words inside it |
| `check-role-names` | **No screen names or compares a role.** Only the role table may |
| `check-session-losses` | Every session store is named before a sign-out destroys it |
| `check-nav-reach` | Every nav item resolves to a real screen |

All twelve pass at `a71e96c`.

### Convention documents — **read these before writing prompts**

`CLAUDE.md` (153 lines) is the binding one. `AGENTS.md` is a **symlink** to it, so
both names reach the same rules. Quoting the parts that constrain how work happens:

**§1, the rule the product exists for:**

> **A blank must never be able to mean either "no" or "nobody has looked yet".** In
> a care record those are opposites.
>
> No `status?:`, no `| null`, no `| undefined`, no default parameter standing in for
> a missing record. Unrecorded gets the hatched treatment plus visible text saying
> what is missing. **A compound state renders as separate facts.** Every aggregate
> carries its denominator. **A zero is a finding, not a gap.** Absence from a list
> is the same bug as a blank cell.
>
> If you find yourself writing a fallback like `?? 'Low risk'`, `|| 'None'`, `?? 0`
> … that fallback is the bug this product is being built to prevent.

**§9, stop and ask** — ask before: installing any dependency; adding/renaming/removing
a design token, colour, type step or breakpoint; **changing the shape of a fixture
type, especially a status union**; **changing fixture facts the Admin build shares**;
**restructuring folders, routing or the app shell**; changing `docs/CW_PRD.md`;
wording in `CLAUDE.md` outside §8; **deleting or rewriting existing working code to
accommodate new code**; any temporary relaxation of a rule. And:

> When something in the spec is ambiguous or looks wrong, say so and wait. Do not
> pick the interpretation that is easiest to build.

**§10, working cadence:**

> - Build **one phase at a time** … **Before starting a phase, restate what you are
>   about to build and wait for approval.**
> - **Reports in chat are short.**
> - **Reasoning, bugs and discoveries go in `PROGRESS.md`**, appended. **Departures
>   from the PRD go in `docs/DEPARTURES.md`**, each with its reason.
> - Every screen is reviewed against all seven states … and as **both roles**, at
>   **1440 and 390 wide**, by screenshot, in colour and in greyscale.
> - `npm run verify` before a phase is reported. **Read the summary line of every
>   stage**, not the last line of the run.
> - **A new guard is broken on purpose before it is trusted**, and the mutation is
>   confirmed to have landed.
> - **"Done" is a claim about the git history, and is checked there.**

**§8 is a list of 12 standing checks earned by things that went wrong here.** It is
the highest-value section for a new session and too long to quote; read it. Three
that will bite soonest: a mutation that edits a comment never ran; a test's name can
assert what its body never checks; a date written into a test is true for one day.

Other rules worth knowing before proposing anything: **no icon library, ever**;
**flex, not grid** (the Figma importer builds auto-layout from flex); **one dark
card per screen**; **British English**, `DD/MM/YYYY`, 24-hour; **care notes are
immutable**; **no `localStorage`/`sessionStorage` for record data**; **no draft
survives a sign-out**; **fixtures stay messy on purpose**.

---

## 3. The three cross-build items

### Incidents

**The module exists and is substantial.** `/incidents` (the log) and
`/incidents/new` (the report form), plus `src/features/incidents/` — 12 files
including `ReportIncidentRoute.tsx`, `IncidentsRoute.tsx`, `AcknowledgeControl.tsx`,
`IncidentRow.tsx`, `report-rules.ts` and two test files. The `Incident` type is 442
lines in `src/data/types/incident.ts`.

**A care worker can report one.** `report_incident` is `may('not_stated_beyond_your_list')`
for a care worker and `may('your_list')` for a senior carer. The "not stated" part is
real: the PRD gives a care worker their assigned residents and says nothing about the
rest, so a resident off their list draws the PRD's open question at the act rather
than a guess either way.

**What the report captures:**

| | |
|---|---|
| Type | 12, closed: witnessed/unwitnessed fall, medication error, medication stock discrepancy, unexplained injury, behaviour, absconding, choking, acquired pressure ulcer, safeguarding concern, equipment failure, near miss |
| Severity | 4: no harm, low, moderate, severe |
| Time | `occurredAt`, defaults to now with a prompt to correct it, in the home's timezone |
| Place | `IncidentLocation` — a resident's room, a communal area from a closed list, or explicitly not recorded |
| Witnesses | `WitnessRecord` — witnessed with named people, or **"nobody witnessed it", recorded as a statement with an author**, not a blank |
| Injuries | `InjuryMap` over `BODY_REGIONS`, a real body map including the pressure-ulcer sites (sacrum, heels) |
| What was done | `ImmediateResponse.immediateAction`, free text |
| Emergency services | Asked explicitly — called (with service and outcome) or not called |
| Description | Free text, the reporter's own words |

**Media or photo attachment: none.** I searched the whole module and the type for
photo/image/attachment/upload/file/media/camera. The only hits are the *resident's*
photo in the subject strip and a `@media` CSS query. **There is no evidence
anywhere.**

**Urgency flag: none.** There is `severity`, which is a clinical harm level, not an
"attend to this now" flag.

**Telling the family: not asked at the point of report, deliberately.** The type has
`response.gp` and `response.family` as `ContactState`, and the form sets **both to
`{ kind: 'not_yet' }`** with a comment explaining why: that is what is true the
moment a report is written, it is the unfinished member, and it can only ever
under-claim. Emergency services *are* asked, because their record has two members
and neither is an absence.

**Export or download: none.** No export, download, PDF, CSV or print anywhere in the
module.

**Acknowledge and close.** A senior carer may acknowledge (`your_list`); a care
worker may not. **Neither role may close an incident** — "A manager closes an
incident." Neither may decide the CQC notification.

> **The Admin build's `Incident` type is 571 lines to this one's 442, and the extra
> members are exactly the gaps above.** It has `IncidentEvidence`
> (`kind: 'photo' | 'video'`, `fileName`, `size`, `url`, `attached`), `IncidentUrgency`
> (`ordinary` / `needs_attention_now` with a reason and wording / `stood_down`),
> `FamilyTold` (`not_decided` / `should_be_told` / `not_to_be_told` with a reason) and
> `IncidentEdited`. **None of these exists here.** Adding them is a fixture-type
> change, which `CLAUDE.md` §9 makes a stop-and-ask.

### Terminology

**Hardcoded. There is no terminology configuration of any kind.** I searched for
terminology/personWord/residentWord/serviceUser/noun-config/labelFor and found
nothing.

Scale of the word "resident" in `src/`:

- **296 files** contain it
- **5,293 occurrences** in total
- **2,772** of those in `.tsx` files
- **~246** inside quoted strings in non-test `.tsx` — a rough lower bound on
  *user-visible* text, and it excludes JSX text nodes, so the real figure is higher

It is not only copy. It is in type names (`Resident`, `ResidentId`,
`ResidentScope`), route segments (`/residents/[residentId]`), data attributes
(`data-resident`), test ids, fixture names and function names.

Other words are effectively absent: "patient" appears twice (both inside
*"Outpatient"*), "service user" once (a document title in a fixture), "client" 262
times but **as the data-access client module**, not the noun.

> **This is the largest divergence between the two builds.** If the Admin build has
> made the word configurable, the same organisation will see "resident" here and
> whatever they chose there. Closing it is a cross-cutting rename plus a
> configuration mechanism — a phase of work, not an edit.

### Brand colour

**Fixed in a stylesheet, not configurable.** The palette lives in
`src/styles/tokens.css` as `--purple-900 #1e0059`, `--purple-600 #6935cf`,
`--purple-400`, `--purple-200`, `--purple-50`. `tokens.css` says:

> One palette. No dark mode, no theme switching, no `prefers-color-scheme`.

There is no theme provider, no per-organisation branding, no runtime colour. The
only file that reads colours dynamically is
`src/features/specimens/use-token-colours.ts`, and it *measures* computed values for
the contrast table on the specimens page — it sets nothing.

`check-tokens.mjs` fails the build on any colour literal outside `tokens.css`, so
introducing a configurable colour means changing the token system, which §9 makes a
stop-and-ask.

---

## 4. Permissions, specifically

**Yes, this build has Table 3, and treats it as the authority.** `CLAUDE.md` states
it:

> **The CW PRD's role table (Table 3) is the authority for what these two roles can
> do, in both builds.** Decided 17/09/2026 over the Admin build's permission table,
> whose cells for these roles predate both PRDs and cite no source, and which cannot
> express "assigned residents only", "both shifts must sign" or "acknowledge, a
> manager closes. **This build does not inherit that table with corrected values.**

The table itself is at `docs/CW_PRD.md` §"Table 3". It is implemented in
`src/app/session/capabilities.ts` as `CARE_ACTS` — **30 acts**, each carrying its
PRD row name as `source: row('…')`, a grant or refusal per role, the refusal wording,
a confirmation requirement and what completion means.

Three structural points the other session should not miss:

1. **No screen compares a role name.** Screens call `viewer.ask(act, residentId)`
   and render the `Answer`. `check-role-names.mjs` fails the build if any file
   outside the role table names or compares a role — it read 397 files at this
   commit. A disputed cell is therefore **one edit**.
2. **A grant carries a reach, not a boolean**: `your_list`, `every_resident`, or
   `not_stated_beyond_your_list` — the PRD's silence, drawn as a question rather
   than resolved.
3. **`capabilities.test.ts` writes Table 3 out by hand** and holds the declaration
   against it, deliberately not derived from the code: _"A test that iterates the
   declaration and checks each cell against itself agrees with whatever the
   declaration says, including a wrong cell."_

**The two you asked about:**

- **Care plans — read-only for both roles.** `write_care_plan` is `mayNot` for
  *both*: _"A manager writes and finalises the care plan."_ The PRD row is
  "Care Plan — view". CPLN-01 asks for this in as many words ("No Edit button, no
  Finalise button, no PIN entry for care workers"), and `DEPARTURES.md` records that
  the build once drew an Edit control anyway and it was removed.
- **Risk assessments — a care worker may read only; a senior carer may score.**
  `score_risk_assessment`: care worker `mayNot('Scoring a risk assessment is for a
  senior carer.')`, senior carer `may('your_list')`, confirmed with the medication
  PIN. A care worker sees all nine templates and their levels and has no scoring
  control.

**So: behaviour matches Table 3 on both counts.** A care worker cannot write to
either.

One thing to flag, because it will look like a contradiction: **a refusal is no
longer drawn.** On 19/09/2026 the design owner had every unavailable control and
every "this build cannot" line removed. `ActPoint` now renders *only* the PRD's open
question; for a refusal it renders nothing. The role table is unchanged and still
asked — the answer now decides **whether** something is drawn rather than **how**.
`DEPARTURES.md` §"Controls that refuse…" has the reasoning, and notes that
**`CLAUDE.md` §6 still describes the old rule and now overstates what the build
does** — flagged there, not yet reworded, because §9 reserves that wording.

---

## 5. Shared, and duplicated

**No code is shared. Everything is duplicated.**

- **No cross-repo imports.** Nothing under `src/` imports from `../digi-care`,
  `~/Documents` or an `@digi-care/*` package.
- **No shared package.** No dependency in `package.json` names the other build.
- `CLAUDE.md` says `src/data` *"was copied from it"* — copied, not linked.

Measured, for non-test `.ts` under `src/data/` (62 files here):

| | |
|---|---|
| Byte-identical to the Admin build | **26** |
| Present in both but **diverged** | **35** |
| Only in this repo | 1 |

Among `src/data/types/` specifically: **9 identical, 8 diverged** —
including `incident.ts`, `resident.ts`, `document.ts`, `clinical.ts`, `state.ts`,
`team.ts`, `primitives.ts` and `index.ts`.

**The invitation-lifetime example proves the shape of the problem.**
`INVITATION_DAYS = 3` is declared at `src/data/fixtures/invitations.ts:35` in **both**
repositories — the same value at the same path in two files. The note that both
products "read one rule" describes an **agreement about a value**, not a shared
module. If one changes, nothing detects it.

**There is no mechanism that would catch divergence.** No guard in either build
compares the two. `CLAUDE.md` §9 makes "changing fixture facts the Admin build
shares" a stop-and-ask, which is a human instruction, not a check. The 35 already-
diverged files show the instruction alone has not held — though note that divergence
is expected for some of them (the access layer differs legitimately: this build is
client-only Next.js, the other is Vite).

> For the other session: **treat every shared-looking constant as two copies.** The
> safe assumption is that nothing propagates.

---

## 6. What does not exist

Stating these plainly, rather than describing what is nearby:

- **No incident media, photo or video attachment.**
- **No incident urgency flag** (severity is harm, not urgency).
- **No family-notification decision on an incident.**
- **No incident export, download, PDF or print.**
- **No configurable terminology.** The word is "resident", ~5,300 times.
- **No configurable brand colour, theme or per-organisation branding.** One palette,
  no dark mode, stated as a rule.
- **No Reports, Compliance, Settings or Team Management** — absent by decision, not
  stubbed.
- **No backend, database or real authentication.** Sign-in accepts any password
  meeting the rules; any six digits pass the code step.
- **No file storage.** Documents record that a file exists; the viewer shows a
  representative *sample of the type* behind a banner saying so.
- **No deployment configuration or CI in the repository.**
- **No shared code with the Admin build.**

---

## 7. The failing test, as of 03/10/2026

`src/features/medications/mar/mar.test.tsx` →
_"switches to the month without moving the record"_ — `expected 3 to be greater than 6`.

**Cause, confirmed by reading the code and the calendar.** The MAR anchors on the
last date the record holds and clips both views to it (`daysIn()` in
`mar-grid.ts` skips any day outside `[firstDate, lastDate]`). The fixtures are
generated against `now()`, so the record ends today. Today is **Saturday 3 October**:

- Week view = Mon 28/09 → today = **6 columns**
- Month view = 01/10 → today = **3 columns**

The test asserts the month shows *more* columns than the week. That holds for most of
a month and **is false on days 1–7**, when the week straddles the month boundary and
the month-to-date is shorter.

**Nothing is wrong with the product.** The chart is behaving correctly; the *test*
carries a date-dependent assumption. It is the §8 "a date written into a test is true
for one day" family, in a subtler form — no date is written down, the assumption is.

**It will pass again from the 8th of the month and fail again on the 1st**, because
month-to-date exceeds any week-to-date once past day 7. **I did not fix it** — this
audit changes nothing. Whoever picks it up should note that `npm run verify` fails at
the `test` stage on the first week of any month.

---

## 8. What I could not determine, and why

1. **Whether this is deployed, and where.** No deployment config, CI, or URL exists
   in the repository. Absence of configuration is not absence of a deployment —
   hosting can be set up outside a repo. **Ask the person who opens the site.** I
   deliberately did not infer a URL.

2. ~~**Whether the Admin build's terminology work is actually finished**, or what word
   or mechanism it chose.~~ **Answered by the design owner, 03/10/2026: it is finished
   and live, nine terms in six forms each.** So the mechanism exists and this build has
   none — "resident" is written out roughly 5,293 times across 296 files here, with no
   terminology configuration of any kind. That is the gap, and its size is now known
   rather than estimated. It is not scheduled, and nothing in the current phase
   touches it.

3. **Whether the 35 diverged `src/data` files are divergences that matter.** I
   counted them and listed the types; I did not diff each one to separate legitimate
   platform differences (the access layer must differ) from facts about the home that
   have silently drifted apart. **That diff is worth doing before any work that
   depends on the two agreeing**, and it is a few hours.

4. **Whether Table 3 as implemented matches the PRD document today.** I confirmed the
   mechanism — 30 acts, each citing a row, held by a hand-written test. I did not
   re-read all 309 lines of `docs/CW_PRD.md` and check each cell against
   `capabilities.test.ts`. The test exists precisely to make that check cheap; it has
   not been re-run against a fresh reading of the document in this audit.

5. ~~**Whether the Admin build's permission table still contradicts Table 3.**~~
   **Answered by the design owner, 03/10/2026: the Admin's table was corrected on
   02/10 on four rows, and two rows remain divergent.** So the 17/09/2026 decision was
   carried out in part. The two outstanding rows are the live question, and they are a
   question for the Admin build rather than for this one — Table 3 is the authority
   here and `capabilities.ts` already holds it, so nothing in this build changes
   whichever way they settle.

6. **How much of the ~5,300 "resident" occurrences are user-visible.** My ~246 figure
   counts quoted strings in non-test `.tsx` and misses JSX text nodes, which is the
   commonest way copy appears here. It is a floor, not an estimate. A real count needs
   a parser, not a grep.

7. **What the seven-state review has actually covered.** `CLAUDE.md` §10 requires every
   screen to be reviewed in seven states, both roles, two widths, in colour and
   greyscale. There is no artefact recording which screens have passed that, so I
   cannot say how much of the build has been through it.

8. **Whether `PROGRESS.md` and `DEPARTURES.md` are current.** They are long and
   detailed and were appended to as recently as this commit, but an audit of 951 + 456
   lines against the code was out of scope. Both are the record of *why*, and a prompt
   that contradicts them will be contradicting a decision somebody made for a reason.
