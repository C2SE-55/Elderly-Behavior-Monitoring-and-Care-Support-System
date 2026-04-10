import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import type { AxiosError } from "axios";
import { Swipeable } from "react-native-gesture-handler";
import {
  getCurrentUser,
  getMyRooms,
  getRoomChatNotificationPrefs,
  getRoomsUnreadSummary,
  MyRoomSummary,
  logoutUser,
  RoomChatNotificationPrefItem,
  RoomUnreadSummaryItem,
  setRoomChatNotificationPref,
} from "@/services/api";
import { appendNotificationLog } from "@/services/notificationLog";
import {
  connectRoomChatSocket,
  getRoomChatSocket,
  seedRoomChatNotifPrefsCache,
  setRoomChatNotifPrefCached,
} from "@/services/roomChatSocket";

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
  const now = dayjs();
  if (d.isSame(now, "day")) return d.format("HH:mm");
  if (d.isSame(now.subtract(1, "day"), "day")) return "Hôm qua";
  return d.format("DD/MM");
};

const initialsOf = (name: string) => {
  const s = String(name || "").trim();
  if (!s) return "R";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] || "R").slice(0, 1).toUpperCase();
  const b = (parts[1] || "").slice(0, 1).toUpperCase();
  return (a + b).slice(0, 2);
};

