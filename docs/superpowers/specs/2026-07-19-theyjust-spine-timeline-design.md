# Spine Timeline — Design

**Status:** approved 2026-07-19. Supersedes nothing; the existing list Timeline stays.

## 1. Why

The Timeline is currently a list of cards. A list says *what* happened and in what order, but it throws away *when* — the reader cannot see that three moments landed in one week and then nothing for two months. That rhythm is the shape of a childhood, and it is the thing a parent cannot reconstruct from memory a year later.

The spine view restores it: vertical distance is elapsed time, so a burst of development reads as a tight cluster and a quiet stretch reads as space.

## 2. Scope

**In:** a second Timeline view, reachable by a toggle in the existing header; a proportional spine; age rules; gap captions; a "Born" anchor; persistence of the chosen view.

**Out:** editing from the spine (tapping opens the existing moment detail), zooming or pinch-to-scale, horizontal orientation, and any change to the list view's own layout.

## 3. The scale

The core decision. Three candidates were compared against two years of plausible data:

- **True linear** — every day the same distance. Honest and unusable: two years is roughly 9,500px of mostly empty scroll, five years nearly 24,000px.
- **Clamped linear** — proportional up to a cap. Faithful in the dense newborn period, but every gap beyond about nine days looks identical.
- **Compressed (square root)** — chosen. Gaps keep growing, but ever more slowly.

```
gapPx(days) = max(MIN_GAP, √days × K)
MIN_GAP = 44
K = 22
```

| elapsed | spacing |
|---|---|
| 1–3 days | 44px (floor) |
| 7 days | 58px |
| 14 days | 82px |
| 30 days | 120px |
| 90 days | 209px |
| 365 days | 420px |

The floor exists so two moments on consecutive days cannot overlap: 44px is a full row. Its side effect is that gaps under four days are indistinguishable, which is acceptable — "the same few days" is the correct reading.

Two years of fourteen moments comes to roughly 1,800px, four or five screens, every moment reachable by ordinary scrolling.

## 4. Anatomy of a row

Left to right, matching the approved mockup:

- **Date**, day and abbreviated month ("18 Jul"), Karla, `type.caption`, `color.inkMuted`, tabular figures so the column stays aligned. The **year** sits beneath it, smaller and quieter, and only on the row where the year changes — it is a heading for the run of dates below it, not part of any one date. When a row repeats the date above it, **the whole column is blank**: a cluster then reads as one day carrying several moments rather than the same date stamped four times. Both slots keep their space when empty so the dots and titles stay aligned.
- **Dot** on the spine, `color.ink`.
- **Title**, Fraunces — the celebration voice, correct here because the title is the celebration. Resolved through the existing `momentTitle`, so a catalogue milestone reads "They just crawled!" and a custom moment reads verbatim.
- **Thumbnail**, right-aligned, only when the moment has a photo. Uses the existing signed-URL hook.

No note and no age on the row. The spine is the overview; tapping opens the moment detail that already exists.

**Born.** The first row is always the child's birth, drawn from `date_of_birth`, with a dot and no thumbnail. It costs nothing — the date is already stored — and it gives the spine a true origin rather than starting at whatever the parent first logged.

## 5. Rules and gap captions

A proportional spine without a ruler is only a feeling. Two devices give it scale.

**Age rules** — a hairline across the column with a centred label ("1 month old"), at each month boundary through 24 months, then at each birthday. A rule is suppressed when it would fall within 16px of a moment row, so it never crowds one.

24 months is not arbitrary: it is already the corrected-age cutoff and the top of most of the catalogue's ranges, so it is where this app stops thinking in months everywhere else too. Ruling monthly only through year one would leave months 13–23 — a year of real development — with no scale at all.

For a premature baby the rules follow **corrected age**, consistent with the rest of the app, via the existing `childAge`.

**Gap captions — designed, built, and then removed.** The original design named any gap over 21 days with a caption ("7 weeks") to stop an empty stretch reading as absence rather than elapsed time.

Seeing it running against real data killed it, for two reasons:

1. **Redundant.** The rationale assumed the gap would be blank. It is not — the age rules run down it, and they state the elapsed time continuously and more precisely than one caption can.
2. **Actively confusing.** "14 months" (a duration since the previous moment) sat inches from "13 months old" (the child's age), in the same unit, with nothing to tell a reader which was which.

The rules already do the job the caption was invented for. It is gone, along with `formatGap`.

## 6. The toggle

Two Feather glyphs in the existing header beside the `+`: `list` for the current view, `git-commit` for the spine — the latter is a line with a node on it, which is the view it selects.

The active glyph is `color.damson` with a hairline underline; the inactive is `color.inkMuted`. **Not** the mockup's grey segmented control: DESIGN.md rules out pills and specifies selection by underline.

The chosen view persists in AsyncStorage under `timeline-view`. **The list remains the default** — it is the reading view, carrying notes and full-bleed photos; the spine is the overview a parent opts into.

## 7. Rendering

Each row's **height is the gap that follows it**. That keeps the view an ordinary `FlatList` with `getItemLayout`, so virtualisation and O(1) scroll-to-offset survive a five-year timeline, and no absolute positioning is needed. Rules and gap captions render inside the trailing space of the row they follow.

## 8. Structure

| File | Responsibility |
|---|---|
| `src/features/moments/spineLayout.ts` | pure: moments in, positioned rows + rules + captions out |
| `src/features/moments/SpineRow.tsx` | one row: date, dot, title, thumbnail, trailing space |
| `src/features/moments/SpineTimeline.tsx` | the FlatList and its `getItemLayout` |
| `src/features/moments/timelineView.ts` | the persisted list/spine preference |
| `src/app/(app)/(tabs)/index.tsx` | the toggle, and which view to render |

`spineLayout.ts` holds every decision worth testing — the scale curve, the floor, rule placement and suppression, caption thresholds, the Born anchor — and touches nothing that renders. That is the boundary that matters: the maths can be proved without mounting a component.

## 9. Edge cases

- **One moment** — Born plus that moment. Nothing degenerate.
- **No moments** — the spine is not offered; the existing empty state stands.
- **A moment dated before birth** — offset clamps to zero rather than drawing backwards. Possible today, since the date picker does not forbid it.
- **Several moments on one date** — each gets its own row at the 44px floor, ordered as the timeline already orders them.
- **A very long first gap** — a parent who starts logging at eighteen months gets one large captioned gap under Born, which is honest and correctly labelled.

## 10. Testing

**Unit, TDD** — `spineLayout` end to end: the curve at known inputs, the floor, cumulative offsets, rule placement and 16px suppression, the 21-day caption threshold, `formatGap` boundaries, the Born anchor, and the pre-birth clamp.

**Component, RNTL** — a spine of known moments renders the expected dates and titles; a moment with a photo renders a thumbnail and one without does not; tapping a row navigates to that moment.

**Runtime** — verified in the browser against real data: the toggle switches views and survives a reload, clusters visibly tighten, and captioned gaps carry the right interval.

## 11. Deliberate omissions

No zoom or pinch-to-scale: a second scale to reason about, for a view whose entire point is one honest scale. No horizontal orientation. No jump-to-date control until the spine exists and proves it is needed — `getItemLayout` makes it cheap to add later.
