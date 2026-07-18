import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { ageParts, formatAgeParts } from '@/features/children/age';
import { useSelectedChild } from '@/features/children/selectedChild';
import {
  useDeleteMoment,
  useTimeline,
  useUpdateMoment,
  type Moment,
} from '@/features/moments/momentQueries';
import { momentTitle } from '@/features/moments/momentText';
import { signedPhotoUrl } from '@/features/moments/photoUpload';
import { ShareCard } from '@/features/moments/ShareCard';
import { shareMomentCard } from '@/features/moments/shareMoment';
import { formatDisplayDate, isRealDate } from '@/lib/date';
import { confirmDestructive, notify } from '@/lib/dialog';
import { color, font, radius, space, type } from '@/theme/tokens';

export default function MomentDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { selected } = useSelectedChild();
  const { data: moments = [], isLoading } = useTimeline(selected?.id ?? null);
  const updateMoment = useUpdateMoment(selected?.id ?? '');
  const deleteMoment = useDeleteMoment(selected?.id ?? '');
  const moment = moments.find((m) => m.id === id) as Moment | undefined;

  const [editing, setEditing] = useState(false);
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
        {!editing ? <TextButton label="Edit" onPress={() => setEditing(true)} /> : null}
      </View>
      {photoUrl ? (
        <Image accessible={false} source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" />
      ) : null}
      <Text style={styles.title}>{momentTitle(moment)}</Text>
      <Text style={styles.meta}>{`${formatDisplayDate(moment.occurred_on)} · ${ageText}`}</Text>

      {editing ? (
        <EditFields
          moment={moment}
          busy={updateMoment.isPending}
          onCancel={() => setEditing(false)}
          onSave={(edit) =>
            updateMoment.mutate(
              { id: moment.id, edit },
              {
                onSuccess: () => setEditing(false),
                onError: (e) =>
                  notify('Could not save', e instanceof Error ? e.message : 'Please try again.'),
              },
            )
          }
        />
      ) : (
        <>
          {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
          <View style={styles.actions}>
            <TextButton label="Share this memory" onPress={() => shareMomentCard(shareRef)} />
            <TextButton label="Delete moment" onPress={confirmDelete} tone="muted" />
          </View>
        </>
      )}
      <View style={styles.offscreen} pointerEvents="none">
        <ShareCard ref={shareRef} title={momentTitle(moment)} ageLine={`at ${ageText}`} photoUrl={photoUrl} />
      </View>
    </ScrollView>
  );
}

function EditFields({
  moment,
  busy,
  onCancel,
  onSave,
}: {
  moment: Moment;
  busy: boolean;
  onCancel: () => void;
  onSave: (edit: { occurredOn: string; note: string }) => void;
}) {
  const [occurredOn, setOccurredOn] = useState(moment.occurred_on);
  const [note, setNote] = useState(moment.note ?? '');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (!isRealDate(occurredOn)) {
      setError('Enter the date as YYYY-MM-DD');
      return;
    }
    setError(null);
    onSave({ occurredOn, note });
  };

  return (
    <View style={styles.edit}>
      <DateField label="When did it happen?" value={occurredOn} onChange={setOccurredOn} />
      <Field label="Note" placeholder="Add a little note" value={note} onChangeText={setNote} multiline />
      {error ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label="Save changes" onPress={handleSave} busy={busy} />
      <TextButton label="Cancel" onPress={onCancel} tone="muted" />
    </View>
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
  edit: { gap: space.lg, marginTop: space.sm },
  notFound: { fontFamily: font.body, fontSize: type.body, color: color.inkMuted, padding: space.xl },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  offscreen: { position: 'absolute', left: -10000, top: 0 },
});
