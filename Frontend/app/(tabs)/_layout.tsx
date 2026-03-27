import { Tabs } from "expo-router";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import ScheduleReminderLayer from "@/components/schedule/ScheduleReminderLayer";

const PRIMARY = "#A78BFA";   // tím nhạt
const ACTIVE = "#56328C";    // tím đậm

export default function TabLayout() {
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: PRIMARY,

        tabBarShowLabel: false,

        tabBarStyle: {
          height: 75,
          paddingBottom: 10,
          paddingTop: 10,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
        },
      }}
    >
      {/* HOME */}
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={26} color={color} />
          ),
        }}
      />

      {/* STATS */}
      <Tabs.Screen
        name="stats"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="bar-chart-2" size={26} color={color} />
          ),
        }}
      />

      {/* NOTIFICATIONS */}
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="notifications-outline"
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* SETTINGS */}
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons
              name="settings-outline"
              size={26}
              color={color}
            />
          ),
        }}
      />

      {/* MEDICINE REMINDER - hidden tab button */}
      <Tabs.Screen
        name="medicine-reminder"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="weekly-schedule"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="room-access"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="room-permissions"
        options={{
          href: null,
        }}
      />
    </Tabs>
    <ScheduleReminderLayer />
    </View>
  );
}