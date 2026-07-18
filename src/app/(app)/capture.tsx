import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextButton } from '@/components/TextButton';
import { useSelectedChild } from '@/features/children/selectedChild';
import { CaptureForm, type CaptureSubmit } from '@/features/moments/CaptureForm';
import {
  deleteMomentPhoto,
  useCreateMoment,
  useTimeline,
  useUpdateMoment,
  type Moment,
  type MomentPhoto,
} from '@/features/moments/momentQueries';
import {
  pickPhoto,
  resizePhoto,
  signedPhotoUrl,
  uploadMomentPhoto,
  type PickedPhoto,
} from '@/features/moments/photoUpload';
import { todayIso } from '@/features/moments/today';
import { confirmDestructive, notify } from '@/lib/dialog';
import { color, font, space, type } from '@/theme/tokens';

const NO_PHOTOS: MomentPhoto[] = [];

// Keyed on the photos' ids and paths, not the array itself: react-query hands
// back a fresh array on every refetch, and depending on that identity spun this
// effect's setState in a loop (the same trap the Timeline hit on its empty state).
function useSignedUrls(photos: MomentPhoto[]): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const key = photos.map((p) => `${p.id}:${p.storage_path}`).join('|');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        photos.map(async (p) => [p.id, await signedPhotoUrl(p.storage_path)] as const),
      );
      if (!cancelled) setUrls(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return urls;
}

export default function CaptureScreen() {
  const router = useRouter();
  const { milestoneId, momentId } = useLocalSearchParams<{
    milestoneId?: string;
    momentId?: string;
  }>();
  const { selected } = useSelectedChild();
  const qc = useQueryClient();
  const createMoment = useCreateMoment(selected?.id ?? '');
  const updateMoment = useUpdateMoment(selected?.id ?? '');
  const { data: moments, isLoading } = useTimeline(selected?.id ?? null);
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);

  // Capturing and editing are the same act, so they are the same screen. The
  // moment comes from the timeline cache the previous screen already loaded.
  const editing = momentId ? moments?.find((m) => m.id === momentId) : undefined;
  const existing = editing
    ? [...editing.moment_photos].sort((a, b) => a.position - b.position)
    : NO_PHOTOS;
  const photoUrls = useSignedUrls(existing);

  if (!selected) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Add a child first</Text>
        <TextButton label="Go to Family" onPress={() => router.replace('/family')} />
      </View>
    );
  }

  // A cold deep-link to ?momentId= reaches here before the timeline has loaded.
  // Without this the form would fall through to its capture defaults and quietly
  // create a SECOND moment instead of editing the one that was asked for.
  if (momentId && !editing) {
    return (
      <View style={styles.screen}>
        {isLoading ? null : (
          <>
            <Text style={styles.title}>This moment is no longer here.</Text>
            <TextButton label="Back to Timeline" onPress={() => router.replace('/')} />
          </>
        )}
      </View>
    );
  }

  const handlePick = async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    const resized = await resizePhoto(picked);
    // Capturing has no moment row yet, so picked photos are held until save.
    // Editing already has one, so there is nothing to wait for: upload now and
    // let the refreshed timeline put the thumbnail on screen.
    if (!editing) {
      setPhotos((prev) => [...prev, resized]);
      return;
    }
    const nextPosition = existing.reduce((max, p) => Math.max(max, p.position), -1) + 1;
    try {
      await uploadMomentPhoto(editing.id, `${editing.id}-${nextPosition}`, resized, nextPosition);
    } catch (e) {
      notify('Could not add photo', e instanceof Error ? e.message : 'Please try again.');
      return;
    }
    await qc.invalidateQueries({ queryKey: ['timeline', selected.id] });
  };

  // Removing is not undoable — the object leaves the bucket — so it asks first.
  const handleRemovePhoto = (photoId: string) => {
    const photo = existing.find((p) => p.id === photoId);
    if (!photo) return;
    confirmDestructive('Remove this photo?', 'It cannot be brought back.', 'Remove', async () => {
      try {
        await deleteMomentPhoto(photo.id, photo.storage_path);
      } catch (e) {
        notify('Could not remove', e instanceof Error ? e.message : 'Please try again.');
        return;
      }
      await qc.invalidateQueries({ queryKey: ['timeline', selected.id] });
    });
  };

  // Two phases with separate failure handling: once the moment row is committed
  // its onSuccess already refetched the timeline, so a failed photo upload must
  // NOT read as "could not save" (that stranded the user on a saved-but-failed
  // moment, and a re-tap created a duplicate). Create first, then upload.
  const handleSubmit = async (value: CaptureSubmit) => {
    if (editing) {
      updateMoment.mutate(
        {
          id: editing.id,
          edit: {
            milestoneId: value.milestoneId,
            customTitle: value.customTitle,
            occurredOn: value.occurredOn,
            note: value.note,
          },
        },
        {
          onSuccess: () => router.back(),
          onError: (e) =>
            notify('Could not save', e instanceof Error ? e.message : 'Please try again.'),
        },
      );
      return;
    }

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
        <Text style={styles.screenTitle}>{editing ? 'Edit this moment' : 'Capture a moment'}</Text>
        <TextButton label="Cancel" onPress={() => router.back()} tone="muted" />
      </View>
      <CaptureForm
        initialMilestoneId={editing ? editing.milestone_id : (milestoneId ?? null)}
        initialCustomTitle={editing?.custom_title ?? ''}
        initialNote={editing?.note ?? ''}
        defaultOccurredOn={editing ? editing.occurred_on : todayIso()}
        submitLabel={editing ? 'Save changes' : 'Save moment'}
        photoCount={editing ? existing.length : photos.length}
        existingPhotos={
          editing ? existing.map((p) => ({ id: p.id, url: photoUrls[p.id] ?? null })) : undefined
        }
        onRemovePhoto={editing ? handleRemovePhoto : undefined}
        onPickPhoto={handlePick}
        onSubmit={handleSubmit}
        busy={createMoment.isPending || updateMoment.isPending}
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
