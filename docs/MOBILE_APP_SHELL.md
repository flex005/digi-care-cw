# MOBILE_APP_SHELL.md — the phone app is an app, not a page

Rules for everything under `/m` (`src/app/m/`, `src/features/phone/`). CLAUDE.md holds everywhere; this file holds on top of it, for the phone tree only. It exists because the phone build drifted twice into **a responsive web page at phone width**, and that is the defect: a phone app differs from a narrow page in specific, checkable ways, and none of them is "smaller".

`scripts/check-app-shell.mjs` holds the half of this that a script can see. The other half is a review question, and is written down here as one rather than counted as covered.

---

## 1. Only the middle scrolls

**The single biggest tell, and the one most often got wrong.** `html` and `body` do not scroll at all: while the phone tree is mounted they are locked at `100dvh` with `overflow: hidden` (`.lockedRoot`, set by `PhoneApp` on mount and removed on unmount, so the desktop build is untouched). The header is fixed, the tab bar is fixed, and **exactly one pane between them scrolls**, `.pane`, with `overscroll-behavior: contain` so a flick at the end of a list does not drag the whole page.

On a web page everything scrolls together, header included. Get this wrong and nothing else here rescues it.

- Each screen on a stack has its own `.pane`, and only the top one is visible, so at any moment one pane scrolls. A second scrolling element inside a screen is a finding.
- The shell is a flex column filling the viewport: header, stack, tab bar. Fixed by construction, not by `position: fixed` on each part.

## 2. Screens are a stack, not links

**Tapping a resident pushes a screen in from the right over the list; back pops it to the right.** Forward and back are opposite directions, and the direction is what tells somebody where they are.

- **Each tab keeps its own stack and its own scroll position.** Every screen on every tab stays mounted; an inactive tab is hidden with `visibility: hidden` and `inert`, never `display: none`, which throws the scroll position away. Returning to a tab puts you where you left it, never at the top.
- **Tapping the tab you are on pops it to its root**, as every phone does.
- The address follows the stack (`history.pushState` on push, back on pop) so a link to a record opens it and the system back gesture pops. **The stack is the source of truth; the address is a copy of it.** One route file (`/m/[[...path]]`) receives every address, and `phone-paths.ts` turns it into a stack.
- In-app moves go through `StackLink` and `usePhoneNav()`, never `next/link`, which replaces the document and loses both the stack and the scroll.

## 3. Forms are sheets, not routes

**Writing a note does not navigate to `/notes/new`.** A sheet rises from the bottom over the screen you are on, with a grab handle at the top, the screen behind it dimmed and still visible. It closes by dragging down or by Cancel in its own top-left. Pickers, confirmations and anything short are sheets (`Sheet`). **A route is for a new place, not for a task.**

Every place the phone can push is declared in `PHONE_PLACES` with `kind: 'place'`. A place of any other kind, or an address segment that names a task (`new`, `edit`, `add`, `compose`, `confirm`, `form`), is a finding.

## 4. Edge to edge

**No `max-width`, no centred container, no `margin: 0 auto`.** The screen fills whatever width it has. Headers, the subject bar and full-bleed lists run to the very edge. A centred column with air either side is the clearest sign of a web page.

**The gutter is 16px, `--layout-gutter-compact`, and not the 18px the brief asked for.** The spacing scale is 4px with one named exception (CLAUDE.md §4), and an 18px step is a token decision (§9), not a local value. Raised with Frank; until he decides, it is 16.

A `max-width` in `ch` is a reading measure on a line of text, and `100%` only stops a label overflowing; neither is a container, and both are allowed.

## 5. Safe areas are real

The tab bar's floating container takes `padding-bottom: max(var(--space-20), env(safe-area-inset-bottom))`; the bar at the top of each screen takes `env(safe-area-inset-top)`; a sheet takes the bottom inset under its last control. **None of these do anything unless the viewport says `viewport-fit=cover`**, which `src/app/m/layout.tsx` declares for the phone tree only. Without them the tab bar sits under the home indicator on every modern phone.

### The tab bar is a floating pill

**It floats**: a white pill in the 16px gutter with a soft shadow, over the content, not a full-width bar welded to the bottom edge. That is the part that reads as an app rather than a website footer. The pane's last row and a screen's primary action both clear it (`--tab-clearance`).

