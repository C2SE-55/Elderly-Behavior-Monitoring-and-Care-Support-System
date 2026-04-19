import { Tabs } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Feather, Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { getCurrentUser } from "@/services/api";
import {
  isSupportNotificationForAdminInbox,
  SUPPORT_NOTIFICATION_TITLE,
} from "@/components/notifications/notificationTypes";
import { appendNotificationLog, getNotificationLogs, subscribeNotificationLogChange } from "@/services/notificationLog";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const COLORS = {
  active: "#56328C",
  inactive: "#64748B",
  tabBg: "rgba(255,255,255,0.96)",
  tabBorder: "rgba(148,163,184,0.22)",
};

export default function AdminTabLayout() {
  const [tabUnread, setTabUnread] = useState(0);

  const refreshTabBadgeUnread = useCallback(async () => {
    try {
      const rows = await getNotificationLogs();
      const count = rows.reduce(
        (acc, it) => acc + (isSupportNotificationForAdminInbox(it) && !it.read ? 1 : 0),
        0
      );
      setTabUnread(count);
    } catch {
      setTabUnread(0);
    }
  }, []);

  useEffect(() => {
    void refreshTabBadgeUnread();
    const timer = setInterval(() => void refreshTabBadgeUnread(), 3500);
    const unsubLog = subscribeNotificationLogChange(() => {
      void refreshTabBadgeUnread();
    });
    const socket = connectRoomChatSocket();
    const onSupportMessage = (payload: any) => {
      const me = getCurrentUser() as { id?: number; role?: string } | null;
      if (String(me?.role || "").toLowerCase() !== "admin") return;
      const myId = Number(me?.id || 0);
      const msg = payload?.message;
      if (!msg) return;
      if (myId && Number(msg.sender_user_id || 0) === myId) return;

      const sender = String(msg.sender_name || "User").trim() || "User";
      const content = String(msg.content || "").trim();
      const preview = content.length > 80 ? `${content.slice(0, 77)}…` : content;
      const title = SUPPORT_NOTIFICATION_TITLE;
      const body = `${sender}: ${preview || "Có tin nhắn từ user."}`;
      const conversationId = Number(payload?.conversationId || msg?.conversation_id || 0) || null;
      const messageId = Number(msg?.id || 0) || null;
      const conversationUserId = Number(payload?.conversation_user_id ?? payload?.conversationUserId ?? 0);

      if (Platform.OS !== "web") {
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
                  type: "support-message",
                  conversation_id: conversationId,
                  message_id: messageId,
                  sender_name: sender,
                  content,
                  sent_at: msg.created_at,
                  conversation_user_id: conversationUserId || undefined,
                },
              },
              trigger: null,
            });
          } catch {
            // ignore
          }
        })();
      }

      void appendNotificationLog({
        type: "support-message",
        title,
        body,
        data: {
          type: "support-message",
          conversation_id: conversationId,
          message_id: messageId,
          conversation_user_id: conversationUserId || undefined,
          sender_name: sender,
          content,
          sent_at: msg.created_at,
        },
        read: false,
      }).catch(() => {});
    };
    socket?.on("support:message:new", onSupportMessage);
    return () => {
      clearInterval(timer);
      unsubLog();
      getRoomChatSocket()?.off("support:message:new", onSupportMessage);
    };
  }, [refreshTabBadgeUnread]);

  const alertsBadge = useMemo(() => {
    if (!tabUnread) return undefined;
    if (tabUnread > 99) return "99+";
    return tabUnread;
  }, [tabUnread]);

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
          tabBarBadge: alertsBadge,
          tabBarBadgeStyle: {
            backgroundColor: "#EF4444",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: "900",
          },
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
