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
        <Tabs.Screen
          name="index"
          options={{
            title: 'Timeline',
            tabBarIcon: ({ color: c, size }) => <Feather name="clock" size={size} color={c} />,
          }}
        />
        <Tabs.Screen
          name="milestones"
          options={{
            title: 'Milestones',
            tabBarIcon: ({ color: c, size }) => <Feather name="book-open" size={size} color={c} />,
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Family',
            tabBarIcon: ({ color: c, size }) => <Feather name="users" size={size} color={c} />,
          }}
        />
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="moment/[id]" options={{ href: null }} />
      </Tabs>
    </SelectedChildProvider>
  );
}
