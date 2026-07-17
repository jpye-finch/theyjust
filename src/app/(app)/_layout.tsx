import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { color, font } from '@/theme/tokens';

export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: color.damson,
          tabBarInactiveTintColor: color.inkMuted,
          tabBarStyle: {
            backgroundColor: color.paper,
            borderTopColor: color.rule,
            borderTopWidth: 1,
          },
          tabBarLabelStyle: { fontFamily: font.medium, fontSize: 12 },
        }}
      >
        <Tabs.Screen name="index" options={{ href: null }} />
        <Tabs.Screen
          name="milestones"
          options={{
            title: 'Milestones',
            tabBarIcon: ({ color: c, size }) => <Feather name="award" size={size} color={c} />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Family',
            tabBarIcon: ({ color: c, size }) => <Feather name="users" size={size} color={c} />,
          }}
        />
      </Tabs>
    </SelectedChildProvider>
  );
}
