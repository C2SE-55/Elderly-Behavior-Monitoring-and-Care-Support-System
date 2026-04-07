import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deleteNotificationLog,
  getNotificationLogs,
  markAllNotificationLogsRead,
  markNotificationLogRead,
  markNotificationLogsReadByGroupSignature,
  NotificationLogEntry,
} from "@/services/notificationLog";
import NotificationList from "@/components/notifications/NotificationList";
import NotificationDetailModal from "@/components/notifications/NotificationDetailModal";
import { getMyRoom, type RoomMemberRole } from "@/services/api";
import dayjs from "dayjs";

export default function NotificationsScreen() {
  const [logs, setLogs] = useState<NotificationLogEntry[]>([]);
  const [detailItem, setDetailItem] = useState<NotificationLogEntry | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [myRole, setMyRole] = useState<RoomMemberRole | null>(null);
  const mutatingRef = useRef(false);

  const groupKeyOf = useCallback((it: NotificationLogEntry) => {
    const t = Date.parse(String(it.createdAt || ""));
    const minuteBucket = Number.isFinite(t) ? Math.floor(t / 60000) : 0;
    return `${it.type}::${minuteBucket}::${it.title}::${it.body || ""}`;
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

  useEffect(() => {
    const syncRole = async () => {
      try {
        const room = await getMyRoom();
        setMyRole(room?.member_role ?? null);
      } catch {
        setMyRole(null);
      }
    };
    void syncRole();
    const t = setInterval(() => void syncRole(), 10_000);
    return () => clearInterval(t);
  }, []);

  const unreadCount = useMemo(() => logs.reduce((acc, it) => acc + (it.read ? 0 : 1), 0), [logs]);

  const dedupedLogs = useMemo(() => {
    // Dedupe for UI: same type + same minute + same title/body => show 1
    // Keep newest, but merge state so we don't lose confirmations/read.
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
      // merge read for UI: if user read ANY of the duplicates, hide unread dot for the group
      const read = newer.read || older.read;
      // shallow merge data (prefer newer fields, but keep older if missing)
      const data = { ...(older.data || {}), ...(newer.data || {}) };
      map.set(key, { ...newer, read, data });
    }
    return Array.from(map.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  }, [logs]);

  const handleMarkAllRead = useCallback(async () => {
    if (!unreadCount) return;
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
      const gk = groupKeyOf(it);
      // optimistic: reflect read state immediately in list + detail
      setLogs((prev) => prev.map((x) => (groupKeyOf(x) === gk ? { ...x, read: true } : x)));
      setDetailItem({ ...it, read: true });
      setDetailVisible(true);
      // persist (mark whole group so dot won't come back)
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
          // fallback for old entries
          await markNotificationLogRead(it.id);
        }
      } finally {
        mutatingRef.current = false;
      }
      await load();
    },
    [groupKeyOf, load]
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
      <NotificationList
        logs={dedupedLogs}
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

      <NotificationDetailModal
        visible={detailVisible}
        item={detailItem}
        myRole={myRole}
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
  dot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#EF4444" },
});
