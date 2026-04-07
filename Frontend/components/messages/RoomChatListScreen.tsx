import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  getCurrentUser,
  getMyRooms,
  getRoomChatNotificationPrefs,
  getRoomsUnreadSummary,
  MyRoomSummary,
  RoomChatNotificationPrefItem,
  RoomUnreadSummaryItem,
  setActiveRoomId,
  setRoomChatNotificationPref,
} from "@/services/api";
import { appendNotificationLog } from "@/services/notificationLog";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

type Row = {
  room_id: number;
  room_name: string;
  member_role: "host" | "caretaker";
  unread_count: number;
  last_sender_name: string | null;
  last_content: string | null;
  last_sent_at: string | null;
  chat_notifications_enabled: boolean;
};

const fmtTime = (iso: string | null) => {
  if (!iso) return "";
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  return d.format("HH:mm DD/MM");
};

export default function RoomChatListScreen() {
  const router = useRouter();
  const myUserId = Number(getCurrentUser()?.id || 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const chatNotifByRoomRef = useRef<Map<number, boolean>>(new Map());

  const load = useCallback(async () => {
    const [rooms, summary, notifPrefs] = await Promise.all([
      getMyRooms(),
      getRoomsUnreadSummary(),
      getRoomChatNotificationPrefs().catch(() => [] as RoomChatNotificationPrefItem[]),
    ]);
    const summaryMap = new Map<number, RoomUnreadSummaryItem>();
    summary.forEach((it) => summaryMap.set(Number(it.room_id), it));
    const notifMap = new Map<number, boolean>();
    notifPrefs.forEach((p) => notifMap.set(Number(p.room_id), p.chat_notifications_enabled));
    const merged = (rooms || []).map((room: MyRoomSummary) => {
      const sum = summaryMap.get(Number(room.id));
      const rid = Number(room.id);
      const notifEnabled = notifMap.has(rid) ? !!notifMap.get(rid) : true;
      return {
        room_id: rid,
        room_name: room.room_id,
        member_role: room.member_role,
        unread_count: Number(sum?.unread_count || 0),
        last_sender_name: sum?.last_sender_name ?? null,
        last_content: sum?.last_content ?? null,
        last_sent_at: sum?.last_sent_at ?? null,
        chat_notifications_enabled: notifEnabled,
      } as Row;
    });
    merged.sort((a, b) => {
      const ta = a.last_sent_at ? dayjs(a.last_sent_at).valueOf() : 0;
      const tb = b.last_sent_at ? dayjs(b.last_sent_at).valueOf() : 0;
      return tb - ta;
    });
    setRows(merged);
    const m = new Map<number, boolean>();
    merged.forEach((r) => m.set(r.room_id, r.chat_notifications_enabled));
    chatNotifByRoomRef.current = m;
  }, []);

  useEffect(() => {
    const m = new Map<number, boolean>();
    rows.forEach((r) => m.set(r.room_id, r.chat_notifications_enabled));
    chatNotifByRoomRef.current = m;
  }, [rows]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await load();
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    const socket = connectRoomChatSocket();
    if (!socket) return;

    const onMessageNew = (payload: any) => {
      const msg = payload?.message;
      const roomId = Number(payload?.roomId || msg?.room_id || 0);
      if (!roomId || !msg) return;
      setRows((prev) => {
        const roomName = prev.find((r) => r.room_id === roomId)?.room_name || `Room #${roomId}`;
        if (Number(msg.sender_user_id || 0) !== myUserId) {
          const notifOn = chatNotifByRoomRef.current.get(roomId) !== false;
          if (notifOn) {
            void appendNotificationLog({
              type: "room-message",
              title: `Phòng ${roomName} có tin nhắn mới`,
              body: `${msg.sender_name}: ${msg.content} (${fmtTime(msg.created_at || null)})`,
              data: {
                room_id: roomId,
                room_name: roomName,
                sender_name: msg.sender_name,
                content: msg.content,
                sent_at: msg.created_at,
              },
              read: false,
            });
          }
        }
        return prev
          .map((x) =>
            x.room_id === roomId
              ? {
                  ...x,
                  unread_count: x.unread_count + 1,
                  last_sender_name: msg.sender_name || x.last_sender_name,
                  last_content: msg.content || x.last_content,
                  last_sent_at: msg.created_at || x.last_sent_at,
                }
              : x
          )
          .sort((a, b) => {
            const ta = a.last_sent_at ? dayjs(a.last_sent_at).valueOf() : 0;
            const tb = b.last_sent_at ? dayjs(b.last_sent_at).valueOf() : 0;
            return tb - ta;
          });
      });
    };

    socket.on("message:new", onMessageNew);
    return () => {
      const live = getRoomChatSocket();
      live?.off("message:new", onMessageNew);
    };
  }, [myUserId]);

  const onToggleRoomNotifications = useCallback(async (roomId: number, next: boolean) => {
    const prev = chatNotifByRoomRef.current.get(roomId);
    chatNotifByRoomRef.current.set(roomId, next);
    setRows((r) =>
      r.map((row) => (row.room_id === roomId ? { ...row, chat_notifications_enabled: next } : row))
    );
    try {
      await setRoomChatNotificationPref(roomId, next);
    } catch {
      const revert = prev !== false;
      chatNotifByRoomRef.current.set(roomId, revert);
      setRows((r) =>
        r.map((row) => (row.room_id === roomId ? { ...row, chat_notifications_enabled: revert } : row))
      );
      Alert.alert("Lỗi", "Không lưu được cài đặt thông báo. Vui lòng thử lại.");
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const emptyText = useMemo(() => {
    if (loading) return "Đang tải danh sách hội thoại...";
    return "Bạn chưa tham gia room nào.";
  }, [loading]);

  const goHome = () => {
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.homeBtn} onPress={goHome} accessibilityRole="button" accessibilityLabel="Trang chủ">
            <Feather name="home" size={22} color="#56328C" />
            <Text style={styles.homeBtnText}>Trang chủ</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Tin nhắn theo phòng</Text>
        <Text style={styles.sub}>Mỗi room có hội thoại riêng</Text>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => String(item.room_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
                setActiveRoomId(item.room_id);
                router.push({
                  pathname: "/(screens)/room-chat",
                  params: {
                    roomId: String(item.room_id),
                    roomName: item.room_name,
                  },
                });
              }}
            >
              <View style={styles.cardTop}>
                <Text style={styles.roomName}>{item.room_name}</Text>
                <Text style={styles.time}>{fmtTime(item.last_sent_at)}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={1}>
                {item.last_sender_name ? `${item.last_sender_name}: ` : ""}
                {item.last_content || "Chưa có tin nhắn"}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.role}>{item.member_role === "host" ? "Host" : "Caregiver"}</Text>
                {item.unread_count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.notifRow}>
              <Text style={styles.notifLabel}>Thông báo tin nhắn</Text>
              <Switch
                value={item.chat_notifications_enabled}
                onValueChange={(v) => void onToggleRoomNotifications(item.room_id, v)}
                trackColor={{ false: "#CBD5E1", true: "#C4B5FD" }}
                thumbColor={item.chat_notifications_enabled ? "#56328C" : "#F1F5F9"}
              />
            </View>
          </View>
        )}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  homeBtnText: { fontSize: 13, fontWeight: "800", color: "#56328C" },
  title: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  sub: { marginTop: 4, fontSize: 12, color: "#64748B" },
  empty: { marginTop: 18, textAlign: "center", color: "#64748B", fontSize: 14 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  roomName: { fontSize: 16, fontWeight: "800", color: "#111827", flex: 1 },
  time: { marginLeft: 8, fontSize: 11, color: "#64748B" },
  preview: { marginTop: 8, color: "#334155", fontSize: 14 },
  metaRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  role: { fontSize: 11, fontWeight: "700", color: "#7C3AED" },
  badge: {
    minWidth: 22,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontWeight: "800", fontSize: 11 },
  notifRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  notifLabel: { fontSize: 13, fontWeight: "600", color: "#475569" },
});
