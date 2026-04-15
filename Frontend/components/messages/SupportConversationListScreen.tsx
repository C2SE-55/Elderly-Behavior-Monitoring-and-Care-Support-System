import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import dayjs from "dayjs";
import { getSupportConversationsForAdmin, SupportConversation } from "@/services/api";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.30)",
};

const fmtTime = (iso: string | null | undefined) => {
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
  if (!s) return "U";
  const parts = s.split(/\s+/).filter(Boolean);
  const a = (parts[0] || "U").slice(0, 1).toUpperCase();
  const b = (parts[1] || "").slice(0, 1).toUpperCase();
  return (a + b).slice(0, 2);
};

export default function SupportConversationListScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    const data = await getSupportConversationsForAdmin();
    setRows(data || []);
  }, []);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filteredRows = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((r) => {
      const hay = `${r.user_name || ""} ${r.last_sender_name || ""} ${r.last_content || ""}`.toLowerCase();
      return hay.includes(keyword);
    });
  }, [q, rows]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity style={styles.homeBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#56328C" />
            <Text style={styles.homeBtnText}>Quay lại</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.title}>Hỗ trợ trực tiếp</Text>
        <Text style={styles.sub}>Theo dõi và phản hồi thắc mắc của user theo thời gian thực</Text>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color="#64748B" />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Tìm theo tên user hoặc nội dung..."
            placeholderTextColor="#94A3B8"
            style={styles.searchInput}
          />
        </View>
      </View>

      <FlatList
        data={filteredRows}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? "Đang tải hội thoại..." : "Chưa có hội thoại hỗ trợ nào."}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.rowCard, Number(item.unread_count || 0) > 0 && styles.rowCardUnread]}
            activeOpacity={0.85}
            onPress={() =>
              router.push({
                pathname: "/(screens)/support-chat",
                params: {
                  userId: String(item.user_id),
                  userName: String(item.user_name || ""),
                  title: "Hỗ trợ trực tiếp",
                },
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initialsOf(String(item.user_name || ""))}</Text>
            </View>
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={[styles.roomName, Number(item.unread_count || 0) > 0 && styles.roomNameUnread]} numberOfLines={1}>
                  {String(item.user_name || `User #${item.user_id}`)}
                </Text>
                <Text style={styles.time}>{fmtTime(item.last_sent_at)}</Text>
              </View>
              <View style={styles.rowBottom}>
                <Text style={[styles.preview, Number(item.unread_count || 0) > 0 && styles.previewUnread]} numberOfLines={1}>
                  {item.last_sender_name ? `${item.last_sender_name}: ` : ""}
                  {item.last_content || "Chưa có tin nhắn"}
                </Text>
                {Number(item.unread_count || 0) > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{Number(item.unread_count || 0) > 99 ? "99+" : item.unread_count}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.bg },
  headerTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  homeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  homeBtnText: { fontSize: 13, fontWeight: "900", color: COLORS.primary },
  title: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  sub: { marginTop: 4, fontSize: 12, color: COLORS.sub, fontWeight: "700" },
  searchWrap: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.text },
  empty: { marginTop: 18, textAlign: "center", color: "#64748B", fontSize: 14 },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowCardUnread: { borderColor: "rgba(167,139,250,0.55)", backgroundColor: "rgba(167,139,250,0.16)" },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
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
});
