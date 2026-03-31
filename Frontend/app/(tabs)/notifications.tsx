import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import { Swipeable } from "react-native-gesture-handler";
import {
  deleteNotificationLog,
  getNotificationLogs,
  markAllNotificationLogsRead,
  markNotificationLogRead,
  NotificationLogEntry,
} from "@/services/notificationLog";

export default function NotificationsScreen() {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [detailItem, setDetailItem] = useState<NotificationLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const mutatingRef = useRef(false);
  const swipeRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const openSwipeIdRef = useRef<string | null>(null);
  const formatWhen = useCallback((iso: string) => {
    const d = dayjs(iso);
    if (!d.isValid()) return "";
    const now = dayjs();
    if (d.isSame(now, "day")) return `Hôm nay ${d.format("HH:mm")}`;
    if (d.isSame(now.subtract(1, "day"), "day")) return `Hôm qua ${d.format("HH:mm")}`;
    return d.format("DD/MM HH:mm");
  }, []);

  const typeLabel = useCallback((type: NotificationLogEntry["type"]) => {
    if (type === "weekly-schedule") return "Quản lý lịch sinh hoạt";
    if (type === "medication") return "Nhắc nhở uống thuốc";
    return "Hệ thống";
  }, []);

  const typeTone = useCallback((type: NotificationLogEntry["type"]) => {
    if (type === "medication") {
      return { bg: "#EEF2FF", border: "#C7D2FE", text: "#1D4ED8" }; // blue
    }
    if (type === "weekly-schedule") {
      return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" }; // green
    }
    return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" }; // gray
  }, []);

  const load = useCallback(async () => {
    if (mutatingRef.current) return;
    const rows = await getNotificationLogs();
    setLogs(rows);
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3500);
    return () => clearInterval(t);
  }, [load]);

  const unreadCount = useMemo(() => logs.reduce((acc, it) => acc + (it.read ? 0 : 1), 0), [logs]);

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount) return;
    // close any open swipe quickly
    const openId = openSwipeIdRef.current;
    if (openId) {
      swipeRefs.current.get(openId)?.close();
      openSwipeIdRef.current = null;
    }
    // optimistic: fade immediately
    setLogs((prev) => prev.map((x) => (x.read ? x : { ...x, read: true })));

    mutatingRef.current = true;
    try {
      await markAllNotificationLogsRead();
    } finally {
      mutatingRef.current = false;
    }
    await load();
  }, [load, unreadCount]);

  const openDetail = useCallback(
    async (it: NotificationLogEntry) => {
      // optimistic: reflect read state immediately in list + detail
      if (!it.read) {
        setLogs((prev) => prev.map((x) => (x.id === it.id ? { ...x, read: true } : x)));
        setDetailItem({ ...it, read: true });
      } else {
        setDetailItem(it);
      }
      setDetailVisible(true);
      if (!it.read) {
        // persist
        mutatingRef.current = true;
        try {
          await markNotificationLogRead(it.id);
        } finally {
          mutatingRef.current = false;
        }
        await load();
      }
    },
    [load]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      // optimistic UI
      setLogs((prev) => prev.filter((x) => x.id !== id));
      mutatingRef.current = true;
      try {
        await deleteNotificationLog(id);
      } finally {
        mutatingRef.current = false;
      }
      await load();
    },
    [load]
  );

  const handleMarkOneRead = useCallback(
    async (id: string) => {
      setLogs((prev) => prev.map((x) => (x.id === id ? { ...x, read: true } : x)));
      mutatingRef.current = true;
      try {
        await markNotificationLogRead(id);
      } finally {
        mutatingRef.current = false;
      }
      await load();
    },
    [load]
  );

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    // ensure UI reflects latest read status after closing
    void load();
  }, [load]);

  const closeOpenSwipe = useCallback(() => {
    const openId = openSwipeIdRef.current;
    if (!openId) return;
    swipeRefs.current.get(openId)?.close();
    openSwipeIdRef.current = null;
  }, []);

  const detailMeta = useMemo(() => {
    if (!detailItem) return null;
    return {
      whenFull: dayjs(detailItem.createdAt).isValid() ? dayjs(detailItem.createdAt).format("DD/MM/YYYY HH:mm") : "",
      typeText: typeLabel(detailItem.type),
    };
  }, [detailItem, typeLabel]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Thông báo</Text>
        <TouchableOpacity
          style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
          activeOpacity={0.9}
          onPress={() => void handleMarkAllRead()}
          disabled={unreadCount === 0}
        >
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Đã đọc tất cả</Text>
          {!!unreadCount && <View style={styles.dot} />}
        </TouchableOpacity>
      </View>
      <FlatList
        data={logs}
        keyExtractor={(it) => it.id}
        contentContainerStyle={[styles.container, logs.length === 0 && { flex: 1, justifyContent: "center" }]}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={closeOpenSwipe}
        onMomentumScrollBegin={closeOpenSwipe}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: it }) => (
          <View style={styles.swipeRow}>
            <Swipeable
              ref={(ref) => {
                swipeRefs.current.set(it.id, ref);
              }}
              // Make close/open feel snappier (less "delay")
              friction={1}
              rightThreshold={0}
              overshootRight={false}
              overshootFriction={12}
              useNativeAnimations
              animationOptions={{ duration: 80 }}
              onSwipeableWillOpen={() => {
                const openId = openSwipeIdRef.current;
                if (openId && openId !== it.id) {
                  swipeRefs.current.get(openId)?.close();
                }
                openSwipeIdRef.current = it.id;
              }}
              onSwipeableWillClose={() => {
                if (openSwipeIdRef.current === it.id) openSwipeIdRef.current = null;
              }}
              renderRightActions={() => (
                <View style={styles.swipeActions}>
                  <TouchableOpacity
                    style={[styles.swipeBtn, styles.swipeReadBtn, it.read && styles.swipeReadBtnDisabled]}
                    activeOpacity={0.9}
                    onPress={() => {
                      swipeRefs.current.get(it.id)?.close();
                      void handleMarkOneRead(it.id);
                    }}
                    disabled={it.read}
                  >
                    <Text style={[styles.swipeBtnText, it.read && styles.swipeBtnTextDisabled]}>Đã đọc</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.swipeBtn, styles.swipeDeleteBtn]}
                    activeOpacity={0.9}
                    onPress={() => {
                      swipeRefs.current.get(it.id)?.close();
                      void handleDelete(it.id);
                    }}
                  >
                    <Text style={[styles.swipeBtnText, styles.swipeDeleteText]}>Xóa</Text>
                  </TouchableOpacity>
                </View>
              )}
            >
              <TouchableOpacity
                style={[styles.card, it.read && styles.cardRead]}
                activeOpacity={0.85}
                onPressIn={() => {
                  if (!it.read) setLogs((prev) => prev.map((x) => (x.id === it.id ? { ...x, read: true } : x)));
                }}
                onPress={() => {
                  closeOpenSwipe();
                  void openDetail(it);
                }}
              >
                <View style={[styles.typeBar, { backgroundColor: typeTone(it.type).text, opacity: it.read ? 0.35 : 1 }]} />
                <View style={styles.cardTop}>
                  <Text style={[styles.cardTitle, it.read && styles.cardTitleRead]}>{it.title}</Text>
                  <Text style={styles.time}>{formatWhen(it.createdAt)}</Text>
                </View>
                {!!it.body && <Text style={[styles.body, it.read && styles.bodyRead]}>{it.body}</Text>}
                <View
                  style={[
                    styles.badgePill,
                    { backgroundColor: typeTone(it.type).bg, borderColor: typeTone(it.type).border, opacity: it.read ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.badge, { color: typeTone(it.type).text }]}>{typeLabel(it.type)}</Text>
                </View>
              </TouchableOpacity>
            </Swipeable>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.subtitle}>Chưa có thông báo.</Text>}
      />

      <Modal
        visible={detailVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDetail}
        statusBarTranslucent
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết thông báo</Text>
              <TouchableOpacity onPress={closeDetail} hitSlop={10}>
                <Text style={styles.modalClose}>Đóng</Text>
              </TouchableOpacity>
            </View>

            {!detailItem ? (
              <Text style={styles.modalBodyText}>Không có dữ liệu.</Text>
            ) : (
              <>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Mục</Text>
                  <Text style={styles.metaValue}>{detailMeta?.typeText}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Thời gian</Text>
                  <Text style={styles.metaValue}>{detailMeta?.whenFull}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Tiêu đề</Text>
                  <Text style={styles.metaValue}>{detailItem.title}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Nội dung</Text>
                  <Text style={styles.modalBodyText}>{detailItem.body?.trim() ? detailItem.body : "—"}</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
  },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  markAllBtnDisabled: { backgroundColor: "#F3F4F6" },
  markAllText: { color: "#1D4ED8", fontWeight: "900", fontSize: 12 },
  markAllTextDisabled: { color: "#9CA3AF" },
  readBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readBtnDisabled: { backgroundColor: "#F3F4F6" },
  readText: { color: "#1D4ED8", fontWeight: "900", fontSize: 12 },
  readTextDisabled: { color: "#9CA3AF" },
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#EF4444" },
  container: { padding: 16, gap: 10, paddingBottom: 24 },
  subtitle: { fontSize: 14, color: "#6B7280", textAlign: "center", marginTop: 30 },
  swipeRow: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  card: {
    backgroundColor: "#FFF",
    padding: 12,
    gap: 6,
  },
  typeBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardRead: { opacity: 0.7, backgroundColor: "#F8FAFC" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "900" },
  cardTitleRead: { color: "#374151" },
  time: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
  body: { color: "#374151", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bodyRead: { color: "#6B7280" },
  badgePill: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge: { fontSize: 11, fontWeight: "900" },

  swipeActions: {
    flexDirection: "row",
    alignItems: "stretch",
    height: "100%",
  },
  swipeBtn: {
    width: 86,
    justifyContent: "center",
    alignItems: "center",
  },
  swipeReadBtn: {
    backgroundColor: "#EEF2FF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRightWidth: 0,
  },
  swipeReadBtnDisabled: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  swipeDeleteBtn: { backgroundColor: "#EF4444" },
  swipeBtnText: { fontSize: 12, fontWeight: "900", color: "#1D4ED8" },
  swipeBtnTextDisabled: { color: "#9CA3AF" },
  swipeDeleteText: { color: "#FFFFFF" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  modalClose: { fontSize: 12, fontWeight: "900", color: "#2563EB" },
  metaRow: { gap: 4 },
  metaLabel: { fontSize: 12, fontWeight: "900", color: "#6B7280" },
  metaValue: { fontSize: 14, fontWeight: "800", color: "#111827", lineHeight: 20 },
  modalBodyText: { fontSize: 14, fontWeight: "600", color: "#374151", lineHeight: 20 },
});
