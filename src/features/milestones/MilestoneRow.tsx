import { StyleSheet, Text, View } from 'react-native';
import { color, font, space, type } from '@/theme/tokens';
import type { CatalogueEntry } from './catalogue';
import { milestoneStatus } from './rangePhrase';

type Props = {
  entry: CatalogueEntry;
  comparisonMonths: number;
  achievedAgeText: string | null;
};

export function MilestoneRow({ entry, comparisonMonths, achievedAgeText }: Props) {
  const status = milestoneStatus(entry, comparisonMonths, achievedAgeText);

  if (status.kind === 'achieved') {
    // An achieved first reads as ink-stamped: damson type on a faint damson wash.
    return (
      <View style={[styles.row, styles.rowAchieved]}>
        <Text style={styles.titleAchieved}>{`✓ ${entry.title}`}</Text>
        <Text style={styles.ageAchieved}>{`At ${status.ageText}`}</Text>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{entry.title}</Text>
      <Text style={styles.subtitle}>{status.text}</Text>
      {status.kind === 'range-with-signpost' ? (
        <Text style={styles.signpost}>{status.signpost}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: color.rule,
    gap: space.xs,
    backgroundColor: color.paper,
  },
  rowAchieved: { backgroundColor: color.damsonSoft, borderBottomColor: color.paper },
  title: { fontFamily: font.medium, fontSize: type.body, color: color.ink },
  titleAchieved: { fontFamily: font.bold, fontSize: type.body, color: color.damson },
  subtitle: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  ageAchieved: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  signpost: {
    fontFamily: font.serifItalic,
    fontSize: type.label,
    color: color.inkMuted,
    marginTop: space.xs,
    lineHeight: 21,
  },
});
