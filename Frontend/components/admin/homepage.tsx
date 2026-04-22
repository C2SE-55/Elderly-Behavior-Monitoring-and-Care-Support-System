import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAdminAccountOverview, getCurrentUser, getSupportConversationsForAdmin } from "@/services/api";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.18)",
  primaryBorder: "rgba(167,139,250,0.35)",
  userAccent: "#2563EB",
  userSoft: "rgba(37,99,235,0.10)",
  familyAccent: "#7C3AED",
  familySoft: "rgba(124,58,237,0.12)",
  dangerBg: "#FEE2E2",
  dangerBorder: "rgba(239,68,68,0.35)",
  dangerText: "#991B1B",
};

const OVERVIEW = {
  peopleBg: "#E0E7FF",
  peopleIcon: "#1E40AF",
  roomBg: "#F3E8FF",
  roomIcon: "#6B21A8",
};

function OverviewStatColumn({
  icon,
  iconBg,
  iconColor,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.overviewCol}>
      <View style={[styles.overviewIconWrap, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <Text style={styles.overviewStatLabel}>{label}</Text>
      <View style={styles.overviewValueSlot}>
        <Text style={styles.overviewValueText}>{value}</Text>
      </View>
    </View>
  );
}

export default function AdminHomepage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = getCurrentUser() as { fullName?: string; username?: string } | null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roomCount, setRoomCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [supportUnread, setSupportUnread] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const c = await getAdminAccountOverview();
      setUserCount(c.user);
      setRoomCount(c.rooms);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được dữ liệu dashboard admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    let cancelled = false;
    const loadSupportUnread = async () => {
      try {
        const rows = await getSupportConversationsForAdmin();
        const total = (rows || []).reduce((acc, it) => acc + Number(it.unread_count || 0), 0);
        if (!cancelled) setSupportUnread(total);
      } catch {
        if (!cancelled) setSupportUnread(0);
      }
    };
    void loadSupportUnread();
    const timer = setInterval(() => void loadSupportUnread(), 5000);
    const socket = connectRoomChatSocket();
    const onSupportMessage = () => void loadSupportUnread();
    socket?.on("support:message:new", onSupportMessage);
    return () => {
      cancelled = true;
      clearInterval(timer);
      getRoomChatSocket()?.off("support:message:new", onSupportMessage);
    };
  }, []);

  const displayName = useMemo(() => me?.fullName || me?.username || "Admin", [me?.fullName, me?.username]);
  const avatarLetter = useMemo(() => String(displayName).trim().charAt(0).toUpperCase() || "A", [displayName]);
  const userPlusRooms = userCount + roomCount;

  const tabBarPad = Math.max(insets.bottom, 12) + 78;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.wrap, { paddingBottom: tabBarPad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{avatarLetter}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.heroBadge}>
                  <Ionicons name="sparkles-outline" size={13} color="#4C1D95" />
                  <Text style={styles.heroBadgeTxt}>EBMS Admin</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={styles.heroSub}>Quản trị tài khoản & phòng theo dõi</Text>
              </View>
            </View>
          </View>
        </View>

        {!!error && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color={COLORS.dangerText} />
            <Text style={styles.errorTxt}>{error}</Text>
          </View>
        )}

        <View style={styles.overviewCard}>
          <Text style={styles.overviewMainTitle}>Tổng quan hệ thống</Text>
          {loading ? (
            <View style={styles.loadingBelowHead}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.loadingTxt}>Đang tải…</Text>
            </View>
          ) : null}
          <View style={styles.overviewTripleRow}>
            <OverviewStatColumn
              icon="home-outline"
              iconBg={OVERVIEW.peopleBg}
              iconColor={OVERVIEW.peopleIcon}
              label="Tổng"
              value={userPlusRooms}
            />
            <OverviewStatColumn
              icon="people-outline"
              iconBg={OVERVIEW.peopleBg}
              iconColor={OVERVIEW.peopleIcon}
              label="USER"
              value={userCount}
            />
            <OverviewStatColumn
              icon="bed-outline"
              iconBg={OVERVIEW.roomBg}
              iconColor={OVERVIEW.roomIcon}
              label="PHÒNG"
              value={roomCount}
            />
          </View>
        </View>

        {supportUnread > 0 ? (
          <TouchableOpacity
            style={styles.supportBanner}
            onPress={() => router.push("/(screens)/admin-support-chat")}
            activeOpacity={0.9}
          >
            <View style={styles.supportBannerIcon}>
              <Ionicons name="notifications" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.supportBannerTitle}>Tin nhắn hỗ trợ chưa đọc</Text>
              <Text style={styles.supportBannerSub}>
                Bạn có {supportUnread} tin từ user — chạm để xem và trả lời
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#4C1D95" />
          </TouchableOpacity>
        ) : null}

        <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Thao tác nhanh</Text>
        <Text style={styles.sectionHint}>Các chức năng quản trị chính của hệ thống</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(screens)/admin-support-chat")}
          activeOpacity={0.92}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: COLORS.userSoft, borderColor: "rgba(37,99,235,0.22)" }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={COLORS.userAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>
              Hỗ trợ trực tiếp{supportUnread > 0 ? ` (${supportUnread})` : ""}
            </Text>
            <Text style={styles.actionSub}>Trao đổi real-time với user để giải đáp nhanh</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/accounts")}
          activeOpacity={0.92}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#FFFFFF", borderColor: COLORS.border }]}>
            <Ionicons name="people-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>Quản lý tài khoản</Text>
            <Text style={styles.actionSub}>Xem, chỉnh sửa và xóa tài khoản người dùng</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/add-account")}
          activeOpacity={0.92}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#FFFFFF", borderColor: COLORS.border }]}>
            <Ionicons name="person-add-outline" size={22} color={COLORS.userAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>Tạo tài khoản mới</Text>
            <Text style={styles.actionSub}>Thêm user, family hoặc caregiver vào hệ thống</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/room-management")}
          activeOpacity={0.92}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#FFFFFF", borderColor: COLORS.border }]}>
            <Ionicons name="key-outline" size={22} color={COLORS.familyAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>Quản lý phòng</Text>
            <Text style={styles.actionSub}>Tạo room, sinh room_id và mã QR cho gia đình</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push("/(admin)/alerts")}
          activeOpacity={0.92}
        >
          <View style={[styles.actionIconWrap, { backgroundColor: "#FFFFFF", borderColor: COLORS.border }]}>
            <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>Thông báo</Text>
            <Text style={styles.actionSub}>Chỉ tin hỗ trợ từ user — không có tab té ngã hay nhắc thuốc</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { paddingHorizontal: 18, paddingTop: 14, gap: 12 },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, zIndex: 1 },
  heroLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: 20, fontWeight: "900" },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.65)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.18)",
  },
  heroBadgeTxt: { fontSize: 11, fontWeight: "800", color: "#4C1D95" },
  heroTitle: { marginTop: 8, fontSize: 20, fontWeight: "900", color: "#2E1065" },
  heroSub: { marginTop: 4, fontSize: 12, fontWeight: "700", color: "#4B5563", lineHeight: 17 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: COLORS.dangerBg,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorTxt: { flex: 1, color: COLORS.dangerText, fontSize: 12, fontWeight: "700", lineHeight: 18 },
  supportBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#EDE9FE",
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  supportBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  supportBannerTitle: { fontSize: 14, fontWeight: "900", color: "#2E1065" },
  supportBannerSub: { marginTop: 3, fontSize: 12, fontWeight: "700", color: "#5B21B6", lineHeight: 17 },
  overviewCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "rgba(191,219,254,0.45)",
    borderRadius: 20,
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  overviewMainTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text, lineHeight: 20 },
  overviewTripleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 6,
    paddingTop: 4,
  },
  overviewCol: { flex: 1, minWidth: 0, alignItems: "center", gap: 8 },
  overviewIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  overviewStatLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 16,
    textAlign: "center",
  },
  overviewValueSlot: {
    minHeight: 44,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  overviewValueText: { fontSize: 22, fontWeight: "900", color: COLORS.primary, textAlign: "center" },

  sectionTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text, lineHeight: 20 },
  sectionSpaced: { marginTop: 8 },
  sectionHint: { marginTop: -4, fontSize: 12, fontWeight: "700", color: COLORS.sub, lineHeight: 17 },
  loadingBelowHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingTxt: { fontSize: 12, fontWeight: "700", color: COLORS.sub },

  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
    borderLeftColor: "rgba(86,50,140,0.45)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.02,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  actionTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  actionSub: { marginTop: 3, fontSize: 12, fontWeight: "600", color: COLORS.sub, lineHeight: 17 },

});
