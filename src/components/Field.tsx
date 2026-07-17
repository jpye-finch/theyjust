import { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';

type Props = TextInputProps & {
  label: string;
};

// A book-form field: a small Karla label over an underlined input — no box.
// The underline warms to damson on focus, the only moving colour on the page.
export function Field({ label, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.inkMuted}
        selectionColor={color.damson}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[styles.input, { borderBottomColor: focused ? color.damson : color.rule }, style]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: {
    fontFamily: font.medium,
    fontSize: type.caption,
    color: color.inkMuted,
    letterSpacing: 0.3,
  },
  input: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.ink,
    paddingVertical: space.sm,
    borderBottomWidth: 1.5,
  },
});
