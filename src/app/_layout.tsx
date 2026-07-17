import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '@/features/auth/useSession';
import { queryClient } from '@/lib/queryClient';
import { color } from '@/theme/tokens';
import { useAppFonts } from '@/theme/useAppFonts';

export default function RootLayout() {
  const { session, loading } = useSession();
  const fontsReady = useAppFonts();

  if (loading || !fontsReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: color.paper }}>
        <ActivityIndicator color={color.damson} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  );
}
