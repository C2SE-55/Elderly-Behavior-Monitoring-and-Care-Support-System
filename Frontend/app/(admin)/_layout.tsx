import { Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

const BLUE = "#2563EB";
const GRAY = "#64748B";

export default function AdminTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: BLUE,
        tabBarInactiveTintColor: GRAY,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          position: "absolute",
          left: 12,
          right: 12,
          bottom: 3,
          height: 70,
          paddingBottom: 8,
          paddingTop: 8,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
          borderRadius: 16,
          shadowColor: "#000",
          shadowOpacity: 0.12,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Tài khoản",
          tabBarIcon: ({ color, size }) => (
            <Feather name="users" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "Cảnh báo",
          tabBarIcon: ({ color, size }) => (
            <Feather name="bell" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Cài đặt",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size ?? 24} color={color} />
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