export default function RoomChatListScreen() {
  const router = useRouter();
  const myUserId = Number(getCurrentUser()?.id || 0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const chatNotifByRoomRef = useRef<Map<number, boolean>>(new Map());
  const openSwipeRef = useRef<Swipeable | null>(null);

  const load = useCallback(async () => {
    try {
      const [rooms, summary, notifPrefs] = await Promise.all([
        getMyRooms(),
        getRoomsUnreadSummary(),
        getRoomChatNotificationPrefs().catch(() => [] as RoomChatNotificationPrefItem[]),
      ]);
      const summaryMap = new Map<number, RoomUnreadSummaryItem>();
      summary.forEach((it) => summaryMap.set(Number(it.room_id), it));
      const notifMap = new Map<number, boolean>();
      notifPrefs.forEach((p) => notifMap.set(Number(p.room_id), p.chat_notifications_enabled));
      seedRoomChatNotifPrefsCache(notifPrefs);
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
    } catch (e) {
      const ax = e as AxiosError<any>;
      const status = Number(ax?.response?.status || 0);
      if (status === 401) {
        logoutUser();
        setRows([]);
        chatNotifByRoomRef.current = new Map();
        return;
      }
      // ignore transient network errors
    }
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
    setRoomChatNotifPrefCached(roomId, next);
    setRows((r) =>
      r.map((row) => (row.room_id === roomId ? { ...row, chat_notifications_enabled: next } : row))
    );
    try {
      await setRoomChatNotificationPref(roomId, next);
    } catch {
      const revert = prev !== false;
      chatNotifByRoomRef.current.set(roomId, revert);
      setRoomChatNotifPrefCached(roomId, revert);
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

  const filteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((r) => {
      const hay = `${r.room_name} ${r.last_sender_name || ""} ${r.last_content || ""}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [q, rows]);

  const goHome = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  };

  const openRoom = (item: Row) => {
    router.push({
      pathname: "/(screens)/room-chat",
      params: {
        roomId: String(item.room_id),
        roomName: item.room_name,
      },
    });
  };

  const openActions = (item: Row) => {
    const enabled = item.chat_notifications_enabled !== false;
    const nextLabel = enabled ? "Tắt thông báo" : "Bật thông báo";
    Alert.alert(item.room_name, "Tùy chọn hội thoại", [
      {
        text: nextLabel,
        onPress: () => void onToggleRoomNotifications(item.room_id, !enabled),
      },
      { text: "Mở chat", onPress: () => openRoom(item) },
      { text: "Đóng", style: "cancel" },
    ]);
  };

  const closeOpenSwipe = () => {
    openSwipeRef.current?.close();
    openSwipeRef.current = null;
  };

  const renderRightActions = (item: Row, swipeRef?: Swipeable | null) => {
    const enabled = item.chat_notifications_enabled !== false;
    return (
      <View style={styles.swipeActions}>
        <TouchableOpacity
          style={[styles.swipeBtn, enabled ? styles.swipeBtnOff : styles.swipeBtnOn]}
          activeOpacity={0.85}
          onPress={() => {
            if (swipeRef) swipeRef.close();
            openSwipeRef.current = null;
            void onToggleRoomNotifications(item.room_id, !enabled);
          }}
          accessibilityRole="button"
          accessibilityLabel={enabled ? "Tắt thông báo" : "Bật thông báo"}
        >
          <Feather name={enabled ? "bell-off" : "bell"} size={18} color="#FFFFFF" />
          <Text style={styles.swipeBtnText}>{enabled ? "Tắt" : "Bật"}</Text>
        </TouchableOpacity>
      </View>
    );
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
        <Text style={styles.title}>Tin nhắn</Text>
        <Text style={styles.sub}>Giống Messenger: tìm kiếm + hội thoại</Text>

        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color="#64748B" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Tìm theo room hoặc nội dung..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
          {!!q && (
            <TouchableOpacity onPress={() => setQ("")} hitSlop={8} accessibilityRole="button" accessibilityLabel="Xóa tìm kiếm">
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.room_id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
        renderItem={({ item }) => {
          let swipeRef: Swipeable | null = null;
          return (
            <Swipeable
              ref={(r) => {
                swipeRef = r;
              }}
              renderRightActions={() => renderRightActions(item, swipeRef)}
              rightThreshold={36}
              overshootRight={false}
              onSwipeableWillOpen={() => {
                if (openSwipeRef.current && openSwipeRef.current !== swipeRef) openSwipeRef.current.close();
                openSwipeRef.current = swipeRef;
              }}
              onSwipeableWillClose={() => {
                if (openSwipeRef.current === swipeRef) openSwipeRef.current = null;
              }}
            >
              <TouchableOpacity
                style={[styles.rowCard, item.unread_count > 0 && styles.rowCardUnread]}
                activeOpacity={0.8}
                onPress={() => {
                  closeOpenSwipe();
                  openRoom(item);
                }}
                onLongPress={() => {
                  closeOpenSwipe();
                  openActions(item);
                }}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initialsOf(item.room_name)}</Text>
                </View>

                <View style={styles.rowMain}>
                  <View style={styles.rowTop}>
                    <Text style={[styles.roomName, item.unread_count > 0 && styles.roomNameUnread]} numberOfLines={1}>
                      {item.room_name}
                    </Text>
                    <Text style={styles.time}>{fmtTime(item.last_sent_at)}</Text>
                  </View>

                  <View style={styles.rowBottom}>
                    <Text style={[styles.preview, item.unread_count > 0 && styles.previewUnread]} numberOfLines={1}>
                      {item.last_sender_name ? `${item.last_sender_name}: ` : ""}
                      {item.last_content || "Chưa có tin nhắn"}
                    </Text>

                    {item.unread_count > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unread_count > 99 ? "99+" : item.unread_count}</Text>
                      </View>
                    ) : (
                      <Feather
                        name={item.chat_notifications_enabled ? "bell" : "bell-off"}
                        size={14}
                        color={item.chat_notifications_enabled ? "#94A3B8" : "#CBD5E1"}
                      />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Swipeable>
          );
        }}
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
  searchWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A" },
  empty: { marginTop: 18, textAlign: "center", color: "#64748B", fontSize: 14 },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rowCardUnread: { borderColor: "#C7D2FE", backgroundColor: "#EEF2FF" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#56328C", fontWeight: "900", fontSize: 14 },
  rowMain: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  roomName: { fontSize: 15, fontWeight: "800", color: "#111827", flex: 1 },
  roomNameUnread: { color: "#0F172A" },
  time: { fontSize: 11, color: "#64748B", fontWeight: "700" },
  rowBottom: { flexDirection: "row", alignItems: "center", gap: 10 },
  preview: { flex: 1, color: "#475569", fontSize: 13, fontWeight: "600" },
  previewUnread: { color: "#0F172A", fontWeight: "800" },
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
  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "flex-end",
    marginLeft: 12,
  },
  swipeBtn: {
    width: 86,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  swipeBtnOff: { backgroundColor: "#EF4444" },
  swipeBtnOn: { backgroundColor: "#10B981" },
  swipeBtnText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
});
