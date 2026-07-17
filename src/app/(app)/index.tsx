import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/useSession';
import { useSelectedChild } from '@/features/children/selectedChild';
import { MomentCard } from '@/features/moments/MomentCard';
import { useTimeline, type Moment } from '@/features/moments/momentQueries';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { color, font, space, type } from '@/theme/tokens';

function useFirstPhotoUrls(moments: Moment[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        moments.map(async (m) => {
          const first = [...m.moment_photos].sort((a, b) => a.position - b.position)[0];
          if (!first) return null;
          const url = await signedPhotoUrl(first.storage_path);
          return url ? ([m.id, url] as const) : null;
        }),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries.filter(Boolean) as [string, string][]));
    })();
    return () => {
      cancelled = true;
    };
  }, [moments]);
  return urls;
}

export default function TimelineScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { selected, loading } = useSelectedChild();
  const { data: moments = [] } = useTimeline(selected?.id ?? null);
  const photoUrls = useFirstPhotoUrls(moments);

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Their story starts here</Text>
        <Text style={styles.emptyBody}>Add your little one, then capture their firsts.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/family')} />
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={moments}
      keyExtractor={(m) => m.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>TheyJust</Text>
            <Text style={styles.childLine}>{`${selected.name}'s story`}</Text>
          </View>
          <Pressable
            onPress={() => router.push('/capture')}
            accessibilityRole="button"
            accessibilityLabel="Capture a moment"
            style={styles.add}
          >
            <Text style={styles.addPlus}>+</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.feedEmpty}>
          <Text style={styles.feedEmptyTitle}>No moments yet</Text>
          <Text style={styles.feedEmptyBody}>Tap + to capture their first, or start from Milestones.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable onPress={() => router.push(`/moment/${item.id}`)}>
          <MomentCard
            moment={item}
            childDateOfBirth={selected.date_of_birth}
            loggedByYou={item.logged_by === session?.user.id}
            photoUrl={photoUrls[item.id] ?? null}
          />
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { backgroundColor: color.paper },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.md,
  },
  brand: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.5 },
  childLine: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlus: { fontFamily: font.body, fontSize: 28, color: color.onDamson, lineHeight: 32 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: color.paper },
  emptyTitle: { fontFamily: font.display, fontSize: 30, color: color.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, textAlign: 'center', marginBottom: space.sm },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  feedEmpty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  feedEmptyTitle: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  feedEmptyBody: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, textAlign: 'center' },
});
