# diGi-Care — Care Worker & Senior Carer PRD v2.0

_Converted from CW_PRD.docx. Source of truth for the Care Worker build._

PRODUCT REQUIREMENT DOCUMENT

diGi-Care

Care Worker & Senior Carer

Web & Mobile  |  Care Home  |  Hospital (Acute & Community)  |  Domiciliary Care  |  Supported Living

UX Flow & Screen Specification  |  v2.0  |  Aligned to diGi-Care Prototype Screens

DOCUMENT PURPOSE

This document defines every screen, UI element, user story, and workflow for the Care Worker and Senior Carer roles in diGi-Care. It covers the complete journey from authentication through to sign-out. Every screen specification is aligned directly to the diGi-Care prototype screenshots. Client-type variations are called out within each section where the experience differs. Cross-portal interaction rows (amber background) show exactly what happens in other portals when a care worker takes an action.

A — Project Information

B — Roles and Permissions

The table below covers every module and action for Care Worker and Senior Carer roles. Anything not listed is not accessible to either role.

C — Full UX Flow: Authentication through Sign-Out

Each numbered row is a screen. Client-type banners show where the experience differs by care setting. Cross-portal rows (amber) show downstream effects on other portals.

D — Notifications

Every notification the Care Worker and Senior Carer receive, the channel, timing, role, and whether it can be disabled.

E — Open Questions

1.  Shared device authentication: does the product need a faster PIN-based login flow after sign-out on a shared device, so the next care worker avoids the full email/password/OTP flow?

2.  Suggested phrases content library: who owns and maintains the category-specific phrase chips in the care note form — Radiant diGilog or the client organisation? Is it configurable per site?

3.  Domiciliary care GPS provider: which geofencing service is used for visit check-ins? This affects accuracy in dense urban areas, cost per visit, and offline behaviour.

4.  Hospital HCA medication access: the spec has HCAs with read-only MAR chart access. Confirm with clinical advisors whether this is appropriate, or whether HCAs should have no access to the Medications tab at all.

5.  Voice-to-text: is this a V1 requirement or V2 enhancement? Native device speech-to-text has accuracy limitations in noisy care environments.


---


## Table 1

| Product Manager | Ezekiel Dada |
| Engineering Lead |  |
| Designer |  |
| Approvers |  |


## Table 2

| Document Name | diGi-Care — Care Worker & Senior Carer PRD |
| Document Type | Product Requirements Document — UX Flow & Screen Specification |
| Version | v2.0 |
| Platform | Web (Chrome, Safari, Edge) + Mobile (iOS and Android) |
| Roles Covered | Care Worker, Senior Carer |
| Roles NOT Covered | Manager, Admin, Superadmin, Family Portal (see separate PRDs) |
| Care Settings | Care Home, Hospital (Acute), Hospital (Community), Domiciliary Care, Supported Living |
| Markets | Nigeria, United Kingdom, South Africa, Uganda, Canada |
| Status | Draft — For Design and Engineering Review |


## Table 3

| Module / Action | Care Worker | Senior Carer | Notes |
| Dashboard — view all residents | Assigned only | All residents | CW scoped to assigned; Senior sees whole site |
| Residents — edit profile | Read only | Read only | Admin and Manager only |
| Care Notes — write | Assigned residents | All residents | — |
| Care Notes — mark flagged reviewed | Cannot | Can | Senior Carer and above only |
| Care Plan — view | Read only | Read only | Manager writes and finalises |
| Handover — sign off | Cannot | Can (both shifts must sign) | Dual signature required |
| Medications — record Given/Not Given/PRN | Can (PIN required) | Can (PIN required) | 4-digit medication PIN |
| Medications — countersign controlled drugs | Cannot | Can (Witness 2, PIN required) | Both must be Senior+ |
| Medications — add interim | Cannot | Cannot | Clinician/Manager only |
| Incidents — report | Can (any time) | Can (any time) | Any staff member |
| Incidents — acknowledge or close | Cannot | Can acknowledge | Manager closes |
| Risk Assessments — score/re-score | Cannot | Can | CW reads only |
| Reviews — conduct | Cannot | Can | Senior and above only |
| Goals — add progress note | Can | Can | Both roles |
| Goals — create or close | Cannot | Cannot | Manager only |
| Activities — record attendance | Can | Can | Both roles |
| Activities — create session | Cannot | Can | Senior and above only |
| Consent — record | Cannot | Can | Senior and above only |
| Documents — upload | Cannot | Can | Senior and above only |
| Compliance and Reports | No access | No access | Manager and above only |
| Settings / Team Management | No access | No access | Admin only |


## Table 4

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**A — AUTHENTICATION**

