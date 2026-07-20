# Firsts — Icon System Design

**Status:** approved, ready for implementation
**Scope:** the icon system only. Screenshots and store copy from
`2026-07-20-firsts-brand-assets-brief.md` are deliberately out of scope and get
their own cycles.
**Supersedes:** section 3 of the brand assets brief, which recommended
direction A. See §7 for why that recommendation was overturned.

---

## 1. The decision

The icon is **B′ — the bookmark, marked**: a paper ribbon set into a damson
field, with the timeline's dot knocked out of it.

The brief recommended direction A (a bare paper dot on damson) on the grounds
that it "reduces to one form". That reduction is real but it is a liability, not
an asset. The Android notification icon is a flat silhouette with *all colour
discarded* — and in direction A, the damson field is the entire identity. What
survives the reduction is an anonymous filled circle, indistinguishable from a
system dot indicator in the status bar.

B′ keeps a distinguishable shape in every reduction. The dot stops the bookmark
from reading as a generic save affordance and ties it to the app's own
vocabulary: the spine timeline draws a 1px ink rule with a 9px ink dot on it
(`src/features/moments/SpineRow.tsx`). The icon is that dot, kept.

**Accepted cost:** a bookmark is a borrowed form, and at 40pt the dot is roughly
3px — present, but doing less work than at 1024. Judged worth it for a mark that
holds up on the status bar.

Anti-references from the brief §3 are all respected: no feet, no bears, no
pastel-nursery kit, no hearts, no progress rings, no gradients, no sage or
terracotta. The category is not guessable from the icon alone.

---

## 2. The master geometry

Defined once on a 1024×1024 canvas. Every other asset derives from it.

| Element | Value |
| --- | --- |
| Field | `damson #833045`, full bleed |
| Ribbon | `paper #F9F6F1`, path `M362,0 L662,0 L662,740 L512,624 L362,740 Z` |
| Dot | `damson #833045`, `cx 512`, `cy 372`, `r 74` |

The ribbon bleeds off the **top** edge deliberately — the page continues above,
the marker is set into it. Nothing meaningful sits within 10% of any other edge,
so Apple's mask is safe.

Only three colours appear anywhere in the system, all from `src/theme/tokens.ts`:
`#833045`, `#F9F6F1`, and pure white (monochrome surfaces only).

No hairlines, no type, no third element. `rule #E3DFD8` is invisible at icon
scale and appears nowhere.

---

## 3. Derived assets

All coordinates below are exact and are the implementation contract.

### 3.1 iOS app icon — `assets/images/icon.png`
Master, unmodified, full bleed. **1024×1024, sRGB, no alpha channel, square
corners** (Apple applies the mask). Rasterise with the field flattened so no
alpha channel is written at all.

### 3.2 Android foreground — `assets/images/android-icon-foreground.png`
**432×432** (4× the 108dp canvas). The safe zone is a 264px circle centred at
`(216,216)`; the mark is scaled to **96×237** and centred inside it, with
**no bleed** — OEM masks vary far more than Apple's, and a ribbon running off the
top gets cut at an arbitrary angle by a circular mask.

- Ribbon: `paper #F9F6F1`, path `M168,98 L264,98 L264,335 L216,298 L168,335 Z`
- Dot: `damson #833045`, `cx 216`, `cy 216`, `r 24`
- Canvas: **transparent** (`adaptiveIcon.backgroundColor` supplies the field)

The scale is set by the bounding box's half-diagonal, which must fit inside the
safe radius: `hypot(48,118) = 127.4`, leaving ~4px of margin for antialiasing.

> **Correction.** This section originally specified a `1/3` scale — ribbon
> `M166,92 …` with `r 25`. That geometry is wrong and was never shipped: its
> corners sit 132.8–133.7px from centre, **outside** the 132px safe circle this same
> document mandates in §7.5, so it would have failed its own guarantee and been
> clipped by a circular OEM mask. Caught during plan review and corrected before
> implementation. Do not "restore" the original numbers.

### 3.3 Android background — none
`android.adaptiveIcon.backgroundColor` is set to `#833045` and
`backgroundImage` is **removed**. A flat colour needs no PNG, and this sidesteps
the "must have the same dimensions as foregroundImage" constraint entirely.
`assets/images/android-icon-background.png` is deleted.

### 3.4 Android monochrome — `assets/images/android-icon-monochrome.png`
**432×432**, transparent. Pure white ribbon, geometry identical to §3.2,
**with no dot**. See §4 for why the dot is dropped.

### 3.5 Notification icon — `assets/images/notification-icon.png`
**96×96**, transparent, pure white, per the expo-notifications requirement of a
"96x96 all-white png with transparency". Inset to the 72×72 content box:

- Ribbon: `#FFFFFF`, path `M33,12 L62,12 L62,84 L47.5,73 L33,84 Z`

No dot. New file — this asset does not currently exist, which is why
notifications ship with nothing to render.

