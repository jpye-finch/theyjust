import { StyleSheet, Text, View } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';

// The rule-word-rule seam between Apple's button and the email form. Identical
// on sign-in and sign-up, so it lives here once instead of twice.
export function OrDivider() {
  return (
    <View style={styles.row}>
      <View style={styles.rule} />
      <Text style={styles.text}>or</Text>
      <View style={styles.rule} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rule: { flex: 1, height: 1, backgroundColor: color.rule },
  text: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
});
