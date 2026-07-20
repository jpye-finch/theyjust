import { StyleSheet } from 'react-native';
import { color, font, radius, space, type } from '@/theme/tokens';

// Shared by DateField.tsx (native) and DateField.web.tsx so the two platform
// implementations cannot drift apart visually. Matches Field's book-form look:
// a small Karla label over an underlined value, no box.
export const dateFieldStyles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: {
    fontFamily: font.medium,
    fontSize: type.caption,
    color: color.inkMuted,
    letterSpacing: 0.3,
  },
  input: {
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: color.rule,
  },
  // The calendar opens over the page rather than unfolding a month grid inside
  // the form, which pushed everything below it out of reach.
  backdrop: { flex: 1, backgroundColor: 'rgba(42,32,27,0.28)' },
  panel: {
    backgroundColor: color.paper,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // paddingBottom comes from the safe-area inset at the call site.
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  value: { fontFamily: font.body, fontSize: type.body, color: color.ink },
  placeholder: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted },
});
