import { Stack } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { color } from '@/theme/tokens';

// The tabs live one level down so that capture can sit ABOVE them on a stack: a
// screen inside a Tabs navigator cannot be presented modally, which is why
// capture used to swallow the whole app.
export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="capture"
          options={{
            presentation: 'formSheet',
            // Opens tall enough to reach Save without scrolling, and can be
            // dragged to full height for a long note.
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="moment/[id]" />
      </Stack>
    </SelectedChildProvider>
  );
}
