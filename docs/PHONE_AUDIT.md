# PHONE_AUDIT.md — what the phone build actually is

**A snapshot, and out of date since the visual baseline (05/11/2026) and the care notes module.** What changed since is in `PROGRESS.md` and `docs/PHONE_VISUAL_BASELINE.md`; this file has not been re-read against the code. Read from the code at a21e39c, 03/11/2026, not from memory or from a mockup. Brief from this file. Where it and the code disagree, the code wins and this file is wrong; where it says "not checked", nobody has looked.

The rules the phone must keep are `docs/MOBILE_APP_SHELL.md`; this file is what is built.

---

## 1. Routes

Three route files under `src/app/m/`, all thin (CLAUDE.md §6):

| File | Does |
|---|---|
| `m/layout.tsx` | Declares the phone tree's viewport: `width=390, viewport-fit=cover`, with the root's `initial-scale=1` removed. Renders its children. |
| `m/(app)/layout.tsx` | Mounts `PhoneStage` (client-only, `phoneApp`). **The whole app lives here**, so moving between addresses never remounts it. |
| `m/(app)/[[...path]]/page.tsx` | `PhoneAddress`, which draws nothing. It exists so every address under `/m` is one the server answers. |

One `ROUTES` row: `/m/[[...path]]`, `inShell: false`.

Addresses `phone-paths.ts` (`stackOf`) understands. Anything else opens Today.

| Address | Opens | Reachable from the UI? |
|---|---|---|
| `/m` | Today | Yes, from the Today tab. **Nothing in the desktop build links to `/m`**; you type it, and sign-in returns you there (`/sign-in?from=%2Fm`). |
| `/m/people` | Residents, Your list | Yes, from the Residents tab. |
| `/m/everyone` | Residents, Everyone | **Typed only.** The Your list / Everyone strip changes local state and leaves the address at `/m/people`. |
| `/m/list` | Same as `/m/people` | Typed only. An alias nobody links to. |
| `/m/search` | Search, pushed over Residents | Yes, from the search field on Residents. |
| `/m/people/<id>` | One resident, pushed over Residents | Yes, from a row on Your list, Everyone, Search or Today's late list. |

The address is a copy of the stack: a push adds a history entry, back pops one, a tab switch replaces it.

`/m/sheet` was removed at a21e39c and is not a route.

## 2. Screens

Four screens on two tabs. Medication and More are drawn tabs that open a "not built" sheet.

| Screen | Shows | States it handles |
|---|---|---|
| **Today** (`TodayScreen`) | Reader's header (initials, "Hello, <first name>", shift · home); moved-clock notice; dark card "Already late" (count, each part with its scope or why it is not counted); scope note; three tiles (due in 2 h, not written up, past window); late list oldest first with a filter sheet. | Loading, error with retry, not your home (all via `Loaded`); no list (`NothingCounted`, hatched); nothing late (plain words); filter matches nothing. |
| **Residents** (`PeopleScreen`) | Large title and scope line; moved-clock notice; search field (pushes Search); strip Your list / Everyone. Your list: avatar, name, room, one outstanding line per row. Everyone: room groups, name and room only, no status. | Loading, error, not your home; no list (`NobodyAssigned`, hatched, with a refusal line); list at another home only; room not recorded (hatched). |
| **Search** (`SearchScreen`) | Field focused on arrival; results across the whole home; a line saying it searches everyone. | Empty query (no results drawn, only the line saying it searches everyone); no match ("Nobody at … matches"); loading, error, not your home. |
| **One resident** (`RecordScreen`) | Fixed subject header (avatar, name, known as, room, born); allergies; outstanding today; "the rest of the record" as rows marked "Not built yet"; docked "Write a care note", disabled, with its line. | Allergies in three states (not recorded hatched, none known, list); nothing outstanding; off your list (name only, plus where the list is set); refused or not-stated care note act; loading, error, not your home. |

**Reviewed against the seven states (CLAUDE.md §10): none of them fully.**
- **Seen by screenshot:** Populated, Partial and Empty-ish, at 390 wide in colour and greyscale, as two care workers only: Ngozi Eze, who has a list, and Kwame Osei, who has none.
- **Senior carer:** covered by tests and never screenshotted.
- **Loading and Error:** exist in code and were never looked at.
- **Stale:** has no treatment.
- **Read-only:** only as the refusals above.
- **At 1440:** only the frame was measured, not each screen.

## 3. The shell

What contains what, outermost first:

