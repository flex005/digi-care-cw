# The phone's visual baseline

The visual language of the phone app (`/m`), taken from `docs/reference/premium-today.html`, a mockup the product owner signed off on 05/11/2026. **The reference is a mockup, not app code.** Its body backdrop, its fixed 390 × 844 box and its SVG paths are not copied. What the phone takes from it is the shape, the colour discipline and the structure of Today.

These rules hold over the whole phone tree: `src/features/phone/` and the styles it owns. `scripts/check-phone-visuals.mjs` holds rules 1, 2, 5, 6 and 8 by construction, and the rest are review questions. CLAUDE.md still governs everything here; where this file is narrower, it is narrower on purpose.

1. **Card corners are `--radius-sm` (8px).** This covers surface cards, inset squares, icon tiles, the sheet's top corners and anything else rectangular that holds content. The reference's 10px was drawn by eye. 8 is on the scale and carries the same intent, so no token was added.

2. **Pills stay fully round, `--radius-pill` (999px).** The tab bar, the active tab, chips, the avatar, badges, the primary button, status dots, share bars and the timeline's line all take the pill. A card corner on something shaped like a pill reads as a bug, not a choice. **No other radius exists in the phone tree.**

3. **The reference's 34px phone corner is mockup chrome, and has no counterpart in app code.** The frame that holds the app on a laptop (`PhoneStage`) is square, so a capture of it is the screen and nothing else.

4. **Decoration is one hue: the purple ramp.** Anything whose colour is there to add variety is purple: icon tile tints (`--purple-50`), the icons in them and in quick actions (`--purple-600`), count badges, including the dose count on Medication, and the fill of a share bar.

5. **Gradients are purple into purple.** No gradient mixes hues, and none fades into a neutral. There are two: the timeline's line, `--purple-400` into `--purple-50`, and the raised centre action in the tab bar.

6. **Status colour is not decoration and is not removed.** Positive, caution, critical and info still carry meaning wherever a record is speaking: a dose given, something overdue, a window closing. **Decorative tints go; meaningful status stays.** On the phone a status speaks through its solid tokens on white:
   - The four status tints (`--status-positive-tint`, `--status-caution-tint`, `--status-critical-tint`, `--status-info-tint`) are not used anywhere in the phone tree. They were the decoration.
   - **A caution state on the phone is caution ink text (`--status-caution-ink`) on white. It is never a caution fill, and never a caution dot**: a dot is the fill, which `check-caution-carriers.mjs` allows only inside Toast, beside its required title. This agrees with that guard rather than working around it. The words carry the state, as CLAUDE.md §4 already requires.

7. **The Unrecorded hatch is untouched.** It stays grey, striped and dashed-bordered, and CLAUDE.md §1 still governs it. With everything around it calmer, it carries more weight, which is the point. Its one owner, `src/styles/unrecorded.module.css`, has phone forms at `--radius-sm` beside its desktop forms. The desktop keeps 14, 20 and 28. Nothing in the reference's own hatch recipe is copied.

8. **Icons come from `src/assets/icons/`, at stroke-width 1.5, through `<Icon>`.** The SVG paths inside the reference are placeholders for size and position only. Several are hand-drawn and the bell renders malformed. No path data is copied out of it, and no `<svg>` or `<path>` appears in the phone tree.

9. **Flex only, never grid** (`check-figma-export` rule 1).

## Named exceptions

- **The allergy pill keeps its critical tint.** On a resident's record, an allergy is drawn by the shared `StatusPill` in the critical ink on the critical tint, a penicillin anaphylaxis as loudly as anything on the phone. That is rule 6 at its clearest, not a breach of it: an allergy is a record speaking, and it is life-safety information that should be the loudest thing on the screen. It is decided (05/11/2026) and is not to be "fixed" into solid-on-white. `check-phone-visuals` cannot see it, because the tint is drawn outside the phone tree, and its failure message names this exception so nobody reaches for it.

## Values the reference names, mapped

- **Elevation.** Cards take `--shadow-card`. The tab bar keeps `--shadow-overlay`, because it floats over content. The one purple glow is `--shadow-raised`, added for this baseline. It has two places: the primary button and the raised centre action. The reference's lighter shadows on the bell, the chips and the tab bar have no counterpart.
- **The centre action** is the reference's fifth slot, between Residents and Medication: writing a care note. Care notes are not built on the phone, so it declares itself `not_built` as Medication and More do and opens the same sheet saying so. It is not a tab: tapping it changes neither the active tab nor the address.
- **Type and spacing** take the nearest step of the closed scales. No step is added (CLAUDE.md §4). The stat card's figure is `--text-display` (32px), the card's one number and its subject. The reference's 30px and 10px, and its 13px, 17px and 9px gaps, land on the steps either side.
- **Ticks are banned.** The reference draws a row of ticks under each figure, one per unit, which works for its 14 doses. Real figures here run to 165 doses, so ticks would have to be rounded, and 3 of 165 rounds to a row with nothing filled. A mark that draws empty for a figure that is not zero is the same kind of false statement the hatch exists to prevent: it says "nothing" where the record says "some" (CLAUDE.md §1).
- **Share bars are allowed, with a floor.** A stat card with a denominator may draw one thin continuous bar: a track at `--radius-pill` in `--border-subtle`, the fill in `--purple-600` at the figure's share of its denominator, the same bar on every card that has one. **Any figure above zero draws at least a visible sliver (`--space-8`)**, so 1 of 165, under a pixel at its true share, still shows; only an exact zero draws an empty track, because a zero is a finding. The floor is `shareWidth` in `src/features/phone/ShareBar.tsx`, and its test fails if the floor is removed or small figures are rounded away. On a hatched card the bar takes the hatch's grey (`--status-unrecorded`) over white rather than purple; the hatch's own tint stays in its owner file. The bar is decoration: the figure and the words under it carry the meaning, and it is hidden from assistive technology.
- **No bar without a denominator.** A bar is a share of a total, and a figure with no total gets none. "Already late" counts doses, reviews and handovers, which are not one unit and do not add to a total (`docs/DEPARTURES.md`), so it has no bar, and none is to be given to it by inventing a total. Every stat card states which it is: `share` is a value and total, or `'no_denominator'`.
- **How Today counts goes in a sheet, not on the page.** The sentences saying what the late figure counts, what it leaves out and over whom are load-bearing and kept word for word, in a sheet. The page carries one line in their place, "Counted over your list · 2 things not counted", built from the same values as the sentences so it cannot disagree with them. It states the scope even when nothing is left out. "Nothing is late for you to act on" is an empty state, not an account of counting, and stays with the late list.
- **The moved-clock notice has a phone form**: the same words, smaller, at `--radius-sm`, so it does not take the top of the screen before the first figure. The desktop form is unchanged.
- **The person heading sits on the page**, not on a white band.
- **A full-height sheet is square**, like the frame, because it covers the whole app. A short sheet's top corners take `--radius-sm`.
- **In the care note composer, "Not recorded" is not a sixth mood.** The five moods are a grid of 48px cells; "Not recorded" sits apart below them in the hatch's pill form, because it is the absence of a mood and is drawn as an absence is drawn everywhere (CLAUDE.md §1). A saved note shows it hatched too (`MoodBadge`).
- **The dark card is not drawn on the phone**, by decision (`docs/DEPARTURES.md`). The phone's high-contrast anchors are the active tab, the time pill and the primary button. A dark card on top of those is one anchor too many on a 390px screen.
