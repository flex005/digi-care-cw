# The phone's visual baseline

The visual language of the phone app (`/m`), taken from `docs/reference/premium-today.html`, a mockup the product owner signed off on 05/11/2026. **The reference is a mockup, not app code.** Its body backdrop, its fixed 390 × 844 box and its SVG paths are not copied. What the phone takes from it is the shape, the colour discipline and the structure of Today.

These rules hold over the whole phone tree: `src/features/phone/` and the styles it owns. `scripts/check-phone-visuals.mjs` holds rules 1, 2, 5, 6 and 8 by construction, and the rest are review questions. CLAUDE.md still governs everything here; where this file is narrower, it is narrower on purpose.

1. **Card corners are `--radius-sm` (8px).** This covers surface cards, inset squares, icon tiles, the sheet's top corners and anything else rectangular that holds content. The reference's 10px was drawn by eye. 8 is on the scale and carries the same intent, so no token was added.

2. **Pills stay fully round, `--radius-pill` (999px).** The tab bar, the active tab, chips, the avatar, badges, the primary button, status dots, progress ticks and the timeline's line all take the pill. A card corner on something shaped like a pill reads as a bug, not a choice. **No other radius exists in the phone tree.**

3. **The reference's 34px phone corner is mockup chrome, and has no counterpart in app code.** The frame that holds the app on a laptop (`PhoneStage`) is square, so a capture of it is the screen and nothing else.

4. **Decoration is one hue: the purple ramp.** Anything whose colour is there to add variety is purple: icon tile tints (`--purple-50`), the icons in them and in quick actions (`--purple-600`), progress ticks, count badges.

5. **Gradients are purple into purple.** No gradient mixes hues, and none fades into a neutral: the timeline's line runs `--purple-400` into `--purple-50`. Use them sparingly. Today has one.

6. **Status colour is not decoration and is not removed.** Positive, caution, critical and info still carry meaning wherever a record is speaking: a dose given, something overdue, a window closing. **Decorative tints go; meaningful status stays.** On the phone a status speaks through its solid tokens on white:
   - The four status tints (`--status-positive-tint`, `--status-caution-tint`, `--status-critical-tint`, `--status-info-tint`) are not used anywhere in the phone tree. They were the decoration.
   - **A caution state on the phone is caution ink text (`--status-caution-ink`) on white. It is never a caution fill, and never a caution dot**: a dot is the fill, which `check-caution-carriers.mjs` allows only inside Toast, beside its required title. This agrees with that guard rather than working around it. The words carry the state, as CLAUDE.md §4 already requires.

7. **The Unrecorded hatch is untouched.** It stays grey, striped and dashed-bordered, and CLAUDE.md §1 still governs it. With everything around it calmer, it carries more weight, which is the point. Its one owner, `src/styles/unrecorded.module.css`, has phone forms at `--radius-sm` beside its desktop forms. The desktop keeps 14, 20 and 28. Nothing in the reference's own hatch recipe is copied.

8. **Icons come from `src/assets/icons/`, at stroke-width 1.5, through `<Icon>`.** The SVG paths inside the reference are placeholders for size and position only. Several are hand-drawn and the bell renders malformed. No path data is copied out of it, and no `<svg>` or `<path>` appears in the phone tree.

9. **Flex only, never grid** (`check-figma-export` rule 1).

## Values the reference names, mapped

- **Elevation.** Cards take `--shadow-card`. The tab bar keeps `--shadow-overlay`, because it floats over content. The one purple glow is `--shadow-raised`, added for this baseline and used only on the primary button. The reference also draws it on a centre action in the tab bar. The phone has no centre action, because no act sits there, so the token has one place. The reference's lighter shadows on the bell, the chips and the tab bar have no counterpart.
- **Type and spacing** take the nearest step of the closed scales. No step is added (CLAUDE.md §4). The stat card's figure is `--text-display` (32px), the card's one number and its subject. The reference's 30px and 10px, and its 13px, 17px and 9px gaps, land on the steps either side.
- **The dark card is not drawn on the phone**, by decision (`docs/DEPARTURES.md`). The phone's high-contrast anchors are the active tab, the time pill and the primary button. A dark card on top of those is one anchor too many on a 390px screen.
