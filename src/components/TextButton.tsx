import { Pressable, StyleSheet, Text } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'muted';
};

// A quiet secondary action: damson (accent) or inkMuted (muted) text, no fill.
export function TextButton({ label, onPress, tone = 'accent' }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      hitSlop={space.sm}
      style={({ pressed }) => [styles.base, pressed && styles.pressed]}
    >
      <Text style={[styles.label, tone === 'muted' && styles.muted]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingVertical: space.sm, alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  label: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  muted: { color: color.inkMuted },
});
