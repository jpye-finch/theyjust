# Design

The "well-made hardback" system for TheyJust. Source of truth is
`src/theme/tokens.ts`; this file is the human-readable companion. Colours were
authored in OKLCH and shipped as sRGB hex (React Native has no `oklch()`); every
text pairing clears WCAG AA. The old sage/cream/terracotta Figma is the
anti-reference (see PRODUCT.md).

## Theme

Light only. One scene: a parent on the sofa after bedtime, lamp-lit, one hand
free, adding tonight's moment before it blurs. Warm paper, low glare. (Dark mode
is a later, deliberate addition, not a default.)

## Color

Strategy: Restrained, around an unexpected axis. Warm paper + warm near-black
ink + one accent, damson (deep plum-red: jam, knitted cardigans). No green, no
terracotta, no sage, no pastel-nursery anywhere.

| Token | Hex | Role | Contrast |
|---|---|---|---|
| `paper` | `#F9F6F1` | the page background | — |
| `paperRaise` | `#F1ECE4` | pressed / raised surface | — |
| `ink` | `#2A201B` | primary type | 14.75:1 on paper |
| `inkMuted` | `#645A54` | secondary type, captions | 6.22:1 on paper |
| `rule` | `#E3DFD8` | hairline rules (the book-index divider) | — |
| `damson` | `#833045` | accent: achieved stamps, primary actions, active tab | 7.87:1 on paper |
| `damsonSoft` | `#FBE0E2` | pale wash behind an achieved milestone | damson 6.82:1 on it |
| `onDamson` | `#FCFAF6` | type on a damson fill | 8.14:1 |

## Typography

Two families, a deliberate serif/sans split that IS the brand.

- **Fraunces** (soft characterful serif) carries the celebration voice ONLY:
  the wordmark, child names, section moments, big empty-state headings, the
  gentle signpost (italic). `Fraunces_600SemiBold`, `_700Bold`, `_500Medium_Italic`.
- **Karla** (quiet humanist sans) does all functional work: body, labels,
  ranges, buttons, tabs. `Karla_400Regular`, `_500Medium`, `_700Bold`.

Scale (≥1.25 steps): hero 34, display 26, title 20, body 16, label 15, caption 13.

## Components

- **Field** (`src/components/Field.tsx`): a book-form input. Small Karla label
  over an underlined field, no box. The 1.5px underline warms to damson on focus.
- **PrimaryButton**: the one filled element on a screen. Damson block, onDamson
  Karla-bold label, radius 10, 0.85 opacity on press. `…` while busy.
- **TextButton**: quiet secondary action (Edit, Cancel, Sign out). Damson
  (accent) or inkMuted (muted) text, no fill.
- **MilestoneRow**: a table-of-contents row. Unachieved = Karla title (ink) +
  Karla range (inkMuted) over a hairline rule. Achieved = ink-stamped: damson
  title + age on a `damsonSoft` wash. Signpost = Fraunces italic aside.
- **Section headers**: book-chapter headings in Fraunces italic, damson,
  sentence case. Deliberately NOT tracked-uppercase kicker labels.
- **Child switcher**: a hairline-underline selector (the selected name carries a
  2px damson underline), echoing the Field focus motif. Not pill chips.
- **Tab bar**: paper, hairline top, damson active / inkMuted inactive, Feather
  line glyphs (book-open, users — no trophy/award: this product never gamifies),
  Karla labels.

## Layout

List-led, rule-divided pages like a book's index. Hairline rules, generous
margins, no boxes around everything. Hierarchy comes from the type scale, not
containers. Cards are avoided. Spacing scale: 4 / 8 / 12 / 16 / 24 / 32. Radius:
6 (sm) / 10 (md) only — no pills (the anti-reference's 999px pill is escaped
entirely; selection is shown by underline, not a rounded chip). Primary actions
sit in thumb reach.

## Motion

Minimal and functional at this stage (focus underline colour, press opacity).
No layout-property animation, no bounce. Richer motion is a later, purposeful
addition.

## Accessibility

WCAG AA throughout (table above). Dynamic type respected (no fixed heights on
text). Form errors use `role="alert"` + `accessibilityLiveRegion="polite"`.
Chips carry `accessibilityState={{ selected }}`; headings carry
`accessibilityRole="header"`. Sign-out is confirmed via `Alert`.
