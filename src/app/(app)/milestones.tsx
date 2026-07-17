import { Link } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { childAge, formatChildAge } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import { achievedAgeTexts, useMomentSummaries } from '@/features/milestones/achievements';
import { CATALOGUE, CATEGORY_LABELS, MilestoneCategory } from '@/features/milestones/catalogue';
import { MilestoneRow } from '@/features/milestones/MilestoneRow';

export default function MilestonesScreen() {
  const { children, selected, select, loading } = useSelectedChild();
  const { data: moments = [] } = useMomentSummaries(selected?.id ?? null);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Who are we celebrating?</Text>
        <Text style={styles.emptyBody}>Add your child to see their milestones.</Text>
        <Link href="/family" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>Add your child</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  const age = childAge(selected.date_of_birth, selected.due_date, new Date());
  const achieved = achievedAgeTexts(moments, selected.date_of_birth);
  const sections = (Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((category) => ({
    title: CATEGORY_LABELS[category],
    data: CATALOGUE.filter((e) => e.category === category),
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(e) => e.id}
      ListHeaderComponent={
        <View style={styles.header}>
          {children.length > 1 ? (
            <View style={styles.switcher}>
              {children.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => select(c.id)}
                  style={[styles.chip, c.id === selected.id && styles.chipSelected]}
                >
                  <Text style={c.id === selected.id ? styles.chipTextSelected : styles.chipText}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={styles.childName}>{selected.name}</Text>
          <Text style={styles.childAge}>{formatChildAge(age)}</Text>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item }) => (
        <MilestoneRow
          entry={item}
          comparisonMonths={age.comparisonMonths}
          achievedAgeText={achieved[item.id] ?? null}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyBody: { fontSize: 15, color: '#555', marginBottom: 12 },
  button: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  header: { padding: 16, gap: 4 },
  switcher: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: '#1a1a2e',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  chipSelected: { backgroundColor: '#1a1a2e' },
  chipText: { color: '#1a1a2e' },
  chipTextSelected: { color: 'white' },
  childName: { fontSize: 24, fontWeight: '800' },
  childAge: { fontSize: 15, color: '#555' },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#888',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