- Four equal tabs, 52px tall, icon above an 11px label. The tab you are on is a filled `--purple-600` pill inside the bar, white, weight 700; the others are `--ink-700`, weight 600.
- **One badge, on Medication**, because it is the only thing on a clock: doses due now or in the next two hours, on your list, today, the same figure as Today's tile. A badge is a bare number, so its denominator and scope are in the tab's accessible name and in the sheet the tab opens.
- **Three departures from the brief, each from a standing rule:** 8px inner padding, not 7, and a 20px badge, not 19, because the spacing scale is 4px (CLAUDE.md §4); and the badge is `--status-critical-ink`, not the critical fill, because white on the fill is about 4.2:1, under the 4.5:1 an 11px label needs.

## 6. Pressed, not hovered

**There is no cursor. Every `:hover` rule in the phone tree is a defect.** Touchables respond to `:active`: buttons, tabs and cards scale to 0.97 and dim slightly over 90ms (`.press`); full-bleed rows dim and take the sunken surface, because a whole row shrinking reads as the list moving. That tiny response is most of what "native" feels like. Touchables also take `touch-action: manipulation` and no tap highlight.

Desktop primitives used inside the phone tree bring their own stylesheets; a control the reader presses is styled here, with `:active`, rather than borrowed with its `:hover`.

## 7. The title bar is not a document heading

A screen has a compact bar: back chevron on the left, title in the middle, at most one action on the right. **A root screen has a large title in its content that collapses into the bar as it scrolls away.** No breadcrumbs, no logo linking home, no footer, no "back to top".

**The home is always in the bar** (CLAUDE.md §2), as a caption under the title, on every screen.

## 8. One primary action, in the thumb zone

A full-width pill at the bottom of the screen, above the tab bar, outside the scrolling pane (`Screen`'s `primary`). Not a submit button at the end of a long form. A screen has at most one. **Where the act is not built or not this reader's, the line saying so sits at the point of the act**, above the pill, not behind a tap (CLAUDE.md §6).

## 9. Lists are full-bleed

Rows run the full width with their own dividers, inset at the gutter, or cards sit in the gutter. Never a grid of boxes inside a narrower container. Section headings sit on the grey page between white list sections.

## 10. Transitions have direction and are short

Push and pop 260ms; the screen underneath moves a quarter of the way left and back. Sheets rise in 300ms on a spring-shaped curve and fall in 220ms. **No cross-fades, nothing over 350ms.** Under `prefers-reduced-motion: reduce` every transition is removed and the stack still works: removal of a popped screen is timed, not waited on an `animationend` that would never come.

## 11. Inputs behave

`inputmode` and `enterkeyhint` set on every field; `autocapitalize`, `autocorrect` and `spellcheck` off where they are wrong (a search for a room number). A focused field scrolls itself to the middle of its pane once the keyboard has risen, rather than sitting under it.

## 12. No device chrome drawn

No fake status bar, notch or home indicator, and no imitation browser chrome. The app starts at the top of its own content.

---

## What the guard sees, and what it does not

`check-app-shell.mjs` reads every stylesheet and component under `src/features/phone/` and every route file under `src/app/m/`, and fails on:

- `max-width` in any unit but `ch` or `100%`, or an `auto` margin (§4)
- `:hover` (§6)
- `@media` other than `prefers-reduced-motion` (§10, and CLAUDE.md §4's one breakpoint)
- a tab bar without `env(safe-area-inset-bottom)` in its padding, or a bar without `env(safe-area-inset-top)` in its padding (§5) — in the padding, because the first version read the whole rule and passed a bar whose padding had lost the inset while its `min-height` still mentioned it
- `overflow: auto | scroll` anywhere but `.pane`, or a `.pane` without `overscroll-behavior: contain` (§1)
- no root lock at `100dvh` with `overflow: hidden` (§1)
- a place not declared `kind: 'place'`, or an address segment naming a task (§3)
- `next/link` imported in the phone tree (§2)

**What its tick would still print if the rule were broken in a way nobody wrote a mutation for** (CLAUDE.md §8): a stack that pushes without animating, a sheet that cannot be dragged, a tab that loses its scroll because something unmounted it, a bar with two actions, a primary action placed inside the pane, a field that sits under the keyboard. Those are review questions, at 390 wide, on a phone, in the hand.
