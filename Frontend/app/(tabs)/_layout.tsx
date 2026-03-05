import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        // Giữ nguyên màu icon khi chọn / không chọn
        tabBarActiveTintColor: '#a78bfa',
        tabBarInactiveTintColor: '#a78bfa',
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: '#ffffff',
          borderTopWidth: 0.5,
          borderTopColor: '#E5E7EB',
          elevation: 4,
        },
        // Ẩn chữ, chỉ hiển thị icon
        tabBarLabelStyle: {
          fontSize: 0,
        },
        tabBarShowLabel: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <>
              <IconSymbol size={26} name="square.grid.2x2.fill" color={color} />
              {focused && (
                <IconSymbol
                  size={4}
                  name="circle.fill"
                  color={Colors[colorScheme ?? 'light'].tint}
                  style={{ marginTop: 4 }}
                />
              )}
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, focused }) => (
            <>
              <IconSymbol size={26} name="chart.bar.fill" color={color} />
              {focused && (
                <IconSymbol
                  size={4}
                  name="circle.fill"
                  color={Colors[colorScheme ?? 'light'].tint}
                  style={{ marginTop: 4 }}
                />
              )}
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Notifications',
          tabBarIcon: ({ color, focused }) => (
            <>
              <IconSymbol size={26} name="bell.fill" color={color} />
              {focused && (
                <IconSymbol
                  size={4}
                  name="circle.fill"
                  color={Colors[colorScheme ?? 'light'].tint}
                  style={{ marginTop: 4 }}
                />
              )}
            </>
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, focused }) => (
            <>
              <IconSymbol size={26} name="gearshape.fill" color={color} />
              {focused && (
                <IconSymbol
                  size={4}
                  name="circle.fill"
                  color={Colors[colorScheme ?? 'light'].tint}
                  style={{ marginTop: 4 }}
                />
              )}
            </>
          ),
        }}
      />
    </Tabs>
  );
}
