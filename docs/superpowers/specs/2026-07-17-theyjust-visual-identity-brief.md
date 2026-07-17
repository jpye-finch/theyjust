# TheyJust Visual Identity — Confirmed Design Brief

**Date:** 2026-07-17
**Status:** Confirmed by Jonathan (with amendment: audience is US/UK/Europe, not UK-only)
**Process:** impeccable shape flow; PRODUCT.md is the strategic anchor. The old
Figma file (sage/cream/terracotta, Bricolage Grotesque) is the anti-reference.

## Feature summary

A new visual identity applied directly to the shipped Expo screens (sign-in,
Family, Milestones now; Timeline/capture inherit in Plan 3). It must feel chosen
by a person with taste: tender, unhurried, quietly joyful — a hand-made baby
book, not a generated parenting app.

## Primary user action

Read your child's story and feel two things instantly: *this moment is
celebrated* and *everything is normal*. Every visual decision serves the words.

## Design direction

- **Lane: the well-made children's hardback.** Not childish, not pastel — the
  confident print warmth of a book kept for twenty years. Anchors: Persephone
  Books (dove-grey jackets, chosen-object domesticity), Papier (stationery
  warmth, type-led product pages), vintage Ladybird hardbacks (print-era
  confidence, zero nursery cliché). Anchors are aesthetic provenance, not a
  market lock — the product reads naturally in the US, UK, and Europe.
- **Colour strategy: Restrained**, around a new axis: warm paper (barely-tinted
  ivory — NOT the stock cream), near-black ink for type, and one unexpected
  accent: **damson** (deep plum-red; jam, hand-knitted cardigans). Achieved
  milestones read as ink-stamped (damson tick + age), never green badges. No
  green, no terracotta, no sage anywhere.
- **Theme scene:** a parent on the sofa after bedtime, lamp-lit, one hand free,
  adding tonight's moment before it blurs → warm, low-glare paper LIGHT theme.
  True dark mode is a Plan 3+ item.
- **Type: Fraunces + Karla** (Google Fonts, Expo-loadable). Fraunces only for
  the celebration voice ("They just rolled over!", child names, emotional
  moments). Karla for all functional UI. The serif/sans split IS the brand.

## Scope

Production-ready, in the real app code (Figma updated from reality afterwards).
Whole surface: all Plan 2 screens + auth. Runs as a dedicated design-pass task
after Plan 2 Task 9, verified in the browser.

## Layout strategy

Kill card monotony: list-led, rule-divided pages like a book's index — hairline
ink rules, generous margins, no boxes around everything. Hierarchy through type
scale, not containers. Milestone rows read as a table of contents; achieved rows
get the damson stamp. Empty states and celebrations get full-width Fraunces
type doing the emotional work.

## Key states

As built: empty (no child — the warmest screen in the app), loading, form
errors (live-region pattern), achieved / typical-range / gentle-signpost rows,
skippable suppression, corrected-age display.

## Interaction model

Unchanged from shipped flows — reskin with structural cleanup, not a UX rework.
Targets ≥44pt; primary actions in thumb reach.

## Content requirements

Shipped, reviewed copy is canonical (verbPhrase composition, range phrasing).
One internationalisation change rides with this pass: `SIGNPOST_TEXT` becomes
"Every child is different — if you have questions, your child's doctor or
health visitor is the right person to ask." (update its test, and audit
catalogue context lines for any market-locked phrasing).

## Open questions (resolved during build)

Exact damson/ink/paper OKLCH values and Fraunces optical-size settings tuned
against real screens with WCAG AA contrast checks.