### 3.6 Splash — `assets/images/splash-icon.png`
**1024×1024**, transparent canvas. The mark **inverts** here: the damson field is
dropped, the ribbon is drawn in `damson #833045`, and the dot is a *transparent
hole* rather than a damson fill — so the paper background reads through it.
(Drawing the dot in damson on a damson ribbon would make it invisible.)
Master ribbon geometry, unscaled. Configured with `backgroundColor: "#F9F6F1"`
and `imageWidth: 240`, which renders the ribbon at ~70pt.

### 3.7 Favicon — `assets/images/favicon.png`
**196×196**, master scaled. Alpha permitted.

---

## 4. Two judgement calls, recorded

**The dot disappears in both monochrome surfaces.** At 432px it could be knocked
through as a transparent hole, but at 96px a ~3px hole fills in during
rasterisation and antialiasing. Shipping a dotted silhouette at one size and a
plain one at the other would mean two marks. Both use the plain ribbon instead:
one shape, no ambiguity.

**Android drops the bleed** (§3.2), so the Android foreground is a genuinely
different composition from the iOS art rather than a resize. This is intended,
not drift.

---

## 5. Build pipeline

The icon is source, not a binary blob.

- **`assets/brand/*.svg`** — hand-authored SVG sources, one per composition
  (`icon`, `android-foreground`, `android-monochrome`, `notification`, `splash`).
  These are the editable truth; change a hex here and rebuild.
- **`scripts/build-brand-assets.mjs`** — Node script shelling out to ImageMagick
  (`magick`, already present at `/opt/homebrew/bin/magick`) to rasterise each
  source to its target size and colour profile.
- **`package.json`** — `"brand:build"` script.

Both the SVG sources and the generated PNGs are committed; builds must not
depend on ImageMagick being installed.

**Delegate risk:** ImageMagick's SVG rendering depends on an `rsvg` delegate.
The first implementation step verifies a rendered SVG matches its geometry. If
the delegate is unavailable or renders unfaithfully, fall back to composing the
shapes with `magick -draw` primitives (`polygon`, `circle`) — the geometry is
simple enough that this is a complete substitute, and the SVG sources remain as
the human-readable reference.

---

## 6. Config changes — `app.json`

| Field | From | To |
| --- | --- | --- |
| `ios.icon` | `"./assets/expo.icon"` | **removed** — inherits the top-level 1024 PNG |
| `android.adaptiveIcon.backgroundColor` | `#E6F4FE` | `#833045` |
| `android.adaptiveIcon.backgroundImage` | scaffold PNG | **removed** |
| `expo-splash-screen.backgroundColor` | `#208AEF` | `#F9F6F1` |
| `expo-splash-screen.imageWidth` | `76` | `240` |
| `expo-notifications.icon` | absent | `./assets/images/notification-icon.png` |

`ios.icon` also accepts an object of `light`/`dark`/`tinted` variants or an
Icon Composer `.icon` bundle. Both are deliberately declined: a single opaque
1024 PNG is universally accepted and cannot fail submission. Appearance variants
are a later enhancement, not a blocker.

### Scaffold artwork deleted
Confirmed unreferenced anywhere in `src/` or `app/`:
`expo-badge.png`, `expo-badge-white.png`, `expo-logo.png`, `react-logo.png`,
`react-logo@2x.png`, `react-logo@3x.png`, `logo-glow.png`, `tutorial-web.png`,
`android-icon-background.png`, and the `assets/expo.icon/` bundle.

Implementation must re-confirm the top-level `icon.png` is referenced only from
`app.json` before overwriting it — the earlier grep for `icon` matched unrelated
identifiers (`tabIcons`, `iconName`) across several components.

---

## 7. Verification

Asserted programmatically, not by eye:

1. Every output file exists at its **exact** pixel dimensions (§3).
2. `icon.png` has **no alpha channel** — a common App Store rejection.
3. `android-icon-monochrome.png` and `notification-icon.png` **do** have alpha,
   and contain only white and transparent pixels.
4. Every colour in every output is `#833045`, `#F9F6F1`, or white — no stray
   antialiasing artefacts introducing off-palette colours at sampled points.
5. The Android foreground's opaque bounds fall entirely inside the 264px safe
   circle.
6. `npx expo config --type prebuild` resolves without error and every asset path
   in `app.json` points at a file that exists.

Followed by a render of the finished set at 40pt on light and dark wallpaper for
human judgement — the one test that cannot be automated.

---

## 8. Definition of done

- [ ] SVG sources authored in `assets/brand/`
- [ ] Build script and `brand:build` npm script
- [ ] iOS 1024 icon, no alpha, verified at 40pt
- [ ] Android foreground + monochrome; background is a colour
- [ ] Notification icon, 96×96 white on transparent
- [ ] Splash on paper
- [ ] Favicon
- [ ] `app.json` updated per §6
- [ ] Scaffold artwork deleted
- [ ] All §7 assertions passing

Out of scope, tracked in the brand assets brief: six screenshots at 1320×2868,
promotional text, description, keywords, and the two domain-blocked URLs.
