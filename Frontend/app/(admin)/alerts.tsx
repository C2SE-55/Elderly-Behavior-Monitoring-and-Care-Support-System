import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import dayjs from "dayjs";
import {
  deleteNotificationLog,
  getNotificationLogs,
  markAllNotificationLogsReadByType,
  markNotificationLogRead,
  markNotificationLogsReadByGroupSignature,
  NotificationLogEntry,
} from "@/services/notificationLog";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationDetailModal from "@/components/notifications/NotificationDetailModal";
import { isSupportNotificationForAdminInbox } from "@/components/notifications/notificationTypes";

const PRIMARY = "#56328C";

export default function AdminAlertsScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [detailItem, setDetailItem] = useState<NotificationLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<Date | null>(null);
  const mutatingRef = useRef(false);

  const groupKeyOf = useCallback((it: NotificationLogEntry) => {
    const t = Date.parse(String(it.createdAt || ""));
    const minuteBucket = Number.isFinite(t) ? Math.floor(t / 60000) : 0;
    return `${it.type}::${minuteBucket}::${it.title}::${it.body || ""}`;
  }, []);

  const load = useCallback(async () => {
    if (mutatingRef.current) return;
    const rows = await getNotificationLogs();
    const list = Array.isArray(rows) ? rows : [];
    setLogs(list.filter((it) => isSupportNotificationForAdminInbox(it)));
    setLastLoadedAt(new Date());
  }, []);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 3500);
    return () => clearInterval(t);
  }, [load]);

  const dedupedList = useMemo(() => {
    const map = new Map<string, NotificationLogEntry>();
    for (const it of logs) {
      const key = groupKeyOf(it);
      const existing = map.get(key);
      if (!existing) {
        map.set(key, it);
        continue;
      }
      const newer = Date.parse(it.createdAt) > Date.parse(existing.createdAt) ? it : existing;
      const older = newer === it ? existing : it;
      const read = newer.read || older.read;
      const data = { ...(older.data || {}), ...(newer.data || {}) };
      map.set(key, { ...newer, read, data });
    }
    return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [logs, groupKeyOf]);

  const unreadCount = useMemo(() => dedupedList.reduce((acc, it) => acc + (it.read ? 0 : 1), 0), [dedupedList]);
  const totalCount = dedupedList.length;

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount) return;
    setLogs((prev) => prev.map((x) => (!x.read ? { ...x, read: true } : x)));
    mutatingRef.current = true;
    try {
      await markAllNotificationLogsReadByType("support-message");
    } finally {
      mutatingRef.current = false;
    }
    await load();
  }, [load, unreadCount]);

  const openDetail = useCallback(
    async (it: NotificationLogEntry) => {
      const gk = groupKeyOf(it);
      setLogs((prev) => prev.map((x) => (groupKeyOf(x) === gk ? { ...x, read: true } : x)));
      mutatingRef.current = true;
      try {
        if (!it.read) {
          await markNotificationLogsReadByGroupSignature({
            type: it.type,
            createdAt: it.createdAt,
            title: it.title,
            body: it.body,
          });
        } else {
          await markNotificationLogRead(it.id);
        }
      } finally {
        mutatingRef.current = false;
      }
      await load();

      const d: any = it.data || {};
      const supportUserId =
        Number(d?.conversation_user_id ?? d?.conversationUserId ?? d?.user_id ?? 0) || 0;
      if (it.type === "support-message" && supportUserId) {
        const body = String(it.body || "");
        const colon = body.indexOf(":");
        const userNameFromBody = colon > 0 ? body.slice(0, colon).trim() : "";
        const userName =
          userNameFromBody || String(d?.sender_name || "").trim() || `User #${supportUserId}`;
        router.push({
          pathname: "/(screens)/support-chat",
          params: {
            userId: String(supportUserId),
            userName,
            title: "Hỗ trợ trực tiếp",
          },
        });
        return;
      }

      setDetailItem({ ...it, read: true });
      setDetailVisible(true);
    },
    [groupKeyOf, load, router]
  );

  const handleDelete = useCallback(
    async (id: string) => {
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
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={styles.title}>Thông báo</Text>
          <Text style={styles.subTitle}>
            {lastLoadedAt ? `Cập nhật ${dayjs(lastLoadedAt).format("HH:mm")}` : "Đang đồng bộ…"}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.markAllBtn, unreadCount === 0 && styles.markAllBtnDisabled]}
          activeOpacity={0.9}
          onPress={() => void handleMarkAllRead()}
          disabled={unreadCount === 0}
        >
          <Ionicons name="checkmark-done-outline" size={18} color={unreadCount === 0 ? "#9CA3AF" : PRIMARY} />
          <Text style={[styles.markAllText, unreadCount === 0 && styles.markAllTextDisabled]}>Đã đọc</Text>
          {!!unreadCount && (
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{unreadCount > 99 ? "99+" : String(unreadCount)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.statsBar}>
        <Text style={styles.inlineStat}>
          Chưa đọc: <Text style={styles.inlineStatNum}>{unreadCount}</Text>
        </Text>
        <Text style={styles.inlineStatSep}>·</Text>
        <Text style={styles.inlineStat}>
          Tổng: <Text style={styles.inlineStatNum}>{totalCount}</Text>
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <NotificationList
          logs={dedupedList}
          onOptimisticRead={(id) =>
            setLogs((prev) => {
              const target = prev.find((x) => x.id === id);
              if (!target) return prev;
              const gk = groupKeyOf(target);
              return prev.map((x) => (groupKeyOf(x) === gk ? { ...x, read: true } : x));
            })
          }
          onOpenDetail={(it) => void openDetail(it)}
          onMarkRead={(id) => void handleMarkOneRead(id)}
          onDelete={(id) => void handleDelete(id)}
        />
      </View>

      <NotificationDetailModal
        visible={detailVisible}
        item={detailItem}
        myRole={null}
        adminSupportInbox
        onClose={closeDetail}
        onAfterConfirm={() => {
          void (async () => {
            await load();
            if (!detailItem) return;
            const rows = await getNotificationLogs();
            const fresh = rows.find((x) => x.id === detailItem.id) || null;
            setDetailItem(fresh);
          })();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F5F6FF" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    backgroundColor: "#F5F6FF",
  },
  title: { fontSize: 18, fontWeight: "900", color: "#111827" },
  subTitle: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(86,50,140,0.10)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(86,50,140,0.22)",
  },
  markAllBtnDisabled: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  markAllText: { color: PRIMARY, fontWeight: "900", fontSize: 12 },
  markAllTextDisabled: { color: "#9CA3AF" },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  badgeTxt: { color: "#FFFFFF", fontSize: 11, fontWeight: "900" },
  statsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  inlineStat: { fontSize: 12, fontWeight: "700", color: "#64748B" },
  inlineStatNum: { fontWeight: "900", color: PRIMARY },
  inlineStatSep: { color: "#CBD5E1", fontWeight: "900" },
});
