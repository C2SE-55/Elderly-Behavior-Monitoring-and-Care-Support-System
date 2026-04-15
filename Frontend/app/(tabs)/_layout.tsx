import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Feather, Ionicons } from "@expo/vector-icons";
import ScheduleReminderLayer from "@/components/schedule/ScheduleReminderLayer";
import { getCurrentUser, getMyRoom, getRoomChatNotificationPrefs, subscribeActiveRoomChange } from "@/services/api";
import { handleRemoteMedicationIntake } from "@/services/medicationIntakeSync";
import { appendNotificationLog, getNotificationLogs, subscribeNotificationLogChange } from "@/services/notificationLog";
import {
  connectRoomChatSocket,
  getRoomChatNotifPrefCached,
  seedRoomChatNotifPrefsCache,
  subscribeRoomChatNotifPrefCacheChange,
} from "@/services/roomChatSocket";
import { pollSafetyEventsOnce } from "@/services/safetyNotifications";

const PRIMARY = "#A78BFA";   // tím nhạt
const ACTIVE = "#56328C";    // tím đậm
const SCAN_BG = "#56328C";

export default function TabLayout() {
  const lastSigRef = useRef<{ sig: string; at: number } | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatNotifByRoomRef = useRef<Map<number, boolean>>(new Map());
  const [isHost, setIsHost] = useState(false);

  const refreshUnreadCount = useCallback(async () => {
    try {
      const rows = await getNotificationLogs();
      const count = rows.reduce((acc, it) => acc + (it.read ? 0 : 1), 0);
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    const t = setInterval(() => void refreshUnreadCount(), 2000);
    return () => clearInterval(t);
  }, [refreshUnreadCount]);

  useEffect(() => {
    // Avoid updating tab state during router rehydration (can crash TabRouter on native).
    // Schedule to next tick + guard mount.
    let mounted = true;
    const unsub = subscribeNotificationLogChange(() => {
      setTimeout(() => {
        if (!mounted) return;
        void refreshUnreadCount();
      }, 0);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [refreshUnreadCount]);

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
    let cancelled = false;
    const syncRole = async () => {
      try {
        const r = await getMyRoom();
        if (cancelled) return;
        setIsHost(r?.member_role === "host");
      } catch {
        if (!cancelled) setIsHost(false);
      }
    };
    void syncRole();
    const t = setInterval(() => void syncRole(), 10_000);
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
                : data?.type === "room-message"
                  ? "room-message"
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

    const me = getCurrentUser() as { id?: number; fullName?: string; username?: string } | null;
    const myUserId = Number(me?.id || 0);

    let cancelled = false;
    const refreshChatPrefs = async () => {
      try {
        const rows = await getRoomChatNotificationPrefs();
        const next = new Map<number, boolean>();
        rows.forEach((r) => next.set(Number(r.room_id), r.chat_notifications_enabled !== false));
        chatNotifByRoomRef.current = next;
        seedRoomChatNotifPrefsCache(
          rows.map((r) => ({
            room_id: Number(r.room_id),
            chat_notifications_enabled: r.chat_notifications_enabled !== false,
          }))
        );
      } catch {
        // best-effort: keep previous map
      }
    };
    const joinActiveRoom = async () => {
      const room = await getMyRoom().catch(() => null);
      const rid = room?.id;
      if (cancelled || !rid) return;
      socket.emit("room:join", { roomId: Number(rid) });
    };

    void refreshChatPrefs();
    void joinActiveRoom();
    const prefTimer = setInterval(() => void refreshChatPrefs(), 20_000);

    const onIntake = (payload: unknown) => {
      void handleRemoteMedicationIntake(payload);
    };
    socket.on("medication:intake", onIntake);

    const onMessageNew = (payload: any) => {
      const msg = payload?.message;
      const roomId = Number(payload?.roomId || msg?.room_id || 0);
      if (!roomId || !msg) return;
      if (myUserId && Number(msg.sender_user_id || 0) === myUserId) return;

      // Respect per-room notification preference (default ON if missing).
      const cachedPref = getRoomChatNotifPrefCached(roomId);
      if (cachedPref === false) return;
      if (chatNotifByRoomRef.current.get(roomId) === false) return;

      const roomName = String(msg.room_id || `Room #${roomId}`);
      const content = String(msg.content || "").trim();
      const sender = String(msg.sender_name || "").trim();
      const preview = content.length > 80 ? `${content.slice(0, 77)}…` : content;

      const title = `Phòng ${roomName} có tin nhắn mới`;
      const body = sender ? `${sender}: ${preview}` : preview || "Có tin nhắn mới trong phòng.";

      // Local push notification (works even when user is outside chat screen).
      void (async () => {
        try {
          const Notifications = await import("expo-notifications");
          const perms = await Notifications.getPermissionsAsync();
          if (!perms.granted) {
            const req = await Notifications.requestPermissionsAsync();
            if (!req.granted) return;
          }
          await Notifications.scheduleNotificationAsync({
            content: {
              title,
              body,
              sound: true,
              data: {
                type: "room-message",
                room_id: roomId,
                room_name: roomName,
                sender_name: sender || null,
                content,
                sent_at: msg.created_at,
              },
            },
            trigger: null,
          });
        } catch {
          // ignore
        }
      })();

      void appendNotificationLog({
        type: "room-message",
        title,
        body,
        data: {
          type: "room-message",
          room_id: roomId,
          room_name: roomName,
          sender_name: sender || null,
          content,
          sent_at: msg.created_at,
        },
        read: false,
      })
        .then(() => refreshUnreadCount())
        .catch(() => {});
    };
    socket.on("message:new", onMessageNew);

    const unsubRoom = subscribeActiveRoomChange(() => {
      void joinActiveRoom();
    });
    const unsubPref = subscribeRoomChatNotifPrefCacheChange(() => {
      // keep local ref synchronized so checks are immediate
      // cached prefs are authoritative for runtime toggles
      // (backend sync still runs by timer)
      const current = new Map<number, boolean>(chatNotifByRoomRef.current);
      for (const [rid, _val] of current) {
        const cv = getRoomChatNotifPrefCached(rid);
        if (cv !== undefined) current.set(rid, cv);
      }
      chatNotifByRoomRef.current = current;
    });

    return () => {
      cancelled = true;
      unsubRoom();
      unsubPref();
      clearInterval(prefTimer);
      socket.off("medication:intake", onIntake);
      socket.off("message:new", onMessageNew);
    };
  }, [refreshUnreadCount]);

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
          // Hide for non-host: remove from tab bar entirely
          href: isHost ? undefined : null,
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

      {/* SCAN QR - highlighted button (placed after Settings) */}
      <Tabs.Screen
        name="scan"
        options={{
          title: "Quét mã",
          tabBarShowLabel: false,
          tabBarStyle: { display: "none" },
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
    backgroundColor: SCAN_BG,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
});