import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { DateField } from '@/components/DateField';
import { Field } from '@/components/Field';
import { PrimaryButton } from '@/components/PrimaryButton';
import { TextButton } from '@/components/TextButton';
import { color, font, radius, space, type } from '@/theme/tokens';
import { isRealDate } from '../../lib/date';
import { CATALOGUE } from '../milestones/catalogue';
import { MilestonePicker } from './MilestonePicker';

/** A photo already saved against the moment being edited. `url` is signed, and
 *  null while it is still being fetched (or if signing failed). */
export type ExistingPhoto = { id: string; url: string | null };

export type CaptureSubmit = {
  milestoneId: string | null;
  customTitle: string | null;
  occurredOn: string;
  note: string;
};

type Props = {
  /** Preselected catalogue milestone (from a Milestones row, or the moment being edited). */
  initialMilestoneId: string | null;
  defaultOccurredOn: string;
  photoCount: number;
  onPickPhoto: () => void;
  onSubmit: (value: CaptureSubmit) => void;
  busy?: boolean;
  /** Editing an existing moment pre-fills these; capturing leaves them blank. */
  initialCustomTitle?: string;
  initialNote?: string;
  submitLabel?: string;
  /** Editing only: photos already on the moment, shown so they can be removed. */
  existingPhotos?: ExistingPhoto[];
  onRemovePhoto?: (photoId: string) => void;
};

const NO_PHOTOS: ExistingPhoto[] = [];

export function CaptureForm({
  initialMilestoneId,
  defaultOccurredOn,
  photoCount,
  onPickPhoto,
  onSubmit,
  busy,
  initialCustomTitle = '',
  initialNote = '',
  submitLabel = 'Save moment',
  existingPhotos = NO_PHOTOS,
  onRemovePhoto,
}: Props) {
  // These seed state once. Capture mounts the form fresh per moment, and editing
  // mounts it fresh per moment too, so the props stay stable for its lifetime.
  const [milestoneId, setMilestoneId] = useState<string | null>(initialMilestoneId);
  const [customTitle, setCustomTitle] = useState(initialCustomTitle);
  const [occurredOn, setOccurredOn] = useState(defaultOccurredOn);
  const [note, setNote] = useState(initialNote);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  // A moment is EITHER a catalogue milestone (celebration voice, and it stamps
  // the Milestones screen) or the parent's own words — never both.
  const entry = milestoneId ? CATALOGUE.find((e) => e.id === milestoneId) : undefined;
  // The catalogue's own title, which is exactly what the timeline will show
  // once this is saved. Not celebrationText: naming it one way here and
  // another way there made a parent check whether they had picked the right
  // thing.
  const presetTitle = entry ? entry.title : null;

  const handleSubmit = () => {
    const trimmedTitle = customTitle.trim();
    if (presetTitle === null && !trimmedTitle) {
      setError('Give this moment a name');
      return;
    }
    if (!isRealDate(occurredOn)) {
      setError('Enter the date as YYYY-MM-DD');
      return;
    }
    setError(null);
    onSubmit({
      milestoneId: presetTitle === null ? null : milestoneId,
      customTitle: presetTitle === null ? trimmedTitle : null,
      occurredOn,
      note,
    });
  };

  return (
    <View style={styles.container}>
      {/* Date first. A parent logging something is usually logging it later —
          that evening, the next morning — so "when" is the question they are
          already answering in their head, and leaving it below the note meant
          scrolling back for the one field most likely to need changing. */}
      <DateField label="Date" value={occurredOn} onChange={setOccurredOn} />
      {/* A chosen milestone is an answer to the same question the custom field
          asks, so it wears the same clothes: the "Moment" label over an
          underlined value. It used to arrive as a Fraunces hero shouting "They
          just pulled up to stand!" — a second, louder name for the thing the
          timeline would go on to call "Pulled up to stand", in a heading that
          out-shouted the form it sat in. */}
      {presetTitle !== null ? (
        <View style={styles.presetBlock}>
          <Text style={styles.presetLabel}>Moment</Text>
          <View style={styles.presetValueRow}>
            <Text style={styles.presetValue}>{presetTitle}</Text>
          </View>
          <View style={styles.presetActions}>
            <TextButton label="Change milestone" onPress={() => setPicking(true)} />
            <TextButton label="Write my own" onPress={() => setMilestoneId(null)} tone="muted" />
          </View>
        </View>
      ) : (
        <View style={styles.customBlock}>
          <Field
            label="Moment"
            placeholder="What happened?"
            value={customTitle}
            onChangeText={setCustomTitle}
          />
          <TextButton label="Choose from milestones" onPress={() => setPicking(true)} />
        </View>
      )}
      <Field
        label="Note"
        placeholder="Add a little note (optional)"
        value={note}
        onChangeText={setNote}
        multiline
      />
      {existingPhotos.length > 0 ? (
        <View style={styles.photoRow}>
          {existingPhotos.map((photo) => (
            <View key={photo.id} style={styles.thumbWrap}>
              {/* The empty plate holds the slot while the signed URL resolves,
                  so the row does not jump as each photo arrives. */}
              {photo.url ? (
                <Image
                  accessible={false}
                  source={{ uri: photo.url }}
                  style={styles.thumb}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.thumb} />
              )}
              <Pressable
                style={styles.thumbRemove}
                onPress={() => onRemovePhoto?.(photo.id)}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
              >
                <Feather name="x" size={13} color={color.onDamson} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <Pressable style={styles.photoAdd} onPress={onPickPhoto} accessibilityRole="button">
        {/* The glyph carries the state: an invitation before, a confirmation after.
            Once thumbnails are on screen they ARE the confirmation, so the control
            goes back to being a plain invitation to add another. */}
        <Feather
          name={photoCount === 0 || existingPhotos.length > 0 ? 'camera' : 'check'}
          size={16}
          color={color.damson}
        />
        <Text style={styles.photoAddText}>
          {existingPhotos.length > 0
            ? 'Add another photo'
            : photoCount === 0
              ? 'Add a photo'
              : `${photoCount} photo${photoCount === 1 ? '' : 's'} added`}
        </Text>
      </Pressable>
      {error ? (
        <Text style={styles.error} role="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      <PrimaryButton label={submitLabel} onPress={handleSubmit} busy={busy} />
      <MilestonePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(id) => {
          setMilestoneId(id);
          setCustomTitle('');
          setError(null);
          setPicking(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  presetBlock: { gap: space.sm },
  presetActions: { flexDirection: 'row', gap: space.lg },
  customBlock: { gap: space.xs },
  // Deliberately the same label/value/underline as Field, so a chosen
  // milestone and a typed one read as the same kind of answer.
  presetLabel: {
    fontFamily: font.medium,
    fontSize: type.caption,
    color: color.inkMuted,
    letterSpacing: 0.3,
  },
  presetValueRow: {
    justifyContent: 'center',
    paddingVertical: space.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: color.rule,
  },
  presetValue: { fontFamily: font.body, fontSize: type.body, color: color.ink },
  photoAdd: {
    flexDirection: 'row',
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.rule,
    borderRadius: radius.md,
    borderStyle: 'dashed',
    paddingVertical: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddText: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // The remove control overhangs the plate's corner, so it needs room around the
  // thumbnail rather than clipping against the next one.
  thumbWrap: { paddingTop: space.sm, paddingRight: space.sm },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: color.paperRaise },
  thumbRemove: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: color.damson,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { fontFamily: font.medium, fontSize: type.label, color: color.damson },
});
