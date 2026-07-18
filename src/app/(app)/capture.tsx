import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { useSelectedChild } from '@/features/children/selectedChild';
import { CaptureForm, type CaptureSubmit } from '@/features/moments/CaptureForm';
import { CATALOGUE, celebrationText } from '@/features/milestones/catalogue';
import { useCreateMoment, type Moment } from '@/features/moments/momentQueries';
import { pickPhoto, resizePhoto, uploadMomentPhoto, type PickedPhoto } from '@/features/moments/photoUpload';
import { todayIso } from '@/features/moments/today';
import { color, font, space, type } from '@/theme/tokens';

export default function CaptureScreen() {
  const router = useRouter();
  const { milestoneId } = useLocalSearchParams<{ milestoneId?: string }>();
  const { selected } = useSelectedChild();
  const createMoment = useCreateMoment(selected?.id ?? '');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  const entry = milestoneId ? CATALOGUE.find((e) => e.id === milestoneId) : undefined;
  const presetTitle = entry ? celebrationText(entry) : null;

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
        milestoneId: entry?.id ?? null,
        customTitle: value.customTitle,
        occurredOn: value.occurredOn,
        note: value.note,
      });
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
      return;
    }
    const uploads = await Promise.allSettled(
      photos.map((p, i) => uploadMomentPhoto(moment.id, `${moment.id}-${i}`, p, i)),
    );
    if (uploads.some((u) => u.status === 'rejected')) {
      Alert.alert('Moment saved', "One or more photos didn't upload.");
    }
    router.back();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Capture a moment</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <CaptureForm
        presetTitle={presetTitle}
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
  title: { fontFamily: font.displayBold, fontSize: type.display, color: color.ink, letterSpacing: -0.3 },
});
