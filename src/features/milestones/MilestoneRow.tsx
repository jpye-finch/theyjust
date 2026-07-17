import { StyleSheet, Text, View } from 'react-native';
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
    return (
      <View style={styles.row}>
        <Text style={styles.titleAchieved}>{`✓ ${entry.title}`}</Text>
        <Text style={styles.subtitle}>{`At ${status.ageText}`}</Text>
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
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    gap: 2,
  },
  title: { fontSize: 16, fontWeight: '600' },
  titleAchieved: { fontSize: 16, fontWeight: '600', color: '#1a7f37' },
  subtitle: { fontSize: 14, color: '#555' },
  signpost: { fontSize: 13, color: '#777', fontStyle: 'italic', marginTop: 4 },
});