| 1 | Invitation Email / Subject: 'You've been added to [Organisation Name] on diGi-Care' / Button: Set up your account (primary CTA) / Link valid for 72 hours / Sender: noreply@digicare.com or org whitelabel domain | As a care worker, I receive an email invitation from my Admin so that I can create my account without self-registering. / As a care worker, I see the 72-hour expiry notice so that I know how long I have to accept. | Care workers NEVER self-register. Admin creates the invitation from Settings > Team Management > + Invite Staff Member. / Link is single-use. If expired: Admin resends from the staff member's profile in Team Management. / If care worker already has an account in this organisation: the link logs them in and adds the new site without a new setup flow. / CROSS-PORTAL: when invitation is sent, staff member appears in Team Management with status Invited. | AUTH-01 |
| 2 | Account Setup Screen / Full Name (pre-filled, editable) / Email (pre-filled, read-only, greyed out) / Create Password (masked) / Confirm Password (masked) / Password strength bar: Weak (red) / Fair (amber) / Strong (green) / Info icon: tooltip with requirements / Set 4-digit Medication PIN (masked) / Confirm PIN (masked) / Set Up Account (primary button, disabled until all valid) / Terms and Privacy links | As a care worker, I set a secure password and 4-digit medication PIN so that my account is protected and I can authenticate medication administrations. / As a care worker, I see real-time password strength so that I know when my password meets requirements. | Password: min 10 chars, one uppercase, one number, one special character. / PIN: 4 digits. Cannot be 0000, 1234, or birth year. Used ONLY for medication confirmation, not login. / Strength bar: Weak = red. Fair = amber. Strong = green (all requirements met). / Button disabled until: name not empty, passwords match and meet requirements, PINs match and are 4 digits. / On submit: 6-digit OTP sent to email. | AUTH-02 |
| 3 | OTP Verification Screen / Title: 'Verify your email' / Sub-text: 'We've sent a 6-digit code to [email]. Enter it below.' / 6-digit OTP input (auto-focus) / 10:00 countdown timer / Resend code (link, active after 60s) / Verify (primary button) / Back (link) | As a care worker, I verify my email by entering a 6-digit code so that my identity is confirmed before account activation. / As a care worker, I can request a new code if mine expires so that I am never permanently locked out. | Valid 10 minutes. Resend active after 60 seconds. After 5 wrong attempts: resend activates immediately. / On correct code: account activated, care worker goes to Dashboard for their assigned site. / Mobile: iOS/Android auto-suggest OTP from email notification if both are on the same device. | AUTH-03 |
| 4 | Login — Web / diGi-Care logo / Organisation name (if org-specific URL) / Email input / Password (masked, show/hide toggle) / Log In button / Forgot password link / No registration link | As a care worker, I log in with my email and password so that I access my organisation's records. / As a care worker, I see no registration link so that unauthorised account creation is prevented. | On correct credentials: 6-digit OTP sent to email, OTP screen appears. / Incorrect credentials: 'Email or password not recognised.' No indication of which field. / After 5 failed attempts: locked 15 minutes. Email alert sent. Admin sees 'Account temporarily locked [date]' in staff profile. | AUTH-04 |
| 5 | Login OTP — Web / Title: 'One more step' / Sub-text: 'To keep your account secure, we've sent a 6-digit code to [email].' / 6-digit OTP input, 10:00 timer / Resend code (active after 60s) / Verify button / Use a different account link | As a care worker, I complete OTP on every web login so that my account is secure even if my password is compromised. | Mandatory on every web login. No remember-this-device option. / On mobile with biometric enabled: OTP not required for biometric login (see Screen 6). / On correct OTP: Dashboard for last-used site, or first assigned site on initial login. / If assigned to multiple sites: site selector appears (Screen 7). | AUTH-05 |
| 6 | Login — Mobile App / App splash on open / Email and Password inputs / Log In button / Use Face ID / Fingerprint button (shown only if previously enabled on this device) / Forgot password link / After first login: 'Use Face ID for faster sign-in next time?' Enable / Not now | As a care worker, I log in on my phone using email/password or biometric so that I can access diGi-Care quickly during a shift. / As a care worker on a shared device, I disable biometric so that other care workers cannot access my session. | First login on any new device: always requires email + password + OTP. / Biometric: available after first successful OTP login. Subsequent logins show only the biometric prompt. If biometric fails twice: falls back to full login. / Shared device mode: Settings > Device settings > 'This is a shared device'. Disables biometric, clears session token and all cached resident data on every sign-out. / Mobile session: 30 days with biometric, 24 hours of inactivity without. | AUTH-06 |
| 7 | Site Selector (multi-site users only) / Title: 'Which site are you working at today?' / One card per assigned site: site name, address, role, last visited time / Continue button (activates after selection) / Only shown if assigned to more than one site | As a care worker assigned to multiple sites, I select my current site before the dashboard loads so that I see the correct residents and records. | Skipped if assigned to only one site. Selected site remembered as default. / Site can be switched mid-session from the top navigation site name dropdown without logging out. / Switching sites: interface reloads to the new site's data. Unsaved form entries preserved via local draft storage. | AUTH-07 |
| 8 | Forgot Password / Screen 1: Email input, Send reset link button / Screen 2: Check your email (static) / Screen 3 (via email link): New password, Confirm password, Save / Screen 4: Password updated, Go to login | As a care worker, I reset my password via email so that I can regain access if I forget it. / As a care worker, all my active sessions are terminated on reset so that my account is secured. | Reset link valid 1 hour. / On successful reset: all active sessions terminated. Confirmation email sent. / Medication PIN NOT affected by password reset. PIN changed only from Profile > Change PIN. | AUTH-08 |
| 9 | Session Expiry and Sign Out / Expiry banner (10 min before): 'Your session will expire in 10:00. Tap here to stay signed in.' / Auto sign-out screen: 'You were signed out due to inactivity.' + Log in again button / Draft recovery banner (on next login): 'You have an unsaved care note for [Resident name]. Continue?' Continue / Discard / Sign out: avatar/name menu > Sign out (web) or Settings tab > Sign out (mobile) | As a care worker, I see a warning 10 minutes before my session expires so that I can stay signed in without losing unsaved work. / As a care worker, an unsaved care note draft is recovered on my next login so that no clinical record is lost to a timeout. | Web session: 12 hours of inactivity. Mobile: 24 hours without biometric, 30 days with. / Tapping the banner resets the timer immediately. / Shared device sign-out: session token cleared, cached resident data removed, login screen fresh. / Sign-out from one device does NOT terminate other device sessions. | AUTH-09 |


## Table 5

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**B — DASHBOARD**

| 10 | Dashboard / Site name + date/time header: 'Rosewood Court — 31/08/2026 20:20 BST — 28 residents' / Round time indicator bar: '20:20 Showing the 20:00 round, which is the nearest one running. Real time 22:49.' + 'Use the real time' link (right-aligned, purple) / KPI Card 1 — Overdue now: 32, 'things, across 28 residents — 8 doses · 23 reviews · 1 handover' / KPI Card 2 — Due in the next 2 hours: 29, 'doses, across 22 of 28 residents' / KPI Card 3 — Not written up today: hatched card '1 not written up — nobody has recorded a care note for them today — of 28 residents' / KPI Card 4 — Flagged for your attention: count of notes flagged for senior review / Module completion bars (left panel): Care notes today 27/28, Medication today 125/133, Risk assessments 174/252, Care plan domains 217/280, Consents 182/224, Incidents acknowledged 38/40 (red segment for 2 unacknowledged) / Rounds today (right panel): one ring per round (08:00, 14:00, 18:00, 20:00). Ring fill = recorded. Gap = missing. Sub-text per ring: 'all recorded · [N] members of staff' or '[N] doses with no record · [N] members of staff' or 'due now · [N] doses in its window' / Already late (full width below): tab filters (Everything late [32] / Medication [8] / Reviews [23] / Handovers [1]), list rows: date + time ago / item + resident + room / 'Past its date' red badge + due date / quick action button (Start review / Re-score) | As a care worker, I see at a glance what is overdue, due soon, and which residents have no care note today so that I can prioritise my shift. / As a care worker, I see the module completion bars so that I understand overall record completeness across the site. / As a care worker, I see Already late ordered by age so that I address the most overdue items first. | Standard Care Worker: filtered to assigned residents. Header shows '[N] of [total] residents assigned to you.' / Senior Carer: full site dashboard, all 28 residents. / Round time indicator: only when showing data from a completed round, not live. 'Use the real time' link switches to live data. / Module bars: solid purple = recorded, hatched grey = expected but missing. Incidents acknowledged bar: red segment = unacknowledged incidents (a finding, not missing data). / Already late quick action button: links directly to that specific record. | DASH-01 |

