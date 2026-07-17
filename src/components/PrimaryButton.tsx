import { Pressable, StyleSheet, Text } from 'react-native';
import { color, font, radius, space, type } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
};

// The one filled element on any screen: a damson block with paper-white type.
export function PrimaryButton({ label, onPress, busy }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}
    >
      <Text style={styles.label}>{busy ? '…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: color.damson,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  pressed: { opacity: 0.85 },
  label: {
    fontFamily: font.bold,
    fontSize: type.body,
    color: color.onDamson,
    letterSpacing: 0.2,
  },
});
