# diGi-Care — handover to a new conversation

Paste this whole file as your first message in the new chat. It is written to be read by Claude, not by you.

---

## Who I am and how I work

I am Frank, a UI designer and product manager in Nigeria. I am not a developer. I build running, UI-only front ends as **design specifications** — they get copied into Figma, and developers build the real frontend and backend from them.

My workflow: I think through decisions with you in chat, you write me a prompt, I paste it into Claude Code in VS Code, Claude Code builds and reports back, I paste its report to you.

**So your job in this conversation is:** read Claude Code's reports, answer the decisions it raises, and write me the next prompt. You do not write code. Keep replies short — what to look at, and anything needing a decision from me. Detail belongs in project files, not in your reply.

Two rules I have had to repeat:
- **One task per prompt.** When I bundle two, the second gets dropped once the first expands.
- **Say which VS Code window a prompt is for.** I have two open.

---

## The two products

**diGi-Care** is a care management platform for care homes. It is being built as four separate products, each with its own PRD and UI.

**1. Admin & Manager** — `~/Documents/digi-care`, `github.com/flex005/digi-care`, live at `digi-care-zeta.vercel.app`. Vite + React + React Router + CSS Modules. **Finished.** 1,404 tests. Sixteen original phases plus eight more built against the AM PRD, plus repairs. Do not start new work there.

**2. Care Worker & Senior Carer** — `~/Documents/digi-care-cw`, `github.com/flex005/digi-care-cw`. Next.js App Router + React + TypeScript strict + CSS Modules. **This is the active build.** Phase 6 of 10 is done. 801 tests.

Care Worker PRD is at `docs/CW_PRD.md` in that repo. Marked "Draft — for design and engineering review", no approvers named. It is the authoritative source for what a care worker and a senior carer can do.

**3. Family Portal** and **4. Superadmin** — not started.

The two built products describe the same home, Rosewood Court, and **share fixtures**. A change to shared data means changing both repos. The Care Worker repo can reach `../digi-care` and has done so several times.

---

## The idea the whole thing rests on

**A blank must never be able to mean either "no" or "nobody has looked yet."**

Everything follows from that:

- Unrecorded is its own state with its own treatment — dashed border and a diagonal hatch, never a plain neutral fill.
- A recorded negative looks settled. An unrecorded one looks unfinished.
- Every aggregate carries its denominator. "100% — 2 of 2" is still a figure two records cannot support.
- A claim over a filtered set carries the filter.
- Nothing is green because it happens to be empty.
- Compound states render as separate facts, never one pill meaning two things.
- Every screen names the one fact it exists to surface.

Both repos have a `CLAUDE.md` whose **§8 is a list of standing checks** — around sixty entries, each earned by something going wrong. It is the most transferable thing in the project. Some recurring shapes:

- A green guard tells you what it asked, never what it saw.
- A test can be satisfied by the wreckage of the act it tests.
- An assertion is only evidence to the extent that its reference could have disagreed with it.
- A file can lie about its own identity, and nothing in the code, styling or rendering will show it.
- Count the repairs, not their difficulty — a queue of correct fixes is what a wrong premise looks like from inside.
- A warning attached to one instance does not protect the class.
- Never write down that a check passed before it has.

---

## Where the Care Worker build is

Phases 0–6 are built, committed and pushed:

- **0 Foundation** — Next.js, tokens, primitives, app shell, icon pipeline, specimens page.
- **1 Authentication** — sign-in, email code, home selector, invitation and account setup, forgot password, expiry and sign-out. Nothing authenticates anybody; every screen says so in one line.
- **2 Resident record (read)** — list, header, 11-tab strip, eight read-only tabs.
- **3 Care notes** — list, composer, mark reviewed, corrections, the resident's Care Notes tab.
- **4 Medications** — omissions, round with PIN, controlled drug register, MAR chart. Then a second pass: a dose cannot be recorded before its window opens, and the controlled drug register quotes MED-03's silence about how old a dose may be and still take a second signature.
- **5 Handover** — the shift board for every resident at the home, four status groups, recording a status, the dual signature under the medication PIN, and earlier handovers still missing one.
- **6 Incidents** — the log with its two findings, and the report form (INC-02 and INC-03 on one screen) with the body map, the three injury states and the harm scale.

Remaining: **7 Goals and Activities · 8 Senior carer records · 9 Dashboard · 10 Profile and restricted access.**

The dashboard is last because every figure on it points into an earlier module.

Mobile is not a phase. Every screen ships with both layouts and is checked at 1440 and 390.

---

## The visual direction

Adapted from a finance dashboard reference, deliberately different from the Admin build's denser desk-bound look.

- **All chrome is fully rounded** — pill radius on the top bar, the icon rail's two groups, and every rail button. This is the most distinctive thing about it.
- Cards float on a grey page (`#EEF1F7`), white, 28px radius, soft two-layer shadow, no border, 22px padding.
- Navigation is a pill of tabs in the top bar; an icon-only rail on the left in two grouped pills. On mobile the rail becomes bottom tabs.
- Cards showing a subset of something larger have a small circular expand button. Cards that are the whole thing do not.
- The page head is personal — greeting, first name, shift, their list.
- One dark card per screen, in `--purple-900`, for the thing to act on now.

**Three things deliberately not carried from the reference:** hatching is never decoration, no figure stands alone without its denominator, and nothing is green for being empty.

---

## Decisions already made — do not reopen without a reason

**Scope:** Care Home only. The PRD's four other care settings are out. One responsive build, desktop-first. Biometric, GPS check-in and shared-device mode are stated as unavailable rather than drawn.

