# Departures from the Care Worker PRD

Where this build does something other than `docs/CW_PRD.md` says, it is written here with the reason. Each was decided, not missed. A developer reading a screen that disagrees with the PRD should find it here; if it is not here, the screen is wrong.

## Scope

- **Care Home only.** The PRD's Hospital (Acute and Community), Domiciliary Care and Supported Living variations (rows 10b–10d, 13a, 15a–15b, 16a, 20a) are not built.
- **Biometric sign-in, GPS check-in and shared-device mode are stated as unavailable, not drawn** (AUTH-06, PROF-01 device settings). They depend on a device and a service this build does not have, and a drawn toggle would imply a behaviour nothing performs.
- **Reports (RPT-01) is not built.** Neither role has access. The navigation holds no Reports item, and its address shows a no-access page.

## Decisions carried from the Admin & Manager build

The two products describe one home. Where the Admin build already decided something the PRD asks for differently, this build follows the Admin build, for the Admin build's reasons.

- **Eight consent types, the fixtures' eight** (CON-01). The PRD lists Medical Treatment, Family Portal Access, Photography, Sharing information with GP, Sharing information with social care, Financial decisions, Research participation, and Recording and monitoring. The fixtures hold Care and Support, Medication Administration, Photography and Video, Data Sharing, Family Portal Access, Research and Audit, Medical Treatment, and Electronic Records. Four names overlap. **The consent list is a fact about the home rather than a screen decision**, and the manager screens already show these eight; a care worker screen showing a different eight would leave a developer to work out which is true.
- **The password strength bar reads "N of 5 rules met"**, not Weak/Fair/Strong in red, amber and green (AUTH-02). Traffic-light colours are for findings, and "strong" is a claim about security nothing in this build can make.
- **The active sessions list has one row: this session** (PROF-01, AUTH-09). A list of other devices would be invented records.
- **No confirmation claims anybody was notified.** "Incident reported. Your manager has been notified." (INC-03) and every push the PRD describes are replaced by a statement that nothing was sent, at the point of the act. Somebody who believes the manager was told may not telephone the manager.
- **Amber is for findings, never for a gap or a notice.** The PRD's amber dot on a profile tab for "GP not recorded" or a risk never assessed (RES-03) is the hatch. A PRN administration on the MAR (MED-04) is not amber: it is a recorded dose. Partial attendance on an activity card (ACT-01) renders as two facts, the attendance recorded and the remainder not recorded, rather than one amber card. A goal's "Not yet asked" (GOAL-02) is the hatch. An escalated omission (MED-01) is two facts, not one amber, hatched, dashed pill.
- **"No care note in 48h" at zero is a plain zero** (RES-01). The PRD hatches it. A zero there says every resident has a note, and a hatch would claim a gap the record says is not there.
- **No draft survives a sign-out** (AUTH-09, CN-02). Nothing in this build persists outside the tab, and record data is never written to browser storage, so the "unsaved care note" recovery banner on the next login has nothing to recover.
- **Round times are read-only** (DASH-01a says "configured by Admin"). Every medication record was produced against them.

## Rulings on the PRD

- **One straight bar per round, not a ring** (DASH-01, "Rounds today"). The hatch has to survive a Figma import, and a CSS gradient cannot follow a curve: the Admin build's ring tracks arrived blank. A ring whose meaning lives in a hatch that cannot be exported only works in the running build, and the running build is not the deliverable.
- **Start review and Re-score do not render for a care worker** (DASH-01 "Already late"). Neither role-table row lets a care worker do either, and a button that refuses on every row of a list is noise.
- **One harm vocabulary throughout**: No harm, Low harm, Moderate harm, Severe harm. The PRD's incident list badge "HIGH HARM" (INC-01) is not used; it is not one of the four the form records.
- **A care note's flag is placed by its author** (CN-02). The notifications table's "Your care note flagged by a senior" describes a different model and is not followed.
- **The medication PIN is called the medication PIN, and it also signs a handover and a risk assessment.** The PRD says the PIN is "used ONLY for medication confirmation" (AUTH-02) and then asks for it to sign a handover (HO-01) and a risk assessment (RA-02). Every screen that asks for it says what it is signing.
- **Add interim stays visible on Medications and refuses** (MED tabs), with the role table's reason: only a clinician or a manager adds an interim medication.
- **Pharmacy cycle is left out** of the Medications tabs. Neither role touches it and the PRD specifies no screen for it.
- **Senior carer acts the PRD names without a screen** (acknowledge an incident, record consent, upload a document, create an activity session, conduct a review) **adapt the Admin build's screens for the same acts**, narrowed to what the role table allows. They are the same acts with a narrower permission, and a second design would be two answers to one question.
- **A care worker sees the residents they were given, and that is scope, never blame.** "1 of your 9 residents" states what they can see. The assignment never decides a figure about a person.