1. **`PhoneStage`** locks `<html>` against scrolling (`.lockedRoot`, removed on unmount). It renders `.stage`, a fixed dark backdrop and the only `position: fixed` in the tree.
2. **`.frame`** is 390 × 844 with `max-width` and `max-height` of 100%. It is `position: relative`, the containing block for everything inside, with `--radius-xl` and `--shadow-page`. On a laptop it is a frame. On a phone the 390 viewport makes it the screen.
3. **`PhoneApp`** checks sign-in, then `.app` fills the frame (`absolute; inset: 0`, flex column). Its ref is published through `FrameContext` so sheets portal into the frame, not `<body>`.
4. **Stacks.** One per tab, Today and Residents. A tab mounts the first time it is shown, then stays mounted, hidden with `visibility: hidden` + `inert` when inactive. Push slides in from the right over 260ms; popped entries are removed after 260ms by a timer. The pure reducer is `stack.ts`.
5. **`Screen`**, one per stack entry, top to bottom:
   - a bar, in one of three forms:
     - the reader's header, on Today;
     - the home caption with a title that appears on scroll, on Residents;
     - a back chevron and left-aligned title with the home under it, on pushed screens;
   - an optional fixed `subject` band;
   - **the one `.pane` that scrolls**, with `overscroll-behavior: contain`;
   - an optional `primary` dock.
6. **Tab bar.** `position: absolute` at the frame's bottom: a white pill in the 16px gutter with 8px padding and four 52px tabs. The active tab is marked by colour and weight alone. A badge appears on Medication only.
7. **`Sheet`** is a Radix Dialog portalled into the frame, `absolute`, with `max-height: 90%`. It has a grab handle (drag past 96px closes it) and Cancel/Done in the top left.

**Sizing:** nothing reads the window. The frame sizes from its container, and the app and everything in it from the frame. Safe-area insets pad the bar and the tab bar; they resolve to zero inside a laptop frame.

## 4. Guards

**Phone-only:** `check-app-shell`, the only guard that knows the phone tree exists.
- **Reads:** stylesheets and components under `src/features/phone/`, and route files under `src/app/m/`.
- **Fails on:**
  - `max-width` other than `ch` or `100%`, or an auto margin;
  - `:hover`;
  - `@media` other than reduced motion;
  - a missing safe area in the bar or tab bar padding;
  - `overflow: auto` or `scroll` off `.pane`;
  - a missing root lock;
  - a viewport unit;
  - `position: fixed` off `.stage`;
  - an undeclared place or a task-shaped address;
  - a `next/link` import.
- **Now:** 2 stylesheets, 109 rules; 3 `max-width` (ch or 100%); 0 `:hover`; 1 `@media` (reduced motion); **1 scrolling overflow, on `.pane`**; root locked; both safe areas set; 0 viewport units; 1 `position: fixed`, on `.stage`; 4 of 4 places; 1 route file; 0 `next/link` across 20 components.
- **Cannot see:**
  - whether a push animates, a sheet drags, a tab keeps its scroll, or a field clears the keyboard;
  - **the stylesheets of shared components drawn inside the phone** (section 5), including any `@media` in them.

**Whole-repo guards that also read the phone tree**, each green, with its figure as of a21e39c:

| Guard | Checks | Figure |
|---|---|---|
| `check-tokens` | Every colour and size is a declared token. | 4,490 references |
| `check-css-classes` | Every class referenced is declared; no chained `composes:`. | 1,616 references, 162 components |
| `check-hatch` | One owner of the hatch. | 599 other files |
| `check-caution-carriers` | The caution fill is drawn only by `Toast`. | 600 files |
| `check-role-names` | No screen names or compares a role. | 445 files |
| `check-assignment-reach` | Only `ResidentScope` reads an assignment. | 11 references, 4 places |
| `check-client-only` | Route files import nothing that reads a record. | 62 routes, 61 screens |
| `check-figma-export` | No grid, no `url(#…)`, committed fonts, one breakpoint. | 85 stylesheets |
| `check-vocabulary-coverage` | The ratchet on hard-coded term words. | 2161, best 2161 |
| `check-plural-agreement` | Counts beside declared plural forms go through `pluralise`. | 39 counts |
| `check-term-forms` | No possessive, plural or case change built from a term at the call site. | 265 accesses |

Two of these 2161 are the phone's: the module specifiers in `phone-data.ts` (1fc183c).

**Not covering the phone:**
- `check-nav-reach` reads the desktop's 13 `NAV_ITEMS`. The phone's four tabs are not checked; two are deliberately unbuilt and say so in a sheet.
- `check-session-losses` has nothing to check: the phone holds no session store.

## 5. Shared with the desktop

A change to any of these lands on both builds.

