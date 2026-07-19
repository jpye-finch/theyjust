import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { color, font, space } from '@/theme/tokens';

type Props = {
  title: string;
  ageLine: string;
  photoUrl: string | null;
};

// A fixed-size keepsake card captured to an image by shareMoment(). Rendered
// off-screen; not part of the visible layout.
export const ShareCard = forwardRef<View, Props>(function ShareCard(
  { title, ageLine, photoUrl },
  ref,
) {
  return (
    <View ref={ref} style={styles.card} collapsable={false}>
      {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.photo} resizeMode="cover" /> : null}
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.age}>{ageLine}</Text>
        <Text style={styles.brand}>Firsts</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { width: 1080, backgroundColor: color.paper },
  photo: { width: 1080, height: 810, backgroundColor: color.paperRaise },
  body: { padding: 72, gap: 16 },
  title: { fontFamily: font.displayBold, fontSize: 88, color: color.ink, letterSpacing: -1 },
  age: { fontFamily: font.serifItalic, fontSize: 44, color: color.damson },
  brand: { fontFamily: font.medium, fontSize: 32, color: color.inkMuted, marginTop: 24 },
});
