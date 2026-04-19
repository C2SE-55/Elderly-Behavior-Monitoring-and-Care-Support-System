import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getCurrentUser, logoutUser } from "@/services/api";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.34)",
  dangerBg: "#FEE2E2",
  dangerBorder: "rgba(239,68,68,0.35)",
  dangerText: "#991B1B",
};

export default function AdminSettingsScreen() {
  const router = useRouter();
  const me = getCurrentUser() as { username?: string; fullName?: string; role?: string } | null;
  const displayName = me?.fullName || me?.username || "Admin";
  const role = (me?.role || "admin").toUpperCase();
  const avatarLetter = String(displayName).trim().charAt(0).toUpperCase() || "A";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn} activeOpacity={0.9}>
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Cài đặt</Text>
          <Text style={styles.headerSub}>Tuỳ chỉnh phiên quản trị hệ thống</Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              <View style={styles.rolePill}>
                <Feather name="shield" size={13} color="#2E1065" />
                <Text style={styles.rolePillTxt}>{role}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.rbacCard}>
          <Text style={styles.rbacTitle}>Trạng thái phân quyền (RBAC)</Text>
          <Text style={styles.rbacLine}>• CRUD user</Text>
          <Text style={styles.rbacLine}>• Tạo room / room_id / QR payload</Text>
          <Text style={styles.rbacLine}>• Mỗi room có đúng 1 HOST duy nhất</Text>
          <Text style={styles.rbacLine}>• Family toàn quyền quản lý trong room</Text>
          <Text style={styles.rbacLine}>• Caregiver chỉ đọc, quyền mở rộng bằng toggle</Text>
          <TouchableOpacity
            style={styles.roomMgmtBtn}
            onPress={() => router.push("/(admin)/room-management")}
            activeOpacity={0.9}
          >
            <Text style={styles.roomMgmtBtnTxt}>Đi tới quản lý room</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutRow}
          onPress={() => {
            logoutUser();
            router.replace("/(auths)/login");
          }}
          activeOpacity={0.9}
        >
          <View style={[styles.rowIconWrap, { backgroundColor: "#FECACA", borderColor: COLORS.dangerBorder }]}>
            <Feather name="log-out" size={18} color={COLORS.dangerText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logoutText}>Đăng xuất</Text>
            <Text style={styles.menuMeta}>Thoát khỏi tài khoản quản trị hiện tại</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.dangerText} />
        </TouchableOpacity>

        <View style={{ height: 88 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  headerSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: COLORS.sub },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 12, gap: 10 },
  profileCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: 18, fontWeight: "900" },
  profileName: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  rolePill: {
    marginTop: 5,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  rolePillTxt: { color: "#2E1065", fontSize: 10, fontWeight: "900" },
  rbacCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 14,
    gap: 6,
  },
  rbacTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text, marginBottom: 4 },
  rbacLine: { fontSize: 13, fontWeight: "600", color: COLORS.text, lineHeight: 20 },
  roomMgmtBtn: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  roomMgmtBtnTxt: { color: "#FFF", fontSize: 14, fontWeight: "900" },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  menuMeta: { fontSize: 12, color: COLORS.sub, marginTop: 2, fontWeight: "600" },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.dangerBg,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
  },
  logoutText: { fontSize: 14, color: COLORS.dangerText, fontWeight: "900" },
});
