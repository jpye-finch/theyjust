# Firsts — App Icon & Store Assets Brief

**Status:** brief, awaiting design
**Blocker:** the icon is the only thing standing between the app and submission. Everything else here can follow it.

---

## 1. Where we actually are

Every image in `assets/images/` is Expo scaffold artwork. `icon.png` is the
default chevron-on-blue; the splash is `#208AEF` with the same mark; the Android
adaptive icons are the scaffold's; there is **no notification icon at all**, so
`expo-notifications` currently has nothing to render in the status bar.

Nothing here has been designed. That is the whole of the problem.

| Asset | State | Spec |
| --- | --- | --- |
| iOS app icon | scaffold | 1024×1024 PNG, sRGB or Display P3, **no alpha, no rounded corners** (Apple applies the mask) |
| Android adaptive icon | scaffold | foreground + background + **monochrome** (themed icons), 108dp canvas, 66dp safe zone |
| Notification icon | **missing** | monochrome silhouette on transparent; Android tints it, so shape is all that survives |
| Splash | scaffold | mark on `paper #F9F6F1`, not Expo blue |
| Favicon | scaffold | web export |
| Screenshots | none | 1320×2868 (6.9"), PNG. Exact to the pixel or upload fails |
| Store copy | partial | name + subtitle decided; promo text, description, keywords outstanding |
| Privacy policy URL | **blocked** | needs the domain |
| Support URL | **blocked** | needs the domain |

---

## 2. The identity it has to belong to

Not a fresh start. The visual system is shipped, reviewed, and documented in
`DESIGN.md` / `src/theme/tokens.ts`. The icon joins it.

**"A well-made hardback."** Warm paper, warm near-black ink, one accent.

| Token | Hex | Role |
| --- | --- | --- |
| `paper` | `#F9F6F1` | the page |
| `ink` | `#2A201B` | primary type |
| `damson` | `#833045` | the single accent — deep plum-red: jam, knitted cardigans |
| `rule` | `#E3DFD8` | hairlines |

Type is **Fraunces** (celebration voice, used sparingly) and **Karla**
(functional). Light theme only, by decision: *a parent on the sofa after
bedtime, lamp-lit, one hand free.*

**Positioning:** the milestone memory app that also reassures. Against clinical
screeners, exhausting trackers, and context-free photo journals. Warm and
personal, never loud, never gamified, **never a deadline**.

---

## 3. The icon

### What it has to do

1. **Read at 40pt.** It will spend its life small, on a crowded home screen,
   beside apps with far louder marks. Legibility at that size outranks every
   other consideration, including elegance at 1024.
2. **Survive both wallpapers.** `paper #F9F6F1` is nearly white. An icon that
   uses paper as its field will dissolve into a light wallpaper and look like a
   missing image. **Strong candidate: invert the app — damson as the field,
   paper as the mark.** That gives the icon presence, and claims the colour as
   the brand's before anyone opens the app.
3. **Survive Apple's mask.** Design on a square; nothing meaningful within ~10%
   of any edge.
4. **Hold up without hairlines.** `rule #E3DFD8` is invisible at icon scale.
   Anything drawn from the timeline's fine lines has to thicken substantially.

### Directions worth exploring

The app already has its own visual vocabulary. Take the mark from there rather
than importing one.

**A. The mark of a first** *(recommended)*
A single damson dot on paper — the same dot the spine timeline puts against a
moment, lifted out and made the whole subject. Abstract, ownable, unmistakably
scalable, and it means the exact thing the app is for: *this happened, and it
was noted*. Closest to a logo the product could grow into.

**B. The bookmark**
A ribbon or marker set into a page. Leans on the hardback metaphor, reads as an
object rather than an illustration, and says "kept" rather than "tracked". Warmer
than A, slightly more literal.

**C. The spine**
The vertical rule with one moment marked. Truest to the app's signature view,
but the riskiest at 40pt — fine verticals disappear, and it may read as a
progress bar, which is precisely the wrong idea.

**D. A Fraunces letterform**
An `F` in the display serif. Safe, on-brand, legible. Also what a hundred other
apps do; it identifies the app without saying anything about it. Fallback, not a
first choice.

Explore A and B properly before settling. Do them at 40pt from the start, not
1024 shrunk down.

### Anti-references — hard no

The category has a uniform, and PRODUCT.md already refuses it. The icon is where
it will try hardest to creep back in.

- Baby feet, footprints, handprints
- Teddy bears, prams, rattles, dummies, storks
- Clouds, rainbows, stars, moons — the pastel-nursery kit
- Hearts
- Growth charts, checkmarks, progress rings, percentages — the CDC-screener tell
- Cartoon babies, faces, silhouettes of a parent holding a child
- Gradient blobs and glassy 3-D bevels
- Pale blue / pale pink as gendered defaults
- Sage green, warm cream, soft terracotta — the AI "warm parenting app" palette
  the identity was built to escape

If someone could guess the category from the icon alone, it is doing the same
job as everyone else's.

---

## 4. Everything else

### Notification icon
Currently missing, which means notifications ship with nothing. Android renders
it as a **flat silhouette and discards all colour**, so it must work as pure
shape on transparent. Almost certainly a simplified version of the icon's mark —
another argument for direction A, which reduces to one form.

### Splash
Mark centred on `paper #F9F6F1`. Replace the scaffold's `#208AEF`. Quiet: it is
a held breath, not a title card.

### Screenshots (1320×2868, 6.9")
Six frames, in the order that tells the story rather than the order of the tabs:

1. **The spine timeline** — the thing no competitor has. Lead with it.
2. **A moment with a photograph** — what the app is *for*.
3. **Capture** — how little it asks of you.
4. **Milestones with a range** — "typically emerges between…", the reassurance.
5. **An achieved milestone** — the damson stamp, celebration without scoring.
6. **Family / multiple children** — it grows with you.

Caption each in the product's own voice. Warm plain English, no exclamation
marks, no "Track your baby's development!".

### Store copy
Decided: **`Firsts: Baby Milestones`** (23 chars) · **`Every first, remembered`** (23 chars).

Outstanding:
- **Promotional text** (170 chars) — changeable without review; use it seasonally.
- **Description** (4000 chars) — lead with reassurance, not features. The first
  three lines are all most people read.
- **Keywords** (100 chars, comma-separated, no spaces) — deliberately *not*
  "development", "screening", or "delay". Wrong audience, wrong promise.

### Blocked on the domain
Privacy policy URL and support URL are both required fields at submission.
Neither needs the brand domain specifically — any controlled domain serves, and
`pye-finch.co.uk` would do today if `firsts.baby` is still unsettled.

---

## 5. Definition of done

- [ ] 1024×1024 iOS icon, no alpha, no rounded corners, verified at 40pt
- [ ] Android foreground / background / monochrome
- [ ] Notification icon, monochrome on transparent
- [ ] Splash on paper
- [ ] Favicon
- [ ] `app.json` updated; scaffold artwork deleted from `assets/images/`
- [ ] Six screenshots at 1320×2868
- [ ] Promotional text, description, keywords
- [ ] Privacy policy + support URLs live

---

## 6. One judgement worth recording

The riskiest thing about this brief is that the app's identity is
**typographic and editorial** — it lives in Fraunces, in generous space, in
restraint. None of that survives at 40pt. An icon cannot be quiet and also be
found on a home screen.

So the icon should not try to be a miniature of the app. It should be the one
loud thing the product allows itself: a damson field, a single confident mark,
and nothing else. The restraint is in *how little the mark says*, not in how
softly it says it.
