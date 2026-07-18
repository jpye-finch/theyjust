import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { useSelectedChild } from '@/features/children/selectedChild';
import { CaptureForm, type CaptureSubmit } from '@/features/moments/CaptureForm';
import { useCreateMoment, type Moment } from '@/features/moments/momentQueries';
import { pickPhoto, resizePhoto, uploadMomentPhoto, type PickedPhoto } from '@/features/moments/photoUpload';
import { todayIso } from '@/features/moments/today';
import { notify } from '@/lib/dialog';
import { color, font, space, type } from '@/theme/tokens';

export default function CaptureScreen() {
  const router = useRouter();
  const { milestoneId } = useLocalSearchParams<{ milestoneId?: string }>();
  const { selected } = useSelectedChild();
  const qc = useQueryClient();
  const createMoment = useCreateMoment(selected?.id ?? '');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  if (!selected) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Add a child first</Text>
        <TextButton label="Go to Family" onPress={() => router.replace('/family')} />
      </View>
    );
  }

  const handlePick = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    const resized = await resizePhoto(picked);
    setPhotos((prev) => [...prev, resized]);
  };

  // Two phases with separate failure handling: once the moment row is committed
  // its onSuccess already refetched the timeline, so a failed photo upload must
  // NOT read as "could not save" (that stranded the user on a saved-but-failed
  // moment, and a re-tap created a duplicate). Create first, then upload.
  const handleSubmit = async (value: CaptureSubmit) => {
    let moment: Moment;
    try {
      moment = await createMoment.mutateAsync({
        childId: selected.id,
        milestoneId: value.milestoneId,
        customTitle: value.customTitle,
        occurredOn: value.occurredOn,
        note: value.note,
      });
    } catch (e) {
      notify('Could not save', e instanceof Error ? e.message : 'Please try again.');
      return;
    }
    const uploads = await Promise.allSettled(
      photos.map((p, i) => uploadMomentPhoto(moment.id, `${moment.id}-${i}`, p, i)),
    );
    if (uploads.some((u) => u.status === 'rejected')) {
      notify('Moment saved', "One or more photos didn't upload.");
    }
    // createMoment's onSuccess already refetched the timeline — but that ran
    // BEFORE these uploads finished, so the new moment got cached with no
    // photos. Refresh again now the rows exist, or the photo only turns up
    // after an app restart.
    if (photos.length > 0) {
      await qc.invalidateQueries({ queryKey: ['timeline', selected.id] });
    }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.screenTitle}>Capture a moment</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <CaptureForm
        initialMilestoneId={milestoneId ?? null}
        defaultOccurredOn={todayIso()}
        photoCount={photos.length}
        onPickPhoto={handlePick}
        onSubmit={handleSubmit}
        busy={createMoment.isPending}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.paper },
  content: { padding: space.lg, gap: space.lg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Screen chrome is functional, so it is Karla and it recedes: the celebration
  // line below is the only thing on this page allowed to be the hero. Fraunces
  // here made the two headings the same size and voice, and they fought.
  screenTitle: { fontFamily: font.medium, fontSize: type.label, color: color.inkMuted },
  // Fraunces stays for the empty state, which IS the page's own voice.
  title: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
});
