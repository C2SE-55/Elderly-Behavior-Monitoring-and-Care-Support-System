import { Tabs } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";

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
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ color }) => (
            <Feather name="grid" size={26} color={color} />
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
          tabBarIcon: ({ color }) => (
            <Ionicons name="notifications-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ color }) => (
            <Ionicons name="settings-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: "Quét mã",
          tabBarShowLabel: false,
          tabBarButton: ({ onPress, accessibilityState }) => {
            const focused = accessibilityState?.selected === true;
            return (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onPress}
                style={[styles.scanBtnWrap, focused && styles.scanBtnWrapFocused]}
                accessibilityRole="button"
                accessibilityLabel="Quét mã vào phòng"
              >
                <View style={styles.scanBtn}>
                  <Ionicons name="qr-code-outline" size={24} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          },
        }}
      />
      <Tabs.Screen name="add-account" options={{ href: null }} />
      <Tabs.Screen name="account-detail" options={{ href: null }} />
      <Tabs.Screen name="homepage_admin" options={{ href: null }} />
      <Tabs.Screen name="room-management" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  scanBtnWrap: {
    width: 74,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -20,
  },
  scanBtnWrapFocused: {
    transform: [{ scale: 1.02 }],
  },
  scanBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.active,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});
