import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getCurrentUser, getSupportConversationsForAdmin, logoutUser } from "@/services/api";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.34)",
  blueSoft: "rgba(37,99,235,0.10)",
  blueBorder: "rgba(37,99,235,0.24)",
  dangerBg: "#FEE2E2",
  dangerBorder: "rgba(239,68,68,0.35)",
  dangerText: "#991B1B",
};

export default function AdminSettingsScreen() {
  const router = useRouter();
  const me = getCurrentUser() as { username?: string; fullName?: string; role?: string } | null;
  const [supportUnread, setSupportUnread] = useState(0);
  const displayName = me?.fullName || me?.username || "Admin";
  const role = (me?.role || "admin").toUpperCase();
  const avatarLetter = String(displayName).trim().charAt(0).toUpperCase() || "A";

  useEffect(() => {
    let cancelled = false;
    const loadUnread = async () => {
      try {
        const rows = await getSupportConversationsForAdmin();
        const total = (rows || []).reduce((acc, it) => acc + Number(it.unread_count || 0), 0);
        if (!cancelled) setSupportUnread(total);
      } catch {
        if (!cancelled) setSupportUnread(0);
      }
    };
    void loadUnread();
    const timer = setInterval(() => void loadUnread(), 5000);
    const socket = connectRoomChatSocket();
    const onSupportMessage = () => void loadUnread();
    socket?.on("support:message:new", onSupportMessage);
    return () => {
      cancelled = true;
      clearInterval(timer);
      getRoomChatSocket()?.off("support:message:new", onSupportMessage);
    };
  }, []);

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

        <TouchableOpacity
          style={styles.menuRow}
          onPress={() => router.push("/(screens)/admin-support-chat")}
          activeOpacity={0.9}
        >
          <View style={[styles.rowIconWrap, { backgroundColor: COLORS.blueSoft, borderColor: COLORS.blueBorder }]}>
            <Feather name="message-square" size={18} color="#1D4ED8" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.menuText}>
              Hỗ trợ trực tiếp {supportUnread > 0 ? `(${supportUnread})` : ""}
            </Text>
            <Text style={styles.menuMeta}>Trao đổi real-time với user để giải đáp nhanh</Text>
          </View>
          <Feather name="chevron-right" size={18} color={COLORS.text} />
        </TouchableOpacity>

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
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  menuText: { fontSize: 14, color: COLORS.text, fontWeight: "900" },
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