**●  CLIENT TYPE: CARE HOME**

| 10a | Rounds today card prominent (08:00, 14:00, 18:00, 20:00 default). Already late tabs: Medication, Reviews, Handovers. | As a care home care worker, I see medication round rings as my primary operational metric. | Round times configured by Admin in Settings > Medication settings. | DASH-01a |

**●  CLIENT TYPE: HOSPITAL (ACUTE)**

| 10b | Ward round card replaces Rounds today. KPI Card 2: 'Observations due.' Module bars: Clinical notes replaces Care notes. Already late: Observations, Clinical notes, Handovers. | As a hospital HCA, I see ward observations and patient tasks so that I can prioritise patient care. | 'Residents' labelled 'Patients.' HCAs read-only on Medications. | DASH-01b |

**●  CLIENT TYPE: DOMICILIARY CARE**

| 10c | 'My visits today' timeline replaces module bars. Visit cards: client name, address, time, status. 'Overdue now' = missed visits. No round rings. Map view toggle. | As a domiciliary care worker, I see my daily visit schedule as my primary dashboard. | GPS check-in required before visit note. Missed visit: no check-in within 30 min triggers Missed and notifies care coordinator. | DASH-01c |

**●  CLIENT TYPE: SUPPORTED LIVING**

| 10d | Goals and Activities cards above module bars. No round rings if Medications module disabled. | As a supported living care worker, I see Goals and Activities as my primary focus. | Medications module may be inactive if residents self-manage. 'Not written up today' card still shown. | DASH-01d |


## Table 6

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**C — RESIDENTS**

| 11 | Residents List / Title: 'Residents' / Sub-text: 'Sort by oldest care note to find the residents nobody has written up.' / 5 KPI cards: Residents (28, 'No change this month'), Critical gaps (18, '-3 this month'), Reviews overdue or never scheduled (9), No care note in 48h (0, hatched card when zero), Never assessed for falls (3, '-4 this month') / Tab filters: All residents (default) / Any incomplete record / Critical gaps / Search: 'Name or room' (real-time) / Dropdown filters: Any falls risk / Any review status / Last 30 days / Results sub-text: '28 of 28 residents at Rosewood Court, sorted by name, ascending.' / '+ Add resident' (Admin and Manager only, not shown for care workers) / Table: RESIDENT (avatar + name) / ROOM / RISK FLAGS / REVIEW STATUS / LAST CARE NOTE / RECORDS | As a care worker, I see my assigned residents in a list so that I can access each person's record. / As a care worker, I search by name or room so that I find a specific resident immediately. / As a care worker, I see risk flag badges on each row so that I know critical risks before entering a room. | Standard care workers: assigned residents only. Sub-text: '[N] of [total] residents at [site] assigned to you.' / Senior Carers: all residents. / Risk Flags: 'Dysphagia not assessed' (grey outline, dashed), 'ALLERGIES: LATEX' (red filled), 'DNAR IN PLACE' (purple filled). Always shown even if not assessed. / Review Status: 'Reviewed 23/07/2026 next 03/12/2026 · M. Halloran' or 'Never scheduled' (grey outline, dashed — a gap, not neutral). / RECORDS: 'Critical records missing' (red badge) or 'Critical records complete — 6 non-critical gaps' (grey text). | RES-01 |
| 12 | Resident Profile Header (persistent across all tabs) / Breadcrumb: '< All residents' / Avatar + preferred name (large, bold) + full name (smaller) / Room · Born [date] ([age]) · Site [name] / GP pill: 'GP not recorded' (dashed) or GP name (solid) / Next of kin: 'NEXT OF KIN · SON — Sarah Whitcombe · 07646 394898' (tap-to-call phone icon) / RISK FLAGS row — 5 cards, ALWAYS shown: /   FALLS RISK: 'Low' (green, score and assessor date) or 'Not recorded' (hatched grey, dashed) /   ALLERGIES: 'Penicillin' (red, reaction + description) or 'No known allergies' (grey) /   RESUSCITATION: 'DNAR in place' (purple, GP name and date) or 'Not recorded' (hatched) /   END OF LIFE CARE: 'Not applicable' (green) or 'Not recorded' (hatched) /   ISOLATION: 'Not recorded — Nobody has recorded a status' (hatched grey, dashed) / MEDICATION DUE · NEXT 2 HOURS: '1 due at 20:00 BST' — medication name, time window, route, 'controlled drug' red badge / LAST CARE NOTE: excerpt, category, time ago, author, mood badge / CARE PLAN REVIEW: 'Scheduled — due 19/11/2026' | As a care worker, I see all five risk flags immediately on opening a resident's profile so that I know about falls risk, allergies, DNAR, end of life, and isolation before any care task. / As a care worker, I tap the next of kin phone number from the header so that I can call family in an emergency without navigating away. | Profile header is persistent — stays visible regardless of which tab is active. / All 5 risk flag cards are ALWAYS shown. Unrecorded status = hatched grey, dashed border. Absence of a status is a clinical gap, not a blank. / Isolation: 'Not recorded — Nobody has recorded a status' — distinguishes unrecorded from confirmed 'no isolation needed.' / Allergycard: always red text on red background if any allergy is recorded. Sub-text: reaction type and symptoms. / DNAR: sub-text shows GP name and date signed. / Medication due: shows time window, route, 'controlled drug' red badge if applicable. | RES-02 |
| 13 | Resident Profile Tab Strip / Scrollable tab strip below header: / General Information / Needs / Important People / Future Plans / Care Notes / Medications / Risk Assessments / Care Plan / Goals / Consent / Documents / Active tab: purple underline, bold / Amber dot on tab if that tab has a gap or pending issue | As a care worker, I navigate to any section of a resident's record from the tab strip so that I find the information I need without leaving the profile. | Care workers READ-ONLY: General Information, Needs, Important People, Future Plans, Risk Assessments, Care Plan, Consent, Documents. / Care workers WRITE: Care Notes (write own notes), Medications (record administrations), Goals (add progress notes). / Senior Carers additionally: Risk Assessments (score/re-score), Consent (record), Documents (upload), Activities (create). / All 11 tabs visible. No tabs hidden. Distinction is in available actions within each tab. / Amber dot: General Information (GP not recorded), Risk Assessments (overdue or never done), Consent (never sought). | RES-03 |

**●  CLIENT TYPE: HOSPITAL (ACUTE)**

| 13a | Adds MDT tab (read-only for HCA). Header adds: Ward, Bed number, Admission date, Admitting consultant. Risk flags: INFECTION CONTROL replaces END OF LIFE CARE. | As a hospital HCA, I see the patient's ward and clinical context so that I can locate and understand the patient. | 'Residents' = 'Patients.' MDT tab shows latest note from each discipline. | RES-03a |


