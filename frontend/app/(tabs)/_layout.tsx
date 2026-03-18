import { Tabs } from 'expo-router';
import { Ionicons, Feather } from '@expo/vector-icons';
import { Colors } from '../../src/theme';
import { Platform } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 80 : 56,
          paddingBottom: Platform.OS === 'ios' ? 20 : 4,
          paddingTop: 6,
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: -2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'My Plants',
          tabBarIcon: ({ color, size }) => <Ionicons name="leaf" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="hydrate"
        options={{
          title: 'Hydrate',
          tabBarIcon: ({ color, size }) => <Ionicons name="water" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nurture"
        options={{
          title: 'Nurture',
          tabBarIcon: ({ color, size }) => <Feather name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="devices"
        options={{
          title: 'Devices',
          tabBarIcon: ({ color, size }) => <Feather name="wifi" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
