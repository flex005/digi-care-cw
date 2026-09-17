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
- **Amber is for findings, never for a gap or a notice.** The PRD's amber dot on a profile tab for "GP not recorded" or a risk never assessed (RES-03) is words on the tab, hatched where they name a gap (see Resident record, below). A PRN administration on the MAR (MED-04) is not amber: it is a recorded dose. Partial attendance on an activity card (ACT-01) renders as two facts, the attendance recorded and the remainder not recorded, rather than one amber card. A goal's "Not yet asked" (GOAL-02) is the hatch. An escalated omission (MED-01) is two facts, not one amber, hatched, dashed pill.
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

## Care notes (Phase 3)

- **A flag is placed by the note's author, as they write it** (CN-02's toggle, CN-01's "flagging sends push to Senior on duty", and the cross-portal line). Table 19's "Your care note flagged by a senior" describes the other model and is not followed; its "Your flagged note reviewed" is, as a line saying nobody is notified. Recorded under Rulings above since the phase plan, and settled here.
- **A flag carries why, and a review carries what was done**, added to the shared type in both builds (CN-02 "Why are you flagging this?", CN-01 "Action taken?"). The reason is written or not given, and "No reason given" is stated, never an empty line. The outcome is one of four, with "Other" requiring words. Both are what somebody said: choosing "Incident raised" or "Care plan updated" raises nothing and edits nothing. Where that would be believed, the screen says so: "No incident is created here: this records that one was raised."
- **Only the author corrects a note, both roles** (the CW PRD says only that a note cannot be edited). A correction is a second note linked both ways; the original stays. The Admin build let anyone correct anything, by default rather than by decision. **A senior carer who believes a colleague's note is wrong** is told on the note: "Only C. Nwosu, who wrote it, can correct it. If you believe it is wrong, speak to C. Nwosu, or write your own note saying what you found", with a link to write one. They cannot flag somebody else's note under the flag model above. This is the first act in the role table whose source is a departure rather than a PRD row.
- **Voice-to-text is refused, not left unbuilt** (CN-02's mic button). The browser's built-in speech API sends the audio to a third party, which is no place for a care note. The button is drawn, disabled, with that sentence. A speech service a care provider could hold is a question for whoever builds the real product.
- **Mood is five words and an explicit "Not recorded"**, where the PRD draws five faces. A face alone is unreadable to a screen reader and ambiguous to everyone else. Nothing is chosen when the form opens, because a pre-chosen mood records one nobody observed.
- **The shift comes from the home's clock when the note is written**, changeable with a required reason (CN-02: "pre-filled from diGi-Time clock-in"). There is no clock-in to read.
- **Drafts are kept for the session, automatically, and said on return** ("Draft from 20:14 kept for this session."), with no dialog on navigating away and no "Save as draft" link (CN-02). Nothing is lost by leaving, so a dialog would guard nothing and teach people to dismiss dialogs. A draft is destroyed on sign-out and listed among what would go.
- **Phrase chips go in at the cursor** (CN-02), and are openers, never findings ("Ate ", "Declined "), as in the Admin build.
- **No goal-progress prompt until Phase 7** (CN-02). A prompt that links nothing would claim a link.
- **"Your notes", and no "By author" view or colleague picker** (CN-01). Reading a colleague's notes by their name is the blame the scope rule exists to stop, and a care worker has no reason to read by author that is not that.
- **"7 flagged notes, across your 4 residents", with the oldest wait**, not "7, of 11,205 on record" (CN-01). A ratio against every note ever written is a figure nobody acts on; the denominator that matters is how many people it concerns. It is the screen's one dark card.
- **Mark reviewed is drawn for a senior carer on each flagged row; a care worker gets one line at the head of the queue**, not a disabled button on every row (CN-01: "visible ONLY to Senior Carers").
- **A review can be undone for the rest of the session** by whoever recorded it. A mis-click that silently removed a request for help would be worse than an undo that expires.
- **Nobody is notified of a flag or a review**, and the screen says so at both acts (CN-01, CN-02 cross-portal pushes).

## Questions for the PRD's author

Not gaps in the build: places where the CW PRD's role table grants an act and does not say for which residents. Table 3's first row gives a care worker "assigned only" residents and "Care Notes — write" says "Assigned residents"; the rows below say only "Can". The build does not choose. Each act answers `not_stated` for a care worker (`capabilities.ts`), and a screen that reaches one draws the question at the act rather than a yes or a no.

- **Record a dose given, not given or PRN** (Medications — record Given/Not Given/PRN: "Can (PIN required)"). For residents not on the care worker's list, as a round covers a floor rather than a list?
- **Report an incident** (Incidents — report: "Can (any time)", "Any staff member"). About any resident the care worker witnesses, or only their own?
- **Add a goal progress note** (Goals — add progress note: "Can", "Both roles").
- **Record activity attendance** (Activities — record attendance: "Can"). A session is for the home; is attendance recordable for everyone at it?
- **Update a resident's handover status** (HO-01, where both roles update the board). The board is the home's; is a care worker's status limited to their list?

For a senior carer, "Can" reaches the whole home without a question: Table 3's first row gives a senior carer every resident, so there is no narrower list to be silent about.

**One row contradicts another, and is left as written until Phase 4.** "Medications — countersign controlled drugs: Both must be Senior+" says the first signer of a controlled drug is a senior carer; "Medications — record Given/Not Given/PRN" lets a care worker record a dose, controlled drugs not excepted. It is for whoever wrote the table to settle.

## Authentication (Phase 1)

- **"Email or password not recognised", never which** (AUTH-04). The same words for an unknown address and a refused password. **A deliberate divergence from the Admin build**, whose sign-in says "No account here uses that address": telling somebody guessing that an address is real is what the PRD's wording prevents.
- **A password is refused when it breaks the account's own rules**, and only then. Nothing stores a password, so none is checked against a record; one nobody could have set is a real refusal, and it makes "not recognised" and the five-attempt lock reachable honestly. The lock is fifteen minutes on the real clock. The PRD's email alert and the Admin's "account temporarily locked" are not sent, and the screen says so.
- **Ten characters, where the Admin build asks for twelve.** Each follows its own PRD. One account system should have one policy; it is recorded here to be settled rather than chosen silently.
- **Any six digits pass a code** (AUTH-03, AUTH-05), as in the Admin build, because accepting one particular code would be a check that looks real and is not. The screen says so first. The PRD's "after 5 wrong attempts, resend activates immediately" cannot be reached, and is not drawn.
- **Invitations last 72 hours in both builds' fixtures**, where they lasted seven days. An invitation is sent from one product and accepted in the other, so both read one constant. Invitations are dated, so 72 hours is three days from the day sent.
- **The existing-account invitation is not drawn** (AUTH-01: "the link logs them in and adds the new site"). No fixture holds somebody invited to a second home, so the branch could not be reached.
- **The invitation email is drawn, never sent**, and an Invitations list stands in for the inbox as the way to reach it.
- **The name on account setup is shown, not editable** (AUTH-02). A staff member's name is the team record's, changed by a manager; a field that accepted a correction and kept none would be a control that does nothing.
- **Setting up an account is real for the session.** Access is granted on the team record in memory, and the chosen medication PIN is held, so the person can verify and sign in. Signing out discards both, and the sign-out screen lists the PIN among what would go.
- **The medication PIN cannot be checked against a birth year** (AUTH-02). No staff date of birth is held, and the screen says so rather than showing the rule as met.
- **The password strength bar is "N of 5 rules met"** with every rule visible from the start, as in the Admin build.
- **Choosing a home shows name, role, residents and timezone** (AUTH-07); no home's address and no last visit is held. **Nothing remembers the choice**, and the screen says so.
- **Biometric sign-in and shared-device mode are stated unavailable** at phone width (AUTH-06), not drawn.
- **The last forgot-password screen does not say the password was updated** (AUTH-08), because nothing was: it says any password meeting the rules signs in. No reset or confirmation email is sent, no session is ended, and each screen says so.
- **A session ends after twelve hours of inactivity** (AUTH-09, web), where the Admin build uses eight. `?timeout=<minutes>` shortens it for review. **No draft is recovered on the next sign-in**, because nothing survives a sign-out; the signed-out screen says the work is gone.
- **Terms and privacy links are not drawn**: the notices are not written for this build, and the screen says so.

## Resident record (Phase 2)

- **A tab names its gap in words, where the PRD draws an amber dot** (RES-03). "Consent · 3 of 8 never sought", "Risk Assessments · 4 of 9 never done", "General Information · GP not recorded". A dot is colour alone and says a tab has a problem without saying which. A gap is hatched; a risk assessment past its review date is a finding, in the caution ink ("2 of 9 overdue"). Only the three tabs the PRD marks carry a note, and each count is the one the tab itself states, from one function.
- **The count carries its denominator**, "3 of 8", where the approved wording was "never sought": no figure stands alone. Counted over what the home asks, so a template or consent type the home has stopped asking is not reported as a gap.
- **A resident who is not on a care worker's list does not render** (RES-01 says only "assigned residents only", and is silent on an address typed or followed). The screen names them, "Doris Kavanagh is not on your list.", and shows nothing of the record. It never says or implies the record does not exist, and it is neither hatched nor caution: nothing is missing and nothing is wrong.
- **A care worker nobody has given a list sees that stated, hatched**, on the residents list and on any record they open, rather than an empty table that reads as a home with nobody in it.
- **The figures are counted over the viewer's list, and say so** (RES-01): "of your 4 residents" with "Counted over your list, not the home's." beneath. A senior carer's read "of 28 residents at Rosewood Court". The Residents card reads "4 of 28 residents at Rosewood Court" for a care worker.
- **Critical gaps reads "18 of 28 residents"** (RES-01: "Critical gaps (18)").
- **The dark card is "No care note in 48 hours"**, and its button sorts the list by oldest care note, which is what the PRD's sub-text asks the reader to do. Somebody admitted under 48 hours ago leaves that figure's denominator, and the line beneath says who and why.
- **"Last 30 days" is not drawn** (RES-01's third dropdown). **The PRD does not say thirty days of what**: nothing in the list or its figures is counted over a period once the month-on-month changes are refused, and the Admin build's period control set how far back those changes looked. It is recorded as undefined in the PRD, a question for whoever wrote it, not as a feature waiting to be built.
- **The three record views are filter pills, with a mark on the chosen one** (RES-01's "tab filters"). A tab or a segmented control would say they are different presentations or different pages; they narrow one list.
- **All eleven tabs show for both roles, in one row that scrolls at both widths**, with the tab you are on scrolled into view (RES-03). Care Notes, Medications and Goals open to one line naming the phase that builds them, rather than being disabled.
- **Every act the role table names on these tabs is drawn at the head of its tab, answered by the table**: Edit profile and Edit care plan, refused for both roles with the table's reason; Score an assessment, Record a consent decision and Upload a document, live for a senior carer with a line saying which phase builds them, and refused for a care worker with the table's reason. One per tab, not one per row: a refusal repeated down a list is noise.
- **The head of the record stays mounted across tabs and is not sticky** (RES-02: "persistent across all tabs"). Nothing on these tabs writes, and a head this tall pinned to the top would leave a phone a few lines of record. A write surface in a later phase carries its own subject header (CLAUDE.md §2).
- **The next-of-kin call button is drawn with its line**, "Calling is not built: this is a design specification." (RES-02: tap-to-call). The number is part of the specification a developer will wire up; a button that silently did nothing would not be.
- **"No known allergies" is a recorded negative, not grey** (RES-02). Grey is the unrecorded treatment; a recorded "none known" is drawn as a settled record with who recorded it and when, as in the Admin build.
- **The risk flags carry no coloured edge.** The Admin build's cards had a bar in the status colour; the caution fill never marks a state here, so a flag is the status tint with its answer in the status ink.
- **The medication due card says what the figure is out of**: "1 of 4 medicines prescribed for Emmanuel" (RES-02 "1 due at 20:00 BST"). It is the head's one dark card.

## Figures refused

Both are refused on the screen, in one line where the figure would have been, rather than left as an empty space. The line gives the standing reason and no number: a refusal whose reason quotes a count is false the day the count moves.

- **No combined "Overdue now" figure** (DASH-01, KPI 1, "32 things, across 28 residents"). It adds units that are not the same: a dose an hour late and a review four hundred days late count one each. Its denominator is false: a handover belongs to a shift, not to a resident, so "across 28 residents" is untrue of one of its three terms. And for a care worker most of it is work they cannot act on, since a review is a senior carer's act. **The counts are shown separately instead, each with its own denominator**: doses past their window, reviews past their date, handovers never countersigned. That is what a reader acts on anyway.
- **No month-on-month change on the residents list** (RES-01: "-3 this month", "No change this month", "-4 this month"). The Admin build reconstructs last month from the dates on records, and here that would invent three things: residents who have left, since the fixtures hold no discharges or deaths, so "no change" counts admissions only and **the figure is wrong in the same direction every time**; a care worker's list as it stood a month ago, since only the current assignment is kept, so a resident given to somebody this week would read as a change in the home; and records that were later withdrawn, since the reconstruction assumes nothing is ever un-recorded. The first decides it. The cards show the present figure with its denominator and no change line.

## Accessibility

- **The caution fill stays below the 3:1 WCAG 1.4.11 asks of a non-text indicator, deliberately.** `--status-caution` is `#f07d13`: 2.75:1 on the surface, 2.54:1 on the page, 2.38:1 on `--purple-50`. A darker value (`#d26b05`, 3.11:1 at worst) was measured and declined. An orange dot or bar therefore carries no meaning on its own, and that is acceptable only because **no caution state in this build is carried by colour alone: every one names itself in words inside the coloured element.** The rule was three carriers, and the colour was never doing the work alone. It is held by construction rather than by this sentence: only `Toast` may draw the fill, and it renders its required title inside the coloured edge and refuses an empty one (the status pill uses the caution ink and tint, never the fill), and `scripts/check-caution-carriers.mjs` fails the build if the fill appears anywhere else. **What the guard cannot hold is whether the words name the state**; that is checked in review.
- **The positive fill was darkened to pass** (from `#46bc4a`, 2.46:1 on the surface and 2.13:1 on `--purple-50`, to `#1b9c28`, 3.60:1 and 3.12:1), with hue held and its ink and tint unchanged.

## This build's own additions

- **Specimens**, under Design reference in the navigation: every token, primitive and evidence state, rendered by the components the screens use. The source for the Figma library. Not in the PRD.
- **The compact layout runs below 1024px**, so a tablet held upright gets the bottom tab bar. The PRD asks for web and mobile without a breakpoint.
- **"Who would you like to sign in as?"** under the sign-in form fills in an address and a password that meets the rules, labelled as a demonstration: the only way to see the product as each role.

## Fixture changes shared with the Admin build

- **Hannah Price, a senior carer, holds an invitation that expired**: nine days old, against invitations good for three. No care worker or senior carer held an expired invitation, so this product's expired state could not be reached. She is added to the team only, never to `carersAndSeniors`, so no seeded record moves.
- **Invitations last three days (72 hours)** rather than seven.

- **Tolu Akinyemi, a senior carer, works at both Rosewood Court and Ashgrove Lodge.** Without it nobody who signs into this product works at two homes, and the site selector (AUTH-07) could not be reached. A senior carer rather than a care worker, because a care worker's assignment can say "every resident at the site", which names no site once there are two. **The Admin build's fixtures do not have this yet**, so its Team screens show Akinyemi at Rosewood only.
