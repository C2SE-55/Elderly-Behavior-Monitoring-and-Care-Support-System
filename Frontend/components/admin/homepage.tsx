import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAdminUsers, getCurrentUser } from "@/services/api";

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
  careAccent: "#0D9488",
  careSoft: "rgba(13,148,136,0.12)",
  dangerBg: "#FEE2E2",
  dangerBorder: "rgba(239,68,68,0.35)",
  dangerText: "#991B1B",
};

type StatTone = "primary" | "user" | "family" | "care";

const STAT_TONES: Record<
  StatTone,
  { icon: keyof typeof Ionicons.glyphMap; accent: string; soft: string; border: string }
> = {
  primary: {
    icon: "people-outline",
    accent: COLORS.primary,
    soft: COLORS.primarySoft,
    border: COLORS.primaryBorder,
  },
  user: {
    icon: "person-outline",
    accent: COLORS.userAccent,
    soft: COLORS.userSoft,
    border: "rgba(37,99,235,0.22)",
  },
  family: {
    icon: "home-outline",
    accent: COLORS.familyAccent,
    soft: COLORS.familySoft,
    border: "rgba(124,58,237,0.22)",
  },
  care: {
    icon: "heart-outline",
    accent: COLORS.careAccent,
    soft: COLORS.careSoft,
    border: "rgba(13,148,136,0.22)",
  },
};

export default function AdminHomepage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const me = getCurrentUser() as { fullName?: string; username?: string } | null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usersCount, setUsersCount] = useState(0);
  const [familyCount, setFamilyCount] = useState(0);
  const [caregiverCount, setCaregiverCount] = useState(0);
  const [userCount, setUserCount] = useState(0);

  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getAdminUsers();
      setUsersCount(rows.length);
      setFamilyCount(rows.filter((x) => String(x.role || "").toLowerCase() === "family").length);
      setCaregiverCount(rows.filter((x) => String(x.role || "").toLowerCase() === "caregiver").length);
      setUserCount(rows.filter((x) => String(x.role || "").toLowerCase() === "user").length);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được dữ liệu dashboard admin.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const displayName = useMemo(() => me?.fullName || me?.username || "Admin", [me?.fullName, me?.username]);
  const avatarLetter = useMemo(() => String(displayName).trim().charAt(0).toUpperCase() || "A", [displayName]);
  const totalAccounts = Math.max(0, usersCount);

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
          <View style={styles.sectionHead}>
            <View>
              <Text style={styles.sectionTitle}>Tổng quan tài khoản</Text>
              <Text style={styles.sectionMeta}>Số liệu hệ thống hiện tại</Text>
            </View>
            <View style={styles.totalInlinePill}>
              <Text style={styles.totalInlineValue}>{totalAccounts}</Text>
              <Text style={styles.totalInlineLabel}>Tổng tài khoản</Text>
            </View>
            {loading ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.loadingTxt}>Đang tải…</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.statGrid}>
            <StatCard tone="user" label="USER" value={userCount} />
            <StatCard tone="family" label="HOST" value={familyCount} />
            <StatCard tone="care" label="CAREGIVER" value={caregiverCount} />
          </View>
        </View>

        <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Thao tác nhanh</Text>
        <Text style={styles.sectionHint}>Các chức năng quản trị chính của hệ thống</Text>

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
            <Ionicons name="alert-circle-outline" size={22} color={COLORS.careAccent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.actionTitle}>Cảnh báo hệ thống</Text>
            <Text style={styles.actionSub}>Theo dõi các cảnh báo và sự kiện bất thường</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.sub} />
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  tone,
  label,
  value,
}: {
  tone: StatTone;
  label: string;
  value: number;
}) {
  const t = STAT_TONES[tone];
  return (
    <View style={[styles.statCard, { borderColor: t.border, backgroundColor: COLORS.card }]}>
      <View
        style={[
          styles.statIconWrap,
          { backgroundColor: t.soft, borderColor: t.border },
        ]}
      >
        <Ionicons name={t.icon} size={18} color={t.accent} />
      </View>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
      <Text style={[styles.statValue, { color: t.accent }]}>{value}</Text>
    </View>
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
  overviewCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },

  sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  sectionTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  sectionMeta: { marginTop: 2, fontSize: 12, color: COLORS.sub, fontWeight: "700" },
  totalInlinePill: {
    marginLeft: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 102,
  },
  totalInlineValue: { color: COLORS.primary, fontSize: 16, fontWeight: "900", lineHeight: 18 },
  totalInlineLabel: { marginTop: 1, color: COLORS.primary, fontSize: 10, fontWeight: "800" },
  sectionSpaced: { marginTop: 8 },
  sectionHint: { marginTop: -4, fontSize: 12, fontWeight: "700", color: COLORS.sub, lineHeight: 17 },
  loadingInline: { flexDirection: "row", alignItems: "center", gap: 6 },
  loadingTxt: { fontSize: 12, fontWeight: "700", color: COLORS.sub },

  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  statCard: {
    width: "31.8%",
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  statLabel: { fontSize: 11, fontWeight: "800", color: COLORS.sub, lineHeight: 15 },
  statValue: { fontSize: 26, fontWeight: "900" },

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
