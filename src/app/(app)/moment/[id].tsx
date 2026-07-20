import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { ageParts, formatAgeParts } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import {
  useDeleteMoment,
  useTimeline,
  type Moment,
  type MomentPhoto,
} from '@/features/moments/momentQueries';
import { momentTitle } from '@/features/moments/momentText';
import { byPosition, useSignedUrls } from '@/features/moments/useSignedUrls';
import { ShareCard } from '@/features/moments/ShareCard';
import { shareMomentCard } from '@/features/moments/shareMoment';
import { formatDisplayDate } from '@/lib/date';
import { confirmDestructive, notify } from '@/lib/dialog';
import { color, font, radius, space, type } from '@/theme/tokens';

const NO_PHOTOS: MomentPhoto[] = [];

export default function MomentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected } = useSelectedChild();
  const { data: moments = [], isLoading } = useTimeline(selected?.id ?? null);
  const deleteMoment = useDeleteMoment(selected?.id ?? '');
  const moment = moments.find((m) => m.id === id) as Moment | undefined;

  const shareRef = useRef<View>(null);

  // This screen is where a parent has come to LOOK, so it shows every photo
  // rather than the feed's single plate. A vertical stack, not a carousel: a
  // horizontal pager inside a ScrollView fights the scroll gesture, and photos
  // reading down the page is the book idiom the rest of the app follows.
  const photos = moment ? byPosition(moment.moment_photos) : NO_PHOTOS;
  const photoUrls = useSignedUrls(photos);
  // The share card is a single composed image, so it keeps the lead photo.
  const leadPhotoUrl = photos.length > 0 ? (photoUrls[photos[0].id] ?? null) : null;

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
      {/* "Close", not "Back": this is a sheet you dismiss, not a page you
          retreat from — and the grabber above says the same thing. */}
      <View style={styles.headerRow}>
        <TextButton label="Close" onPress={() => router.back()} tone="muted" />
        <TextButton
          label="Edit"
          onPress={() => router.push({ pathname: '/capture', params: { momentId: moment.id } })}
        />
      </View>
      {/* Same rule as the timeline card: the words lead, the plate follows. */}
      <Text style={styles.title}>{momentTitle(moment)}</Text>
      <Text style={styles.meta}>{`${formatDisplayDate(moment.occurred_on)} · ${ageText}`}</Text>
      {photos.map((photo) => {
        const url = photoUrls[photo.id];
        // Show each photo at its OWN shape. The feed crops to a uniform 4:3 to
        // keep its rhythm, but here that quietly hid most of a portrait phone
        // photo. We already store the dimensions, so the plate can fit the
        // picture instead of the picture fitting the plate.
        const ratio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
        return (
          <Image
            key={photo.id}
            testID="moment-photo"
            accessible={false}
            // The empty plate holds each photo's place while its signed URL
            // resolves, so the page does not jump as they arrive one by one.
            source={url ? { uri: url } : undefined}
            style={[styles.photo, { aspectRatio: ratio }]}
            resizeMode="cover"
          />
        );
      })}

      {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
      <View style={styles.actions}>
        <TextButton label="Share this memory" onPress={() => shareMomentCard(shareRef)} />
        <TextButton label="Delete moment" onPress={confirmDelete} tone="muted" />
      </View>
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareRef} title={momentTitle(moment)} ageLine={`at ${ageText}`} photoUrl={leadPhotoUrl} />
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // aspectRatio is supplied per photo at the call site, from its stored dimensions.
  photo: { width: '100%', borderRadius: radius.md, backgroundColor: color.paperRaise },
  title: { fontFamily: font.displayBold, fontSize: type.hero, color: color.ink, letterSpacing: -0.5 },
  meta: { fontFamily: font.body, fontSize: type.label, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, lineHeight: 24, marginTop: space.sm },
  actions: { marginTop: space.xl, borderTopWidth: 1, borderTopColor: color.rule, paddingTop: space.lg },
  notFound: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, padding: space.xl },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