## Table 7

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**D — CARE NOTES**

| 14 | Care Notes List / Title: 'Care notes' / 4 KPI cards: Notes today (114, 'across 28 residents'), Flagged for review (7, 'of 11,205 on record'), Not written up today (hatched: '1 not written up — nobody has recorded a care note for them today — of 28 residents'), On the record here (11,205, 'written by 9 people') / Tabs: Flagged, not reviewed (default, purple filled) / No note today / By author / By shift / All notes / Flagged list header: '7 flagged and not yet reviewed, across 28 residents at Rosewood Court · oldest first' / Each flagged row: resident name + room (left) / hatched badge 'Flagged, not reviewed — waiting 4 days' (centre) / full note text + category + author initial·surname + date·time + shift (right) / 'Mark reviewed' button (Senior Carer and above only) | As a care worker, I see all flagged notes so that I know which ones need senior attention. / As a care worker, I see which residents have no care note today so that I know who I still need to write up. / As a Senior Carer, I mark flagged notes as reviewed so that the queue stays current. | Not written up today: hatched/dashed card. Even one missing note is a clinical gap. / Flagged row: full note text (not truncated), initial·surname author format. / 'Mark reviewed' visible ONLY to Senior Carers and above. On click: dropdown 'Action taken?' — No further action needed / Care plan updated / Incident raised / Other (free text). Confirming removes the note from the Flagged tab. / CROSS-PORTAL: flagging sends push to Senior on duty. Marking reviewed and selecting 'Care plan updated' sends push to the note's author. | CN-01 |
| 15 | Add Care Note Form / Header: 'Care note for [Resident preferred name]' or resident search picker / CATEGORY: Personal Care / Nutrition and Hydration / Mobility / Medication / Social and Emotional / Health Observation / Behaviour / General / NOTE TEXT: placeholder 'What you found, what you saw, what the resident said.' / Label: 'Written for whoever reads this next: a manager tonight, an inspector in a year.' / Suggested phrases (tappable chips, appear on category selection) / Voice-to-text button (mic icon) / SHIFT: pre-filled from diGi-Time clock-in or manual select / MOOD: 5 face icons (very unhappy to very happy), optional / FLAG FOR REVIEW toggle: when on: 'Why are you flagging this?' (optional) / GOAL PROGRESS prompt (if resident has active goal matching category): '[Resident name] has an active goal: [goal text]. Did this care interaction contribute to that goal?' Yes / No / Submit (primary) / Save as draft (secondary link) | As a care worker, I record a care note using a structured form so that the care record is complete and time-stamped. / As a care worker, I use suggested phrases so that my observations are clearly structured even when I'm in a hurry. / As a care worker, I connect a care note to an active goal so that progress is automatically recorded. | Category required before text area activates. Suggested phrases scroll horizontally. Tapping appends to note at cursor. / Note cannot be edited after submission. No delete option. / On submit: 'Note saved for [Resident name].' Draft: dialog on navigate away, recovered on next visit. / Goal prompt Yes: progress note auto-linked to goal record. / CROSS-PORTAL: Care notes today bar increments immediately. Family Portal: note NOT visible until Manager explicitly marks 'Share with family.' | CN-02 |

**⇄  CROSS-PORTAL: Note flagged for review: Senior on duty receives push notification: '[Care worker name] flagged a care note for [Resident name] for your review.'**


**⇄  CROSS-PORTAL: Senior marks reviewed and selects 'Care plan updated': the note author receives push: 'Your flagged note for [Resident name] has been reviewed. Care plan has been updated.'**


**⇄  CROSS-PORTAL: Family Portal: note does NOT appear until Manager marks it 'Share with family.' Until then family members cannot see it.**


**●  CLIENT TYPE: HOSPITAL (ACUTE)**

| 15a | Form title: 'Clinical note for [Patient preferred name]'. Note type selector: Nursing / HCA / Allied Health. Categories: Nursing Observation / Personal Care / Nutrition and Hydration / Mobility / Pain Assessment / Behaviour / Fluid Balance / Wound Care / Discharge Planning / General. | As a hospital HCA, I record a clinical note using hospital-specific categories so that observations are structured for the clinical setting. | HCA notes automatically flagged to supervising nurse — no manual flag needed. Cannot be countersigned as nursing notes. | CN-02a |

**●  CLIENT TYPE: DOMICILIARY CARE**

| 15b | Header: 'Visit note for [Client name] — [address]'. GPS CHECK-IN required before note can be submitted. Visit tasks checklist (from care plan): checkboxes per task. Concerns toggle: routes to care coordinator. | As a domiciliary care worker, I record a visit note tied to a specific home visit so that the care record shows exactly what happened and where. / I must GPS check in before submitting so that the record is verified in the correct location. | Visit note opens automatically on GPS check-in. Unticked tasks logged as 'not completed.' Cannot check out without submitting the note. | CN-02b |


## Table 8

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**E — HANDOVER**

| 16 | Handover Page / Title: 'Late shift handover' (adapts: Morning / Night) / Sub-text: 'Rosewood Court · 31/08/2026 · handing over to the night shift' / 'This shift at a glance': 'Every resident at this site, whether or not anybody has got to them yet.' / 4 KPI cards: Not reviewed (6, 'of 28 residents living at Rosewood Court — The only figure here you can still change before you sign'), Urgent (2, 'of 22 reviewed this shift'), Needs attention (6, 'of 22'), All well (14, 'of 22') / 'Earlier handovers': 'A handover is complete only when both shifts have signed it.' / Example entry (dashed border, grey — gap state): '30/08/2026, early to late, never countersigned — Handed over by C. Nwosu at 14:05 BST, and never accepted by the late shift. Somebody handed over; nobody recorded receiving it.' / Residents section: tabs Not reviewed [6] (dark filled) / Urgent [2] / Needs attention [6] / All well [14] / Each resident row: avatar + name + room / status badge (hatched = Not reviewed, red = Urgent, amber = Needs attention, green = All well) / time since last care note (for Not reviewed rows) | As a care worker, I read the handover at the start of my shift so that I know the status of every resident from the outgoing team. / As a care worker, I understand that 'Not reviewed' is the only figure I can change before sign-off so that I know my responsibility. | Care workers: can update individual resident statuses and add a handover note. CANNOT sign the handover off — Senior Carer required. / 'never countersigned' entries use the same dashed border as all gap states. / Not reviewed rows: 'No care note recorded for 54 minutes. Last written by S. Patel at 31/08/2026 19:26 BST.' / Tapping a resident row: inline status selector + handover note text. Saves immediately. / Senior Carer: 'Sign handover' button at bottom, PIN confirmation, then: 'Handed over, awaiting countersign.' Incoming Senior must also sign. / CROSS-PORTAL: marking Urgent sends immediate count update and push notification to Senior on duty. 'never countersigned' handover appears in Manager's Already late section. | HO-01 |