| Kind | Used by the phone |
|---|---|
| **Components** | `Avatar`, `ActLine` (primitives); `StatusPill`, `Unrecorded`, `NotYourHome` (status); `ActionCard`; `MovedClockLine`, `SessionExpiry`, `RequireSignIn`, `NAV_ITEMS` (shell); `Icon`. |
| **Session** | `useSession`, `useSignedIn`, `useSiteFormat`, `useViewer`, `capabilities.ts` (`Answer`); `resident-scope.ts` (`scopeLine`, `scopeNote`, `scopeDenominator`, `scopeReaches`, `noListYetLine`, `notOnYourListLine`, re-exported through `phone-data.ts`). |
| **Data** | `data/access/client` (`getResidentsBySite`, `getRound`, `getCareNotesForSite`, `getCareNotes`, `getMarRecords`, `getResident`, `getOmissions`, `getHandoverBoard`); `useResource`; `fixtures/clock` (`now`); `data/types`. |
| **Feature helpers** | `dashboard-figures` (`dueSoon`, `dosesPastTheirWindow`); `late-items` (`fromOmissions`, `fromReviews`, `fromHandovers`, `byOldest`, `ofKind`, `LATE_FILTERS`); `care-notes-views` (`withoutNoteToday`); `residents/list-name`. |
| **Lib** | `format` (`pluralise`, `formatCount`, `formatLateness`, `formatDate`, `zonedDate`); `shift`; `vocabulary-choice`; `assert-never`. |
| **Overridden on the phone only** | `ActionCard`'s uppercase kicker, set in sentence case by `.lead [data-action-card] > p:first-child` in `phone.module.css`. If `ActionCard` stops rendering `data-action-card`, or moves the kicker from first child, the override silently stops. |

Today's figures come from the desktop dashboard's own functions, so the two cannot disagree; a change to them changes both.

## 6. Open and known-wrong

**Known wrong**
- **`SessionExpiry` carries `@media (width < 1024px)`.** Inside the frame on a laptop the query sees the 1440 window, so the expiry bar is drawn in its desktop form inside a phone. On a real phone it is drawn compact. Not looked at; `check-app-shell` cannot see it, because it reads only the phone's own stylesheets.
- ~~Dose windows an hour off since 25/10/2026~~ **Fixed 03/11/2026**: the fixture generator built every wall-clock time on the machine's clock. It now builds them on the home's (`src/data/fixtures/home-zone.ts`), held by a pair of tests either side of the clock change on four machine zones (`dose-window.test.ts`). See PROGRESS.md.
- **The record's name appears twice**, in the bar title and in the subject header directly below it.

**Not built, and says so**
- Medication and More tabs, each opening a "not built" sheet. More is where signing out would live (AUTH-09), so **there is no sign-out on the phone**.
- The care note composer: a disabled primary with an `ActLine`.
- Every row under "the rest of the record".
- The reader's header allows up to two icon buttons; none are drawn, because Today has no act for one.

**Tests that cover less than their names**
- **"gives every screen exactly one pane that scrolls"** and **"names the home in the bar of every screen"** both open `/m/people/res-okafor`. Only the Residents root and the record are mounted there, because tabs mount lazily, so Today and Search are never checked. The second also matches the home anywhere in the screen, not in the bar. As written it could not check Today: Today's line reads "Late shift · Rosewood Court", which an exact match on "Rosewood Court" misses. Today's home is held instead by "is headed by the reader…".
- **"keeps each tab's stack while another tab is showing"** checks that the stack's entries survive. It does not check the scroll position, which `MOBILE_APP_SHELL.md` §2 promises; jsdom has no layout to scroll.
- **"locks the document while it is mounted"** checks that `<html>` has some class, not that it has `.lockedRoot`.
- Nothing tests:
  - the sheet's drag-to-close;
  - push and pop animation;
  - the keyboard-clearing scroll in Search;
  - the root title collapsing into the bar.

**Departures about the phone** (`docs/DEPARTURES.md`, "The phone app (`/m`)")
- Everyone and Search show every name and room to a care worker; the record still opens only for their list. This reads a draft PRD row.
- Rooms are grouped by hundreds, not by wing; the fixtures hold no wings.
- "Your list is set in Team Management" is refused through `open_settings_and_team`.
- Medication and More are drawn and not built.
- The gutter is 16px, not 18.
- The tab bar takes 8px padding, not 7; the badge is 20px, not 19, and uses the critical ink (in `MOBILE_APP_SHELL.md` §5).
- **The fixed 390 layout width, not to be copied into the real app.**
- The "demure" restyle:
  - nearest-step sizes;
  - Today's line names the home instead of the list count;
  - no icon buttons;
  - two uppercase labels kept or overridden;
  - the resident avatar keeps its tint.

## 7. What I could not determine

- Should switching the strip to Everyone change the address to `/m/everyone`? Today it does not, so a capture or a reload of Everyone returns to Your list.
- What does `/m/people/<id>` show for an id that is not a resident? Expected: the error card from `getResident` rejecting. Not checked.
- Which of the seven states does Frank want reviewed before module 2? None has been reviewed as a set.
- Should a senior carer's phone screens be screenshotted, as CLAUDE.md §10 asks? Only the tests have exercised that role.
- Is the 16px gutter accepted, or is an 18px token wanted? Raised and unanswered.
- Should the phone have its own sign-out before More is built? Today the only way out is the desktop, or the session ending.
- Should `check-app-shell` read the stylesheets of shared components drawn inside the phone? That would have caught `SessionExpiry`. It would also flag `Avatar`'s `@media` on a size the phone never uses.
