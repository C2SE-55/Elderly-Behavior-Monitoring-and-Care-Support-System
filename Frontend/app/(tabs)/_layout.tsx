import { Tabs } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import ScheduleReminderLayer from "@/components/schedule/ScheduleReminderLayer";
import * as Notifications from "expo-notifications";
import { appendNotificationLog, getNotificationLogs } from "@/services/notificationLog";

const PRIMARY = "#A78BFA";   // tím nhạt
const ACTIVE = "#56328C";    // tím đậm

export default function TabLayout() {
  const lastSigRef = useRef<{ sig: string; at: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = async () => {
    try {
      const rows = await getNotificationLogs();
      const count = rows.reduce((acc, it) => acc + (it.read ? 0 : 1), 0);
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    void refreshUnreadCount();
    const t = setInterval(() => void refreshUnreadCount(), 2000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const appendFromContent = (content: Notifications.NotificationContent) => {
      const data: any = (content as any)?.data || {};
      const type =
        data?.type === "medication"
          ? "medication"
          : data?.type === "weekly-schedule"
            ? "weekly-schedule"
            : "system";
      const title = content.title || "Thông báo";
      const body = content.body || "";

      // Deduplicate (received + tapped, or custom schedule + received).
      const sig = `${type}::${title}::${body}::${JSON.stringify(data || {})}`;
      const now = Date.now();
      if (lastSigRef.current?.sig === sig && now - lastSigRef.current.at < 2000) return;
      lastSigRef.current = { sig, at: now };

      void appendNotificationLog({ type, title, body, data, read: false })
        .then(() => refreshUnreadCount())
        .catch(() => {});
    };

    const subReceived = Notifications.addNotificationReceivedListener((n) => {
      appendFromContent(n.request.content);
    });

    const subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
      appendFromContent(resp.notification.request.content);
    });

    return () => {
      subReceived.remove();
      subResponse.remove();
    };
  }, []);

  const notificationBadge = useMemo(() => {
    if (!unreadCount) return undefined;
    if (unreadCount > 99) return "99+";
    return unreadCount;
  }, [unreadCount]);

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
          tabBarBadge: notificationBadge,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontWeight: "900",
          },
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