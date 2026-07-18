import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import { Platform, StyleSheet, Text, type ColorValue } from 'react-native';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { color, font, space } from '@/theme/tokens';

// React Navigation pins its own label to an 11px box with overflow:hidden, which
// crops Karla's descenders (the "y" in Family) no matter what tabBarLabelStyle
// says. Rendering the label ourselves sidesteps that box entirely, and keeps the
// type free to grow with the reader's dynamic-type setting.
function tabLabel(label: string) {
  return function TabLabel({ color: tint }: { color: ColorValue }) {
    return <Text style={[styles.label, { color: tint }]}>{label}</Text>;
  };
}

function tabIcon(name: React.ComponentProps<typeof Feather>['name']) {
  return function TabIcon({ color: tint, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size} color={tint as string} />;
  };
}

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
            // Web's 48px default can't hold a 24px glyph over a 16px line box.
            // Native height is left alone so the navigator keeps applying the
            // home-indicator inset.
            ...Platform.select({
              web: { height: 68, paddingTop: space.sm, paddingBottom: space.md },
              default: {},
            }),
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Timeline',
            tabBarLabel: tabLabel('Timeline'),
            tabBarIcon: tabIcon('clock'),
          }}
        />
        <Tabs.Screen
          name="milestones"
          options={{
            title: 'Milestones',
            tabBarLabel: tabLabel('Milestones'),
            tabBarIcon: tabIcon('book-open'),
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Family',
            tabBarLabel: tabLabel('Family'),
            tabBarIcon: tabIcon('users'),
          }}
        />
      </Tabs>
    </SelectedChildProvider>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: font.medium,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: space.xs,
  },
});