**●  CLIENT TYPE: HOSPITAL (ACUTE)**

| 16a | Title: 'Ward handover — [Ward name]'. SBAR structure per patient. HCA fills: Situation + Background. Nurse fills: Assessment + Recommendation. Nurse signs the full handover. | As a hospital HCA, I update Situation and Background for my patients so that the nurse can complete the clinical sections. | HCA handover entries are partial. Nurse sign-off required, not Senior Carer. | HO-01a |


## Table 9

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**F — MEDICATIONS**

| 17 | Medications — Omissions Tab (default) / Title: 'Medications' / 5 tabs: Omissions (active) / Round / Controlled drug register / Pharmacy cycle / Add interim / 4 KPI cards: Doses with no record (hatched: '91 with no record — the window closed and nobody wrote anything — of 1,136 doses due this week'), Escalated (82, 'of 91 with no record'), Not yet escalated (9, 'of 91'), Doses due this week (1,136) / Filters: All / Escalated / Not escalated / Sub-text: '91 doses with no record · oldest first' / Each row: resident name + room (left) / amber badge + warning triangle, hatched, dashed: 'No record, escalated — 08:00, 25/08 · missed 7 days ago' (centre) / medication name + dose + time + route + 'raised [time]' (right) / 'Open MAR' link | As a care worker, I see all doses with no record so that I can identify omissions and know which ones are escalated. / As a care worker, I tap 'Open MAR' to view the full medication record for a resident. | Escalated = amber warning badge, hatched/dashed border. Badge text: round time, date missed, time ago. / Care workers can VIEW omissions. Cannot close or dismiss — Senior Carer or Manager required. / Controlled drug omissions: automatically escalated immediately with a red (not amber) badge. / CROSS-PORTAL: controlled drug discrepancy immediately triggers red high-priority alert on Manager's dashboard and push notification. | MED-01 |
| 18 | Medications — Round Tab / Round selector: time pills (08:00 / 14:00 / 18:00 / 20:00), active round highlighted / One resident card per resident with medications due in this round / Each medication: name + dose + route, time window, special instructions / 3 buttons per medication: Given (green) / Not Given (outline) / PRN (only for as-required) / PIN entry (on Given or PRN): '4-digit PIN to confirm — Enter your medication PIN' + 4-dot PIN input / Not Given reason: Resident refused / Resident asleep / Resident in hospital / Medication not available / Resident vomiting / Other (+ free text) / PRN: Reason for administration + Dose given + Outcome observed (optional, reminder after 30 min) / Completion banner: '[N] of [N] medications recorded for [time] round.' If incomplete: '[N] not yet recorded. Record now or close?' | As a care worker, I see each resident's medications due in this round so that I administer and record them systematically. / As a care worker, I confirm each administration with my 4-digit medication PIN so that the record is authenticated. | PIN: 4-digit medication PIN (set at account setup, NOT the device PIN). 5 wrong attempts: locked 15 minutes. / Window closes without record: automatically flagged as omission in Omissions tab. / 30-minute push if not recorded: '[Resident name]'s [medication] at [time] has not been recorded.' 60-minute alert to Senior on duty. | MED-02 |
| 19 | Controlled Drug Register — Senior Carer Only / Tab: 'Controlled drug register' / Header: medication name + resident + running balance (prominent) / Entry rows: date, time, quantity given, running balance, Witness 1 + PIN status, Witness 2 + PIN status / Awaiting second witness: 'Witness 1 has recorded. Awaiting Witness 2 signature.' + 'Countersign' button / Discrepancy alert (red banner): 'Stock count does not match the running balance. This must be resolved before any further administration.' | As a Senior Carer acting as Witness 2, I countersign a controlled drug administration so that the two-witness requirement is met and the running balance is correct. | Senior Carer and above ONLY. Standard care workers cannot view this tab. / Two-signature: Senior 1 records administration + stock count. System prompts Witness 2. Senior 2 taps Countersign + enters own PIN. / Discrepancy: triggers immediate red alert to both Seniors and Manager. Push notification to Manager regardless of app state. | MED-03 |
| 20 | MAR Chart — Individual Resident / Title: 'MAR — [Resident full name]' / Access: 'Open MAR' link or Resident Profile > Medications tab / Monthly grid: rows = medications, columns = dates / Month navigation: < prev / [Month Year] / next > / Cell states: green tick (Given) / red cross (Not given + reason on tap) / amber dot (PRN) / hatched empty (no record — window closed, an omission) / blue outline (window still open) / Tap any cell: detail panel — who, when, dose, notes / Export as PDF (top right) | As a care worker, I view a resident's monthly MAR chart so that I see their full medication history before any administration. | READ-ONLY for all roles. No editing of any historical record. / Hatched empty = omission (window closed, no record). Red cross = documented Not given with reason. These are clinically different states. / PDF export: site name, resident, month, all medications, all records, signature block. | MED-04 |

**●  CLIENT TYPE: HOSPITAL (ACUTE)**

| 20a | Medications tab read-only for HCA. No Given/Not Given/PRN buttons. Note: 'Medication administration is managed by registered nursing staff on this ward.' | As a hospital HCA, I view the patient's medications for clinical context, but recording is done by nursing staff. | Medication administration is always a registered nurse responsibility in acute hospital settings. | MED-04a |


## Table 10

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**G — INCIDENTS**

