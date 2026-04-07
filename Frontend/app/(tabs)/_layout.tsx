import { Tabs } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import ScheduleReminderLayer from "@/components/schedule/ScheduleReminderLayer";
import { getMyRoom, subscribeActiveRoomChange } from "@/services/api";
import { handleRemoteMedicationIntake } from "@/services/medicationIntakeSync";
import { appendNotificationLog, getNotificationLogs } from "@/services/notificationLog";
import { connectRoomChatSocket } from "@/services/roomChatSocket";
import { pollSafetyEventsOnce } from "@/services/safetyNotifications";

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
    // Host-only: poll fall / left-safe-zone events and append into notification log.
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      try {
        await pollSafetyEventsOnce();
        await refreshUnreadCount();
      } catch {
        // ignore
      }
    };
    void tick();
    const t = setInterval(() => void tick(), 5000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;

    let cancelled = false;
    let subReceived: { remove: () => void } | null = null;
    let subResponse: { remove: () => void } | null = null;

    const run = async () => {
      const Notifications = await import("expo-notifications");
      if (cancelled) return;

      const appendFromContent = (content: import("expo-notifications").NotificationContent) => {
        const data: any = (content as any)?.data || {};
        const type =
          data?.type === "medication"
            ? "medication"
            : data?.type === "weekly-schedule"
              ? "weekly-schedule"
              : data?.type === "care-confirmation"
                ? "care-confirmation"
                : "system";
        const title = content.title || "Thông báo";
        const body = content.body || "";

        const sig = `${type}::${title}::${body}::${JSON.stringify(data || {})}`;
        const now = Date.now();
        if (lastSigRef.current?.sig === sig && now - lastSigRef.current.at < 2000) return;
        lastSigRef.current = { sig, at: now };

        void appendNotificationLog({ type, title, body, data, read: false })
          .then(() => refreshUnreadCount())
          .catch(() => {});
      };

      subReceived = Notifications.addNotificationReceivedListener((n) => {
        appendFromContent(n.request.content);
      });

      subResponse = Notifications.addNotificationResponseReceivedListener((resp) => {
        appendFromContent(resp.notification.request.content);
      });
    };

    void run();

    return () => {
      cancelled = true;
      subReceived?.remove();
      subResponse?.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const socket = connectRoomChatSocket();
    if (!socket) return;

    let cancelled = false;
    const joinActiveRoom = async () => {
      const room = await getMyRoom().catch(() => null);
      const rid = room?.id;
      if (cancelled || !rid) return;
      socket.emit("room:join", { roomId: Number(rid) });
    };

    void joinActiveRoom();

    const onIntake = (payload: unknown) => {
      void handleRemoteMedicationIntake(payload);
    };
    socket.on("medication:intake", onIntake);

    const unsubRoom = subscribeActiveRoomChange(() => {
      void joinActiveRoom();
    });

    return () => {
      cancelled = true;
      unsubRoom();
      socket.off("medication:intake", onIntake);
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