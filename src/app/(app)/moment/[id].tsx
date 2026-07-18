import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { ageParts, formatAgeParts } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import {
  useDeleteMoment,
  useTimeline,
  type Moment,
} from '@/features/moments/momentQueries';
import { momentTitle } from '@/features/moments/momentText';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { ShareCard } from '@/features/moments/ShareCard';
import { shareMomentCard } from '@/features/moments/shareMoment';
import { formatDisplayDate } from '@/lib/date';
import { confirmDestructive, notify } from '@/lib/dialog';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function MomentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected } = useSelectedChild();
  const { data: moments = [], isLoading } = useTimeline(selected?.id ?? null);
  const deleteMoment = useDeleteMoment(selected?.id ?? '');
  const moment = moments.find((m) => m.id === id) as Moment | undefined;

  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const shareRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    const first = moment ? [...moment.moment_photos].sort((a, b) => a.position - b.position)[0] : null;
    if (!first) {
      setPhotoUrl(null);
      return;
    }
    signedPhotoUrl(first.storage_path).then((u) => {
      if (!cancelled) setPhotoUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [moment]);

  // Distinguish "still loading" (cold deep-link, cache empty) from "truly gone".
  if (selected && isLoading) {
    return <View style={styles.screen} />;
  }

  if (!moment || !selected) {
    return (
      <View style={styles.screen}>
        <Text style={styles.notFound}>This moment is no longer here.</Text>
        <TextButton label="Back to Timeline" onPress={() => router.replace('/')} />
      </View>
    );
  }

  const ageText = formatAgeParts(ageParts(selected.date_of_birth, moment.occurred_on));

  const confirmDelete = () =>
    confirmDestructive('Delete this moment?', 'This cannot be undone.', 'Delete', () =>
      deleteMoment.mutate(moment.id, {
        onSuccess: () => router.replace('/'),
        onError: (e) =>
          notify('Could not delete', e instanceof Error ? e.message : 'Please try again.'),
      }),
    );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <TextButton label="Back" onPress={() => router.back()} tone="muted" />
        <TextButton
          label="Edit"
          onPress={() => router.push({ pathname: '/capture', params: { momentId: moment.id } })}
        />
      </View>
      {/* Same rule as the timeline card: the words lead, the plate follows. */}
      <Text style={styles.title}>{momentTitle(moment)}</Text>
      <Text style={styles.meta}>{`${formatDisplayDate(moment.occurred_on)} · ${ageText}`}</Text>
      {photoUrl ? (
        <Image accessible={false} source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : null}

      {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
      <View style={styles.actions}>
        <TextButton label="Share this memory" onPress={() => shareMomentCard(shareRef)} />
        <TextButton label="Delete moment" onPress={confirmDelete} tone="muted" />
      </View>
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareRef} title={momentTitle(moment)} ageLine={`at ${ageText}`} photoUrl={photoUrl} />
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: color.paperRaise },
  title: { fontFamily: font.displayBold, fontSize: type.hero, color: color.ink, letterSpacing: -0.5 },
  meta: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, lineHeight: 24, marginTop: space.sm },
  actions: { marginTop: space.xl, borderTopWidth: 1, borderTopColor: color.rule, paddingTop: space.lg },
  notFound: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, padding: space.xl },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
