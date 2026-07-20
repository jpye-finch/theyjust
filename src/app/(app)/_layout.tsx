import { Stack } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { NotificationSync } from '@/features/notifications/NotificationSync';
import { color } from '@/theme/tokens';

// The tabs live one level down so that capture can sit ABOVE them on a stack: a
// screen inside a Tabs navigator cannot be presented modally, which is why
// capture used to swallow the whole app.
export default function AppLayout() {
  return (
    <SelectedChildProvider>
      {/* Renders nothing; keeps the notification schedule in step with the
          family's moments wherever the parent happens to be in the app. */}
      <NotificationSync />
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
        {/* Reading a moment is a sheet for the same reason capturing one is:
            it is a single thing you open, look at, and dismiss. As a full
            screen with headerShown:false it also had nothing holding its own
            Back and Edit clear of the status bar, so both sat under the
            Dynamic Island. A sheet starts below the notch by construction. */}
        <Stack.Screen
          name="moment/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        {/* Adding and editing a child is the same kind of act as capturing a
            moment, so it gets the same sheet rather than a form wedged into
            the foot of the family list. */}
        <Stack.Screen
          name="child"
          options={{
            presentation: 'formSheet',
            // Shorter than capture: this form is four fields, not an open note.
            sheetAllowedDetents: [0.75, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
      </Stack>
    </SelectedChildProvider>
  );
}
