// TheyJust visual identity — the "well-made hardback" lane (see
// docs/superpowers/specs/2026-07-17-theyjust-visual-identity-brief.md).
// Colours were authored in OKLCH and converted to sRGB hex (React Native has no
// oklch()); every text pairing was checked for WCAG AA before being locked here.
// Damson is the one unexpected accent — deep plum-red (jam, knitted cardigans),
// unguessable from "baby app". No sage, no terracotta, no mint anywhere.

export const color = {
  paper: '#F9F6F1', // warm barely-tinted ivory — the page
  paperRaise: '#F1ECE4', // a shade deeper — pressed/selected surfaces
  ink: '#2A201B', // warm near-black — primary type (14.75:1 on paper)
  inkMuted: '#645A54', // secondary type, captions (6.22:1 on paper)
  rule: '#E3DFD8', // hairline rules, the book-index divider
  damson: '#833045', // the accent — achieved stamps, primary actions (7.87:1)
  damsonSoft: '#FBE0E2', // pale damson wash behind an achieved milestone
  onDamson: '#FCFAF6', // type on a damson fill (8.14:1)
} as const;

// Fraunces (soft characterful serif) carries the celebration voice only —
// child names, "They just …!", section moments. Karla (quiet humanist sans)
// does all functional work. The serif/sans split IS the brand.
export const font = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  serifItalic: 'Fraunces_500Medium_Italic',
  body: 'Karla_400Regular',
  medium: 'Karla_500Medium',
  bold: 'Karla_700Bold',
} as const;

// Type scale — steps keep a ≥1.25 ratio so hierarchy reads without heavy weight.
export const type = {
  hero: 34,
  display: 26,
  title: 20,
  body: 16,
  label: 15,
  caption: 13,
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  pill: 999,
} as const;

export const hairline = { borderBottomWidth: 1, borderBottomColor: color.rule } as const;
