import { Image, StyleSheet, Text, View } from 'react-native';
import { ageParts, formatAgeParts } from '../children/age';
import { color, font, hairline, space, type } from '@/theme/tokens';
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
    <View style={styles.card}>
      {photoUrl ? (
        // Title and note carry the moment as text, so the photo is decorative to a
        // screen reader (avoids announcing the same moment twice).
        <Image
          testID="moment-photo"
          accessible={false}
          source={{ uri: photoUrl }}
          style={styles.photo}
          resizeMode="cover"
        />
      ) : null}
      <View style={styles.body}>
        <Text style={styles.title}>{momentTitle(moment)}</Text>
        <Text style={styles.meta}>{`${moment.occurred_on} · ${ageText}`}</Text>
        {moment.note ? <Text style={styles.note}>{moment.note}</Text> : null}
        <Text style={styles.author}>{`Logged by ${loggedByYou ? 'you' : 'a co-parent'}`}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.paper, ...hairline, paddingBottom: space.lg },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: color.paperRaise },
  body: { paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xs },
  title: { fontFamily: font.display, fontSize: type.title, color: color.ink },
  meta: { fontFamily: font.body, fontSize: type.caption, color: color.inkMuted },
  note: { fontFamily: font.body, fontSize: type.body, color: color.ink, marginTop: space.xs, lineHeight: 22 },
  author: { fontFamily: font.medium, fontSize: type.caption, color: color.inkMuted, marginTop: space.sm },
});
