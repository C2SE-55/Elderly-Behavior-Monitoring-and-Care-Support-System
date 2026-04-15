import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

const COLORS = {
  active: "#56328C",
  inactive: "#64748B",
  tabBg: "rgba(255,255,255,0.96)",
  tabBorder: "rgba(148,163,184,0.22)",
};

export default function AdminTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.active,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
          marginTop: -1,
          letterSpacing: 0.1,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 2,
          paddingVertical: 2,
        },
        tabBarStyle: {
          position: "absolute",
          left: 10,
          right: 10,
          bottom: 8,
          height: 72,
          paddingBottom: 9,
          paddingTop: 9,
          backgroundColor: COLORS.tabBg,
          borderTopWidth: 1,
          borderTopColor: COLORS.tabBorder,
          borderWidth: 1,
          borderColor: COLORS.tabBorder,
          borderRadius: 20,
          shadowColor: "#0F172A",
          shadowOpacity: 0.1,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tổng quan",
          tabBarIcon: ({ color, size }) => (
            <Feather name="grid" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Cài đặt",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size ?? 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="add-account" options={{ href: null }} />
      <Tabs.Screen name="account-detail" options={{ href: null }} />
      <Tabs.Screen name="homepage_admin" options={{ href: null }} />
      <Tabs.Screen name="room-management" options={{ href: null }} />
    </Tabs>
  );
}
