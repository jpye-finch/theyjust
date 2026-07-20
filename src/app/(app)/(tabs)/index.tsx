import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useSession } from '@/features/auth/useSession';
import { useSelectedChild } from '@/features/children/selectedChild';
import { MomentCard } from '@/features/moments/MomentCard';
import { useTimeline, type Moment } from '@/features/moments/momentQueries';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { SpineTimeline } from '@/features/moments/SpineTimeline';
import { TimelineHeader } from '@/features/moments/TimelineHeader';
import { useTimelineView } from '@/features/moments/timelineView';
import { color, font, space, type } from '@/theme/tokens';

// useTimeline returns `data: undefined` while loading and whenever it is disabled
// (no child selected). Falling back to a fresh `[]` on every render would hand
// useFirstPhotoUrls a new dependency each render and spin its always-setState
// effect without end on the empty state. One shared reference keeps it stable.
const NO_MOMENTS: Moment[] = [];

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
  const { children, selected, select, loading } = useSelectedChild();
  const { data } = useTimeline(selected?.id ?? null);
  const moments = data ?? NO_MOMENTS;
  const photoUrls = useFirstPhotoUrls(moments);
  const { view, setView } = useTimelineView();

  if (loading) return null;

  if (!selected) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>Their story starts here</Text>
        <Text style={styles.emptyBody}>Add your little one, then capture their firsts.</Text>
        <View style={styles.emptyButton}>
          <PrimaryButton label="Add your child" onPress={() => router.push('/child')} />
        </View>
      </View>
    );
  }

  const header = (
    <TimelineHeader
      childrenList={children}
      selected={selected}
      onSelectChild={select}
      // Straight to the form. Sending them to the Family tab only put the same
      // decision one more tap away — and once the form became a sheet with its
      // own route, there was nothing left on that tab to land on.
      onAddChild={() => router.push('/child')}
      view={view}
      onSelectView={setView}
      onCapture={() => router.push('/capture')}
    />
  );

  if (view === 'spine' && moments.length > 0) {
    return (
      <View style={styles.screen}>
        {header}
        <SpineTimeline
          dateOfBirth={selected.date_of_birth}
          dueDate={selected.due_date}
          moments={moments}
          photoUrls={photoUrls}
          onOpenMoment={(id) => router.push(`/moment/${id}`)}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {header}
      <FlatList
        style={styles.list}
        data={moments}
        keyExtractor={(m) => m.id}
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  list: { backgroundColor: color.paper },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: space.xl, gap: space.md, backgroundColor: color.paper },
  emptyTitle: { fontFamily: font.display, fontSize: 30, color: color.ink, textAlign: 'center', letterSpacing: -0.3 },
  emptyBody: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, textAlign: 'center', marginBottom: space.sm },
  emptyButton: { alignSelf: 'stretch', paddingHorizontal: space.xl },
  feedEmpty: { padding: space.xl, alignItems: 'center', gap: space.sm },
  feedEmptyTitle: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  feedEmptyBody: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted, textAlign: 'center' },
});
