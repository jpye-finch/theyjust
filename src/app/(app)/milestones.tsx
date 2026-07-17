import { useRouter } from 'expo-router';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { childAge, formatChildAge } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import { achievedAgeTexts, useMomentSummaries } from '@/features/milestones/achievements';
import { CATALOGUE, CATEGORY_LABELS, MilestoneCategory } from '@/features/milestones/catalogue';
import { MilestoneRow } from '@/features/milestones/MilestoneRow';
import { color, font, space, type } from '@/theme/tokens';

// Grouping the static catalogue by category depends on nothing per-render, so
// compute it once at import rather than on every render / chip tap.
const SECTIONS = (Object.keys(CATEGORY_LABELS) as MilestoneCategory[]).map((category) => ({
  title: CATEGORY_LABELS[category],
  data: CATALOGUE.filter((e) => e.category === category),
}));

export default function MilestonesScreen() {
  const router = useRouter();
  const { children, selected, select, loading } = useSelectedChild();
  const { data: moments = [] } = useMomentSummaries(selected?.id ?? null);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Who are we celebrating?</Text>
        <Text style={styles.emptyBody}>Add your little one to start their story.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/family')} />
        </View>
      </View>
    );
  }

  const age = childAge(selected.date_of_birth, selected.due_date, new Date());
  const achieved = achievedAgeTexts(moments, selected.date_of_birth);

  return (
    <SectionList
      style={styles.list}
      sections={SECTIONS}
      keyExtractor={(e) => e.id}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={
        <View style={styles.header}>
          {children.length > 1 ? (
            <View style={styles.switcher}>
              {children.map((c) => {
                const isSel = c.id === selected.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => select(c.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSel }}
                    accessibilityLabel={`Show ${c.name}'s milestones`}
                    style={[styles.chip, isSel && styles.chipSelected]}
                  >
                    <Text style={isSel ? styles.chipTextSelected : styles.chipText}>{c.name}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <Text style={styles.childName} accessibilityRole="header">
            {selected.name}
          </Text>
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
  list: { backgroundColor: color.paper },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: space.xl,
    gap: space.md,
    backgroundColor: color.paper,
  },
  emptyTitle: {
    fontFamily: font.display,
    fontSize: 30,
    color: color.ink,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontFamily: font.body,
    fontSize: type.body,
    color: color.inkMuted,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  header: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.md, gap: space.xs },
  switcher: { flexDirection: 'row', gap: space.sm, marginBottom: space.sm, flexWrap: 'wrap' },
  chip: {
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: 999,
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  chipSelected: { backgroundColor: color.damson, borderColor: color.damson },
  chipText: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  chipTextSelected: { fontFamily: font.medium, fontSize: type.label, color: color.onDamson },
  childName: { fontFamily: font.displayBold, fontSize: type.hero, color: color.ink, letterSpacing: -0.5 },
  childAge: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  sectionHeader: {
    fontFamily: font.bold,
    fontSize: type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: color.damson,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    backgroundColor: color.paper,
  },
});