**Roles:** Care Worker and Senior Carer. The CW PRD's role table is authoritative. Role rules live in one file, `capabilities.ts`, keyed per act rather than per module, each act carrying a **reach** (your residents / every resident / no resident / not stated), a confirmation, a completion, and a named source. A guard fails the build if any screen names a role.

**Assignment is scope, never blame.** "4 of your 9 residents", and "counted over your list, not the home's". A missing record never becomes a mark against whoever was assigned.

**"Not stated"** is a real member: where the PRD is silent, the screen raises the question rather than guessing.

**Stubs:** a control that does nothing says so in one short line at the point of the act, never a paragraph. The test is the §8 one — would somebody skip a real-world action because they think this one happened? Voice-to-text is refused on the ground that the browser's speech API sends audio to a third party.

**Contrast:** positive fill was darkened to `#1B9C28`. Caution stays `#F07D13` at 2.75:1, below the 3:1 a coloured shape needs — accepted because every caution state names itself in words, with a guard enforcing it.

**Figma export constraints are build rules, not later repairs:** flexbox over CSS Grid, the hatch as a CSS `repeating-linear-gradient` and never an SVG pattern, and the five copied static Manrope files with plain `@font-face` — never `next/font` or `@fontsource`.

**Client-only rendering:** the fixtures are built against a moment, so a server rendering at a different one produces two records of one fact. Guards enforce it.

---

## Open questions I have not answered

- **Controlled drug contradiction.** One row of the PRD's Table 3 lets a care worker record a dose; another requires both controlled-drug signers to be senior carers. Left as written, drawn as a question at the act. On the 20:00 round a care worker sees all four of their residents blocked — the contradiction's cost made visible.
- **Five "Can" rows** give a care worker an act without saying for which residents. Recorded in `docs/DEPARTURES.md` as questions for the PRD's author.
- **Countersigning an old dose.** I ruled it refused past some point, then took the proposal and logged the silence instead of picking a window: MED-03 says who signs and in what order and nothing about when, so the register quotes that at the act and every dose stays countersignable at any age. The measurements are in `PROGRESS.md` — at Rosewood, 89 doses on the register wait for a second signature, the oldest 30 days, and **no candidate window drawn from the register's own logic leaves more than 2 of them countersignable**. Still mine to settle.
- **Whether a care worker may report an incident about a resident off their list.** Same family as the five "Can" rows, and now visible on a screen: the report form's submit is unavailable with the question beside it.
- **Organisation self-registration.** The AM PRD says Radiant's Superadmin creates the organisation and invites the first Admin, so there is no registration link. I said I would verify whether that model has changed. Unresolved.

---

## Known defects in the Admin build, recorded and not fixed

Do not fix these without me saying so — that build is finished.

- Typing a name in the residents search never narrows the list. It only takes effect when a filter or sort also changes, so it looks intermittent.
- After changing a home's name or timezone in Settings and signing out, the next sign-in still uses the changed values for clinical times while the screens show the originals.

Both were found in a list of ESLint warnings nobody read. The Care Worker build now runs `--max-warnings 0`.

---

## What good work looks like here

Claude Code on this project is unusually rigorous and its reports are long. Things that have repeatedly mattered:

- **Mutation-test every new guard before trusting it.** Several passed while asserting nothing.
- **Look at screenshots.** A value can be in the DOM and painted over; a card can be correct and full-width; a link can exist and be invisible. Tests found none of those.
- **A report is a claim.** I have confirmed work as done on a report three times and been wrong. Ask what backs a claim before agreeing with it.
- **When a fix chain gets long, question the premise.** Six correct repairs in a row on a wrong premise cost a whole afternoon once.

My part: I approve or refuse, and I decide the product questions. Push back on me when I am wrong — it has been useful more than once, particularly when I bundled two tasks, invented a scope Claude Code never proposed, or agreed with an unverified reading.

---

## Exactly where we stopped

**Phase 6 is built, committed and pushed** in the Care Worker repo. The Admin repo is untouched since its own last commit: nothing in Phases 5 or 6 changed shared data, and the one fixture change that did — see below — was deliberately not synced.

What the last three prompts settled, so nobody reopens them:

1. **A dose cannot be recorded before its window opens.** Neither Given nor Not given; the line names the state, the hour and the reason. Recording *late* stays open. The hatch begins where the window opens: a dose that is not due yet is not a dose nobody has recorded.
2. **Countersigning is not bounded by a window.** MED-03's silence is quoted at the act instead, and every dose stays countersignable whatever its age. Still my decision to make; the measurements are in `PROGRESS.md`.
3. **One fixture moved, in the Care Worker repo only.** The controlled drug the register has never counted is no longer among the doses a round in progress has already signed for — without that, the opening-balance flow could not be reached at any hour on any day. Not synced to the Admin build, whose round does not ask for an opening count.
4. **Phase 5, Handover.** The board is the home's, not the viewer's list; what is asked per resident is the act, so a care worker updating somebody off their list draws the PRD's question at the control.
5. **Phase 6, Incidents.** The log's two findings carry their own denominators and are never summed. Acknowledge, close and the CQC decision are drawn once at the head with the role table's words; acknowledging is live per row for a senior carer. The report form asks one question the CW PRD does not — whether emergency services were called — because that record has two members and neither is an absence.

Also done in the same pass: `agentRules: false` in `next.config.ts`, because `next dev` was appending a Next.js block to `CLAUDE.md` on every start.

**The next phase is 7, Goals and Activities.** Nothing is pending from me, so the next prompt is a phase brief rather than an answer.

## Keeping this file current

Save this in the repo at `docs/HANDOVER.md`. Revise it every few phases rather than letting it go stale — documents drifting out of date has been a recurring defect on this project, and it would be a poor one to repeat in the handover itself.
