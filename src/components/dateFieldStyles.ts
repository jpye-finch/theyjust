import { StyleSheet } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';

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
  // iOS's compact picker draws its own control, so it sits on a bare row: the
  // underline underneath it read as a second, empty field.
  nativeRow: { alignItems: 'flex-start', paddingVertical: space.xs },
  // The control's own pill carries leading padding, so it starts a few points
  // right of the labels above it. The offset pulls it back to the same margin.
  nativePicker: { alignSelf: 'flex-start', marginLeft: -space.xs },
  value: { fontFamily: font.body, fontSize: type.body, color: color.ink },
  placeholder: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted },
});
