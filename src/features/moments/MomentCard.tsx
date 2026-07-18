import { Image, StyleSheet, Text, View } from 'react-native';
import { ageParts, formatAgeParts } from '../children/age';
import { formatDisplayDate } from '../../lib/date';
import { color, font, hairline, radius, space, type } from '@/theme/tokens';
import type { Moment } from './momentQueries';
import { momentTitle } from './momentText';

type Props = {
  moment: Moment;
  childDateOfBirth: string;
  loggedByYou: boolean;
  photoUrl: string | null;
};

export function MomentCard({ moment, childDateOfBirth, loggedByYou, photoUrl }: Props) {
  const ageText = formatAgeParts(ageParts(childDateOfBirth, moment.occurred_on));
  return (
    // The words lead and the plate follows, like a caption under a book's
    // illustration. A photo above the title read as belonging to the moment
    // ABOVE it: it sat flush against that entry's dividing rule and further from
    // its own title, so proximity attached it to the wrong story.
    <View style={styles.card}>
      <Text style={styles.title}>{momentTitle(moment)}</Text>
      <Text style={styles.meta}>{`${formatDisplayDate(moment.occurred_on)} · ${ageText}`}</Text>
      {photoUrl ? (
        // The title and note carry the moment as text, so the photo is decorative
        // to a screen reader (avoids announcing the same moment twice).
        <Image
          testID="moment-photo"
          accessible={false}
          source={{ uri: photoUrl }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : null}
      {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
      {/* Your own moments need no byline — it's every card. Only a co-parent's
          is worth attributing. */}
      {loggedByYou ? null : <Text style={styles.author}>Logged by a co-parent</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  // Generous padding does the grouping: everything inside one moment sits 8px
  // apart, while consecutive moments are held 24px + a rule from each other.
  card: {
    backgroundColor: color.paper,
    ...hairline,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.xl,
    gap: space.sm,
  },
  // Inset to the type block rather than full-bleed, so the plate stays inside
  // its own entry instead of spanning the page between two of them.
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: color.paperRaise,
    marginVertical: space.xs,
  },
  title: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  meta: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, lineHeight: 22 },
  author: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted },
});