| 21 | Incidents List / Title: 'Incidents' / '+ Report an incident' button (primary, top right) / 2 summary banners: Left (dark, hatched): '2 incidents reported and not acknowledged — Somebody wrote them down and nobody has picked them up. Of 40 recorded at Rosewood Court in the last 90 days.' Right (red outline): '8 with no CQC notification decision — Nobody has recorded whether these must be notified. Graver than an unacknowledged incident and usually older. Of 40 at Rosewood Court.' / Tabs: Not acknowledged (default, purple) / Open / Under review / Closed / All / Filters: Any type / Any severity / Sub-text: 'Oldest first · 2 of 40 shown' / Each row: resident name + room (left) / hatched badge 'Not acknowledged — waiting 6 days' (centre) / incident type + date/time + room + reporter (right) / severity badge (MODERATE HARM amber / LOW HARM blue / HIGH HARM red) + 'notification undecided' sub-text / 'Open >' link | As a care worker, I see all incidents at my site so that I am aware of significant events affecting residents. / As a care worker, I report a new incident so that the clinical record is updated immediately. | Care workers can VIEW all incidents. CANNOT acknowledge, close, or action CQC notifications. / 'Not acknowledged' badge: same hatched/dashed border as all gap states. / CROSS-PORTAL: on submission, Unacknowledged Incidents badge increments immediately for all Seniors and Managers. Manager receives push notification. | INC-01 |
| 22 | Report an Incident — Form Section 1 / Title: 'Report an incident' / Sub-text: 'Everything on one screen.' / WHO THIS HAPPENED TO: /   'A resident — Choose the person this happened to.' (radio, opens search picker) /   'No resident was involved — Available for an equipment failure or a near miss. Choose the type first.' (radio, greyed until TYPE selected) / WHAT HAPPENED: /   TYPE: Fall: unwitnessed / Fall: witnessed / Medication error / Safeguarding concern / Behaviour that challenges / Injury / Near miss / Equipment failure / Complaint / Other /   WHEN IT HAPPENED: datetime picker, label: 'Not when you are writing this up.' /   WHERE: room/area dropdown (from site's configured areas list) /   ANYONE WHO SAW IT: staff names + 'No witnesses' / IN YOUR OWN WORDS: /   Placeholder: 'What you found, what you saw, what the resident said.' /   Note: 'Written for whoever reads this next: a manager tonight, an inspector in a year.' | As a care worker, I report an incident on a single screen so that I complete the report quickly without missing key information. / As a care worker, I enter when the incident actually happened so that the time-stamp is accurate. | WHEN IT HAPPENED: defaults to current date/time. 'Not when you are writing this up' is a deliberate prompt to correct it. / TYPE determines whether 'No resident was involved' becomes available (Equipment failure and Near miss unlock it). | INC-02 |
| 23 | Report an Incident — Form Section 2 / HOW MUCH HARM WAS CAUSED: /   'No harm — nothing came of it' /   'Low harm — minor treatment, no lasting effect' /   'Moderate harm — treatment needed, recovery expected' /   'Severe harm — permanent or long-term effect' / INJURY: /   'Not checked yet — Nobody has examined them. This is a gap, and it will show as one.' /   'Checked: no injury found — Somebody looked. A recorded negative, not a blank.' /   'Checked: injuries found — Mark each site on the body map.' (opens body map: front and back body outline, tap to mark sites, type dropdown per site) / WHAT YOU DID ABOUT IT: /   IMMEDIATE ACTION TAKEN: 'What you did in the minutes after.' /   Note: 'Your words, at the time. The manager writes their own account when they review it.' / Submit (primary, full width) | As a care worker, I select the harm level from four clearly defined options so that the incident is correctly classified. / As a care worker, I use the three injury options so that 'no injury found' is a documented negative, not a blank. | 'Not checked yet' = documented gap, NOT the same as 'no injury found.' / 'Checked: no injury found' = recorded negative. Proves someone examined the resident. / On Submit: 'Incident reported. Your manager has been notified.' / CROSS-PORTAL: Family Portal — incident does NOT appear until Manager shares a plain-language summary when acknowledging. Compliance: if incident meets CQC threshold, a task appears in the Manager's Statutory notifications. | INC-03 |


## Table 11

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**H — RISK ASSESSMENTS**

| 24 | Risk Assessments List / Title: 'Risk assessments' / Placeholder warning banner (dashed border, grey): 'This instrument is a placeholder. It is not a validated clinical scale, its items and weightings are invented, and no clinical decision should be made from a score it produces. A real instrument has to be sourced before this module is used with real residents.' / 2 summary cards: Left (dark, hatched): '78 risks have never been assessed — Across 28 residents and 9 templates at Rosewood Court. 252 assessments the home is expected to hold. Never assessed is not low risk.' Right: '9 past their review date — Assessed once and not since. Of 252 expected assessments at Rosewood Court.' / Tabs: Never assessed (default, dark filled) / Review overdue / Review due / All / Filter: Any template / Sub-text: 'Never assessed first, then longest overdue · 78 of 252 shown' / Each row: resident name + room / assessment template name / hatched badge 'Never assessed — nobody has looked at this risk' / 'Score now >' (Senior Carer and above only) | As a care worker, I see which risk assessments have never been completed so that I am aware of unassessed risks. / As a care worker, I read completed assessments to understand the risk level and planned interventions. | Care workers: READ-ONLY. 'Score now' NOT shown. / Senior Carers: 'Score now' visible and active. / 'Never assessed is not low risk' — exact UI copy, must appear on the page. / Placeholder banner removed in production once validated clinical instruments are licensed. | RA-01 |
| 25 | Risk Assessment Form — Senior Carer Only / Title: '[Assessment type], [Resident full name]' e.g. 'Skin Integrity, Emmanuel Okafor' / Placeholder warning banner (same as list page) / RUNNING SCORE card: 'RUNNING SCORE — 0 — 0 of 6 items answered. The score is not final until every item has an answer.' + BAND label (e.g. LOW — green pill) / Assessment factor cards (one per factor): factor name bold, description, current answer (hatched: 'Not answered — the score is incomplete until this has an answer'), answer options as selectable radio cards with label and points (e.g. 'Not present — 0 pts', 'Present in the last 3 months — 15 pts', 'Present in the last month — 25 pts') / Running score and BAND update in real time as each factor is answered / INTERVENTIONS section: free text per intervention + responsible person picker + review date / Sign off (button): PIN confirmation required | As a Senior Carer, I score each assessment factor so that the total score and risk band are calculated accurately. / As a Senior Carer, I record interventions alongside the score so that the care team has clear actions linked to the risk. | Running score updates immediately. BAND label (LOW / MEDIUM / HIGH) updates based on score thresholds. / All factors must have an answer before sign off. Button disabled if any factor shows 'Not answered.' / If risk band changes on re-score: all care workers assigned to this resident receive push: '[Assessment type] risk for [Resident name] has changed to HIGH.' Risk flag badge on profile header updates immediately. / CROSS-PORTAL: Reviews queue for Managers updates. Manager notified ONLY if risk band changes. | RA-02 |


## Table 12

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**I — CARE PLANS (READ-ONLY FOR CARE WORKERS)**

| 26 | Care Plan Tab (inside Resident Profile) / Domain list: rows showing domain name and status badge: /   Not started: grey outline, dashed border /   Draft: amber badge, 'DRAFT' label /   Finalised: green filled badge /   Review due: red outline badge with date / Each domain row: domain name, status badge, last reviewed date and reviewer name / Clicking a domain opens domain detail (read-only for care workers): /   Current needs: what support this person requires and why, in plain language /   Preferences and wishes: first-person where possible /   Agreed actions: exactly what the care team will do, written as clear instructions /   Review date /   Version History tab: all previous versions with date, author, content / No Edit button, no Finalise button, no PIN entry for care workers | As a care worker, I read the care plan for a resident so that I know exactly how they want to be supported before beginning any care task. / As a care worker, I see when the plan was last reviewed and by whom so that I know the guidance is current. / As a care worker, I cannot edit care plan content so that clinical decisions stay with the Manager. | Care workers and Senior Carers: READ-ONLY on all care plan domains. / Draft domains: visible with a DRAFT badge — care workers can read draft content but see it is not yet finalised. / Finalised: locked. Future edits create a new version, preserving all previous versions in Version History. / Not started: content area empty with note: 'This section of the care plan has not been written yet. Contact your manager.' / CROSS-PORTAL: when Manager finalises a domain, care workers see a banner on next page load: 'The [Domain name] care plan has been updated. Please read before your next shift.' Significant change = immediate push notification. | CPLN-01 |


## Table 13

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**J — GOALS**

| 27 | Goals List / Title: 'Goals' / Summary card (dark, hatched border): '5 goals passed their date and nobody has said what happened — Of 32 goals with a target date, across 40 at Rosewood Court. 8 have no date at all: a goal with no date is not late and is not counted here.' / Tabs: Past date, nothing said (default, dark filled) / Open / Closed / Resident not asked / All / Sub-text: 'Longest past its date first: the wait is the finding · 5 of 40 shown' / Each row: resident name + room / goal text in first-person quotes '"I want to shower standing up again rather than sitting."' + 'set by M. Halloran' / hatched badge 'Nothing recorded — last note 26/05/2026, nothing since, and 3 months past its date' / 'Open >' link | As a care worker, I see goals for my assigned residents so that I know what each person is working toward during care interactions. / As a care worker, I see which goals are past their target date so that I can add a progress note. | Goals always displayed in first-person language. / 'Past date, nothing said' default: 'the wait is the finding.' The elapsed time since the target date without any update is itself a gap. / 'Resident not asked' tab: goals with no record of whether the resident was consulted — a compliance finding. | GOAL-01 |
| 28 | Goal Detail and Progress Note / Goal statement (large, first-person, in quotes) / Set by: '[Staff name] · [date]' / Category: linked care plan domain / Target date (red if past) / Success criteria / Resident's input: 'Yes — [resident's exact words]' or 'Not yet asked' (amber badge) / Progress notes timeline: chronological, date + author + note text / Empty state: 'No progress notes yet. Be the first to record progress.' / '+ Add progress note' button (all care workers) | As a care worker, I add a progress note to a goal so that the resident's journey is tracked over time. / As a care worker, I see the full history of progress notes so that I understand what has been attempted before my shift. | '+ Add progress note': text area, submit saves with name and date/time. / Goal Progress Prompt on the care note form (answered Yes) auto-creates a progress note here. / Goal status changes (Open / Closed / Achieved): Manager only. / CROSS-PORTAL: progress note added — goal leaves 'Past date, nothing said' tab. Manager sees last-updated date change. Family Portal: celebratory notification if goal marked Achieved. | GOAL-02 |


## Table 14

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**K — ACTIVITIES**

| 29 | Activities Calendar / Title: 'Activities' / View toggles: Week / Month + Calendar / List / Summary card (dark, hatched border): '0 sessions happened and nobody recorded who came — Of 3 sessions at Rosewood Court this week. 0 residents were invited to them, and there is no record of whether any of them came.' / Week calendar: 7 columns (MON to SUN) / Activity card states: /   Partial attendance recorded: amber background, 'Gardening club — 11:00 BST · Garden — 9 of 14 recorded' /   Planned, no attendance yet: white, dashed border, 'Hairdresser — 09:00 BST · Salon — Planned · 9 invited' /   Future planned: white, no border, 'Knitting group — 14:00 BST · Craft room — Planned · 14 invited' | As a care worker, I see this week's activities on a calendar so that I know what sessions are planned and which ones need attendance recorded. / As a care worker, I see at a glance whether attendance has been recorded for each session. | Summary card: same hatched visual language as all gap states. / Amber background = partial attendance recorded. White + dashed = planned, no attendance. White + no border = future. / Care workers CAN record attendance. CANNOT create sessions (Senior Carer action). | ACT-01 |
| 30 | Activity Detail and Attendance Recording / Activity name (header, bold) / Date, time, location, lead staff / Resident list: avatar + name + toggle (Attended / Did not attend) per resident / Engagement level selector (Fully engaged / Partially engaged / Did not engage) — shown after 'Attended' toggled / Activity notes text field: 'Notes about this session overall' / Photo upload: 'Upload photos (up to 5)' — camera roll or camera / Submit attendance (primary) / Senior only (greyed for standard care workers): Edit session details / Cancel session | As a care worker, I record which residents attended and their engagement level so that the care record shows meaningful participation. / As a care worker, I upload photos so that family members can see their relative enjoying activities. | On submission: calendar card updates to '[N] of [N] recorded.' / Photos: appear in Family Portal photo feed for residents who attended AND have Photography consent = Given. Family receives push notification within minutes. / CROSS-PORTAL: Manager's Activities module bar updates. Sessions with no attendance remain in the summary card. | ACT-02 |


## Table 15

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**L — CONSENT (READ-ONLY FOR CARE WORKERS)**

| 31 | Consent Page / Title: 'Consent' / Summary card (dark, hatched border): '42 consents have never been sought — Across 28 residents and 8 types at Rosewood Court. 224 decisions the home is expected to hold. Never sought is not refusal and it is not permission.' / Paragraph: '64 of the decisions that have been made were made for somebody rather than by them: a best-interests process or an attorney. That is lawful and it is not the same thing, which is why the two are separate columns.' / Tabs: Never sought (default, dark filled) / Awaiting a decision / Refused / Decided for them / All / Sub-text: 'Every resident against every consent type · 42 of 224 shown' / Each row: resident name + room / consent type + description (e.g. 'Medical Treatment — Routine treatment arranged through the home, such as a flu vaccination.' or 'Family Portal Access — Named family seeing their care records through the Family Portal.') / status badge / 'Seek consent >' (Senior Carer and above only) | As a care worker, I view the consent record so that I understand which decisions have been sought, which are outstanding, and the legal basis for any decisions made on behalf of a resident who lacks capacity. / As a care worker, I understand that 'Never sought' is a gap — not a refusal and not permission — so that I do not act as though absent consent means consent given. | Care workers: READ-ONLY. Cannot seek, record, or change any consent decision. / 'Never sought is not refusal and it is not permission' — exact UI copy, must appear verbatim. / Default consent types (8): Medical Treatment, Family Portal Access, Photography, Sharing information with GP, Sharing information with social care, Financial decisions, Research participation, Recording and monitoring. / Tab states: Never sought (hatched, 'nobody has asked, and nobody has decided on their behalf'), Awaiting (amber, 'sought but no answer recorded'), Refused (red, 'the resident said no'), Decided for them (purple, 'a best-interests decision or an attorney'). / CROSS-PORTAL: when Senior records a consent decision, the Consents count in the module completion bar updates immediately. Compliance Consent and Capacity Coverage check updates on the nightly job. | CON-01 |


## Table 16

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**M — DOCUMENTS (READ-ONLY FOR CARE WORKERS)**

| 32 | Documents Page / Title: 'Documents' / Sub-text: 'Everything on file at Rosewood Court, the residents' documents and the home's own.' / Top-right: Expiry tracking > (link) / Upload a document (Senior Carer and above only) / Summary metric card: 'OF DOCUMENTS ON FILE CARRY AN EXPIRY DECISION: 77% — 237 of 306 documents' / Sub-text: 'Either a date, or somebody recording that the document does not expire. Where there is neither, nothing can tell you whether the document is still valid.' / Category rows (each showing): /   Health and clinical: 109 on file / 10 expired (red) / 5 expiring within 30 days / '21 with no expiry recorded' (hatched: 'nobody has said whether these expire') /   Assessments and care planning: 41 on file / 5 expired / 1 expiring / '9 with no expiry recorded' (hatched) /   Consent records: 34 on file / 3 expired / 3 expiring / '4 with no expiry recorded' (hatched) | As a care worker, I view documents on file so that I can access clinical letters, DNAR forms, and other reference documents during care delivery. / As a care worker, I see the expiry status so that I know whether a document is still current. | Care workers: READ-ONLY. Cannot upload, delete, or edit. / A document has an expiry decision if (a) it has a specific expiry date, OR (b) someone recorded 'this document does not expire.' Where neither is true: unknown validity state. / Hatched box 'N with no expiry recorded': same gap-state visual as all other missing data. / CROSS-PORTAL: when Senior uploads a document, total documents count updates. Document expiry forecast report updates on next load. | DOC-01 |


## Table 17

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**N — REPORTS (EXCLUDED FROM CARE WORKER ACCESS)**

| 33 | Reports Page — Admin and Manager Only / Reports is NOT accessible to care workers or Senior Carers. The Reports nav item is NOT shown in the left navigation for care worker role. / For design reference, the Reports page UI as seen in the prototype: / Title: 'Reports' / 3 summary cards: /   Left (dark, hatched border): 'REPORTS THAT CANNOT STATE A FINDING: 2 — of 8, over the last 30 days. Each of them still opens and still shows its table: the finding above is what stops the table being read as a conclusion.' Below: '6 of 8 state a finding over this period' and '8 is the population a row needs before it can carry a rate' /   Centre: 'ROWS ACROSS THE EIGHT: 110 — drugs, rounds, staff members, incident types, categories and activities, every one of them counted over the same period' /   Second (hatched border): 'ROWS BELOW THE POPULATION FLOOR: 30 — of 110. Each keeps its counts and loses only its rate: removing them would make every table look complete.' /   Right panel: 'What each report has to work with' — Can carry a rate (solid pill) vs Below the floor (hatched pill). Mini bar per report. / Report sections: Medication (Omissions over a period / Controlled drug reconciliation), Incidents (Incidents by type and location), Assessments (Risk assessment and review coverage over time), Care notes (Care note coverage by staff and shift), Governance (Document expiry forecast / Activity participation over a period / Consent and capacity coverage) / Each report row: Report name / What it answers / Over the last 30 days (headline finding or 'Too thin to conclude' hatched box) / Open > button | As a care worker, I cannot access the Reports page so that sensitive analytical data is restricted to governance roles. / As a designer, I have the full Reports page specification here so that I can design a consistent restricted-access state for care workers. | Population floor: 8 data points minimum before a row can carry a rate. Below 8, the row shows raw counts but cannot state a finding. 'Too thin to conclude' hatched box replaces the finding — e.g. '0 of 18 controlled drugs have enough in the period to say anything.' / This is NOT a failure state — it is honest acknowledgement that small populations cannot yield reliable rates. The report still opens and shows all data. / See the Admin and Manager PRD for the full Reports specification including all export formats and Manager-specific actions. | RPT-01 |


## Table 18

| # | SCREEN TITLE & UI ELEMENTS | USER STORY | DESCRIPTION / WORKFLOW / NOTES | SCREEN / DESIGN |

**O — PROFILE AND SETTINGS**

| 34 | Profile and Settings / Access: avatar/name menu (top right, web) or Settings tab (mobile) / Profile: name, role (read-only), email (read-only), assigned site(s), profile photo / Change password: current, new, confirm / Change medication PIN: current, new, confirm / Notification preferences: toggle per type. Safety-critical show 'Cannot be disabled' label. / Device settings (mobile): Biometric toggle, 'This is a shared device' toggle, Active sessions list (device + last active + End this session) / Sign out (button, at bottom) | As a care worker, I manage my profile and settings so that my information is current and my preferences are configured. / As a care worker on a shared device, I enable shared device mode so that my session and all cached resident data are cleared when I sign out. | Cannot change email (Admin must do this in Team Management). Cannot change role (Admin action). / Safety-critical notifications that cannot be disabled: medication round due, medication window closing, account locked, session expiring. / Shared device mode: every sign-out clears session token, removes cached resident data, disables biometric, returns to login screen. / Active sessions: End this session on a specific device terminates that session without affecting others. | PROF-01 |


## Table 19

| Notification | Channel | When | Role | Can turn off? |
| Medication round due in 30 minutes | Push + in-app | 30 min before round | All care workers | No — safety critical |
| Medication window closing in 10 minutes | Push + in-app | 10 min before close | All care workers | No — safety critical |
| Care note not written for assigned resident (4h+) | In-app banner | 4 hours after last note | All care workers | No |
| Your care note flagged by a senior | Push + in-app | On flag | Note author | Yes |
| Your flagged note reviewed | Push + in-app | On mark reviewed | Note author | Yes |
| New handover to read | Push + in-app | On new handover | All care workers | Yes |
| Resident risk band changed to higher level | Push + in-app | On re-score if band changes | All care workers at site | Yes |
| Goal target date approaching (7 days) | In-app | 7 days before | Responsible staff | Yes |
| Activity attendance not yet recorded | In-app | Evening of activity day | All care workers | Yes |
| Controlled drug discrepancy recorded | Push (Seniors only) | Immediately | Senior Carers | No |
| Account locked after 5 failed attempts | Email | On lockout | Care worker | No |
| Session expiring in 10 minutes | In-app banner | 10 min before expiry | Care worker | No |