## Figures refused

Both are refused on the screen, in one line where the figure would have been, rather than left as an empty space. The line gives the standing reason and no number: a refusal whose reason quotes a count is false the day the count moves.

- **No combined "Overdue now" figure** (DASH-01, KPI 1, "32 things, across 28 residents"). It adds units that are not the same: a dose an hour late and a review four hundred days late count one each. Its denominator is false: a handover belongs to a shift, not to a resident, so "across 28 residents" is untrue of one of its three terms. And for a care worker most of it is work they cannot act on, since a review is a senior carer's act. **The counts are shown separately instead, each with its own denominator**: doses past their window, reviews past their date, handovers never countersigned. That is what a reader acts on anyway.
- **No month-on-month change on the residents list** (RES-01: "-3 this month", "No change this month", "-4 this month"). The Admin build reconstructs last month from the dates on records, and here that would invent three things: residents who have left, since the fixtures hold no discharges or deaths, so "no change" counts admissions only and **the figure is wrong in the same direction every time**; a care worker's list as it stood a month ago, since only the current assignment is kept, so a resident given to somebody this week would read as a change in the home; and records that were later withdrawn, since the reconstruction assumes nothing is ever un-recorded. The first decides it. The cards show the present figure with its denominator and no change line.

## Accessibility

- **The caution fill stays below the 3:1 WCAG 1.4.11 asks of a non-text indicator, deliberately.** `--status-caution` is `#f07d13`: 2.75:1 on the surface, 2.54:1 on the page, 2.38:1 on `--purple-50`. A darker value (`#d26b05`, 3.11:1 at worst) was measured and declined. An orange dot or bar therefore carries no meaning on its own, and that is acceptable only because **no caution state in this build is carried by colour alone: every one names itself in words inside the coloured element.** The rule was three carriers, and the colour was never doing the work alone. It is held by construction rather than by this sentence: only `StatusPill` and `Toast` may draw the fill, both render their required words inside it and refuse empty words, and `scripts/check-caution-carriers.mjs` fails the build if the fill appears anywhere else. **What the guard cannot hold is whether the words name the state**; that is checked in review.
- **The positive fill was darkened to pass** (from `#46bc4a`, 2.46:1 on the surface and 2.13:1 on `--purple-50`, to `#1b9c28`, 3.60:1 and 3.12:1), with hue held and its ink and tint unchanged.

## This build's own additions

- **Specimens**, under Design reference in the navigation: every token, primitive and evidence state, rendered by the components the screens use. The source for the Figma library. Not in the PRD.
- **The compact layout runs below 1024px**, so a tablet held upright gets the bottom tab bar. The PRD asks for web and mobile without a breakpoint.
- **A sign-in stand-in** offers the care workers and senior carers whose access is live, until the authentication screens (AUTH-01 to 09) are built.

## Fixture changes shared with the Admin build

- **Tolu Akinyemi, a senior carer, works at both Rosewood Court and Ashgrove Lodge.** Without it nobody who signs into this product works at two homes, and the site selector (AUTH-07) could not be reached. A senior carer rather than a care worker, because a care worker's assignment can say "every resident at the site", which names no site once there are two. **The Admin build's fixtures do not have this yet**, so its Team screens show Akinyemi at Rosewood only.
