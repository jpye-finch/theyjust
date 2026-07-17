import {
  Fraunces_500Medium_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import { Karla_400Regular, Karla_500Medium, Karla_700Bold } from '@expo-google-fonts/karla';
import { useFonts } from 'expo-font';

// Returns true once the identity fonts are ready to paint. On a font-load error
// we still proceed (system fonts are a graceful fallback) rather than trap the
// user behind a blank splash.
export function useAppFonts(): boolean {
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Fraunces_500Medium_Italic,
    Karla_400Regular,
    Karla_500Medium,
    Karla_700Bold,
  });
  return loaded || error !== null;
}
