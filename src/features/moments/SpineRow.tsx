import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatShortDate } from '@/lib/date';
import { color, font, radius, space, type } from '@/theme/tokens';
import { ROW_HEAD, type SpineRow as Row } from './spineLayout';

type Props = {
  row: Row;
  photoUrl: string | null;
  onPress: () => void;
};

const DOT_SIZE = 9;
const SPINE_LEFT = 74;

export function SpineRow({ row, photoUrl, onPress }: Props) {
  const openable = row.momentId !== null;
  return (
    // The row's height IS the gap that follows it, so the empty stretch below
    // the head is the elapsed time, and the rules and caption live inside it.
    <View style={[styles.row, { height: row.height }]}>
      <View style={styles.spine} />

      {row.rules.map((rule) => (
        <View key={rule.label} style={[styles.rule, { top: rule.offset }]}>
          <View style={styles.ruleLine} />
          <Text style={styles.ruleLabel}>{rule.label}</Text>
          <View style={styles.ruleLine} />
        </View>
      ))}

      {row.gapCaption ? (
        <Text style={[styles.caption, { top: row.gapCaption.offset }]}>{row.gapCaption.label}</Text>
      ) : null}

      <Pressable
        style={styles.head}
        onPress={openable ? onPress : undefined}
        disabled={!openable}
        accessibilityRole={openable ? 'button' : undefined}
      >
        <Text style={styles.date}>{formatShortDate(row.date)}</Text>
        <View style={styles.dot} />
        <Text style={styles.title} numberOfLines={2}>
          {row.title}
        </Text>
        {photoUrl ? (
          <Image
            testID="spine-thumb"
            accessible={false}
            source={{ uri: photoUrl }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { position: 'relative' },
  spine: {
    position: 'absolute',
    left: SPINE_LEFT,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: color.ink,
    opacity: 0.35,
  },
  // ROW_HEAD, not a local 44: the layout module suppresses rules that would fall
  // inside this head, so the two must never drift apart.
  head: { flexDirection: 'row', alignItems: 'center', height: ROW_HEAD, paddingRight: space.lg },
  date: {
    width: 64,
    textAlign: 'right',
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    // Tabular figures keep the date column from shuffling as the digits change.
    fontVariant: ['tabular-nums'],
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: color.ink,
    marginLeft: SPINE_LEFT - 64 - DOT_SIZE / 2,
  },
  title: {
    flex: 1,
    marginLeft: space.md,
    fontFamily: font.display,
    fontSize: type.label,
    color: color.ink,
  },
  thumb: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: color.paperRaise },
  rule: { position: 'absolute', left: 0, right: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ruleLine: { flex: 1, height: 1, backgroundColor: color.rule },
  ruleLabel: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted },
  caption: {
    position: 'absolute',
    left: SPINE_LEFT + space.md,
    fontFamily: font.body,
    fontSize: type.caption,
    color: color.inkMuted,
    fontStyle: 'italic',
  },
});
