import { Tabs } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';

export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Tabs>
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen name="milestones" options={{ title: 'Milestones' }} />
        <Tabs.Screen name="family" options={{ title: 'Family' }} />
      </Tabs>
    </SelectedChildProvider>
  );
}
