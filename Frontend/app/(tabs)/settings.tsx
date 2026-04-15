import React, { useEffect, useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getCurrentUser, getSupportUnreadCount, logoutUser } from "@/services/api";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

type SettingsRowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
};

function SettingsRow({ icon, iconColor, iconBg, title, subtitle, danger, onPress }: SettingsRowProps) {
  return (
    <TouchableOpacity style={[styles.rowCard, danger && styles.rowCardDanger]} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.rowInner}>
        <View style={[styles.rowIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
        <Ionicons name="chevron-forward" size={18} color={danger ? "#991B1B" : "#6B7280"} />
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = getCurrentUser() as { role?: string; fullName?: string; username?: string } | null;
  const [supportUnread, setSupportUnread] = useState(0);

  const onLogout = () => {
    const run = () => {
      logoutUser();
      router.replace("/(homepages)/getstared");
    };
    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm("Bạn có chắc muốn đăng xuất?") : true;
      if (ok) run();
      return;
    }
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Hủy", style: "cancel" },
      { text: "Đăng xuất", style: "destructive", onPress: run },
    ]);
  };

  const name = user?.fullName || user?.username || "Tài khoản";
  const roleLabel = useMemo(() => String(user?.role || "user").toUpperCase(), [user?.role]);
  const avatarLetter = useMemo(() => String(name).trim().charAt(0).toUpperCase() || "A", [name]);

  useEffect(() => {
    let cancelled = false;
    const loadUnread = async () => {
      try {
        const count = await getSupportUnreadCount();
        if (!cancelled) setSupportUnread(Number(count || 0));
      } catch {
        if (!cancelled) setSupportUnread(0);
      }
    };
    void loadUnread();
    const timer = setInterval(() => void loadUnread(), 5000);

    const socket = connectRoomChatSocket();
    const onSupportMessage = (payload: any) => {
      const senderId = Number(payload?.message?.sender_user_id || 0);
      const myId = Number((getCurrentUser() as any)?.id || 0);
      if (senderId > 0 && myId > 0 && senderId === myId) return;
      void loadUnread();
    };
    socket?.on("support:message:new", onSupportMessage);
    return () => {
      cancelled = true;
      clearInterval(timer);
      getRoomChatSocket()?.off("support:message:new", onSupportMessage);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: Math.max(12, insets.top > 0 ? 8 : 18),
            paddingBottom: Math.max(34, insets.bottom + 18),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Cài đặt</Text>

        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.profileTop} activeOpacity={0.9} onPress={() => router.push("/(profiles)/profile")}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{avatarLetter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName} numberOfLines={1}>
                {name}
              </Text>
              <View style={styles.rolePill}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#2E1065" />
                <Text style={styles.rolePillTxt}>{roleLabel}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#6B7280" />
          </TouchableOpacity>

          <Text style={styles.profileHint}>Quản lý hồ sơ, room, quyền truy cập và phiên đăng nhập.</Text>
        </View>

        <Text style={styles.sectionTitle}>Room</Text>
        <SettingsRow
          icon="key-outline"
          iconColor="#1D4ED8"
          iconBg="rgba(59,130,246,0.12)"
          title="Quản lý room"
          subtitle="Tham gia phòng, chia sẻ mã, phân quyền thành viên"
          onPress={() => router.push("/(screens)/room-access")}
        />
        <SettingsRow
          icon="chatbubble-ellipses-outline"
          iconColor="#4F46E5"
          iconBg="rgba(79,70,229,0.12)"
          title={supportUnread > 0 ? `Hỗ trợ trực tiếp (${supportUnread})` : "Hỗ trợ trực tiếp"}
          subtitle="Trao đổi nhanh với admin để xử lý thắc mắc"
          onPress={() => router.push("/(screens)/support-chat")}
        />

        <Text style={styles.sectionTitle}>Phiên đăng nhập</Text>
        <SettingsRow
          icon="log-out-outline"
          iconColor="#991B1B"
          iconBg="rgba(239,68,68,0.12)"
          title="Đăng xuất"
          subtitle="Thoát tài khoản khỏi ứng dụng"
          danger
          onPress={onLogout}
        />

        <Text style={styles.footer}>EBMS • Elderly Behavior Monitoring & Care Support</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18 },

  title: { fontSize: 18, fontWeight: "900", color: "#111827", marginBottom: 12 },

  profileCard: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    padding: 14,
    shadowColor: "#0B1220",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
    marginBottom: 14,
  },
  profileTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: 16, fontWeight: "900" },
  profileName: { fontSize: 15, fontWeight: "900", color: "#111827" },
  rolePill: {
    marginTop: 6,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(237,233,254,0.9)",
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.18)",
  },
  rolePillTxt: { fontSize: 11, fontWeight: "900", color: "#2E1065" },
  profileHint: { marginTop: 10, fontSize: 12, fontWeight: "600", color: "#6B7280", lineHeight: 18 },

  sectionTitle: { marginTop: 10, marginBottom: 8, fontSize: 12, fontWeight: "900", color: "#6B7280" },
  sectionHint: { marginTop: -2, marginBottom: 10, fontSize: 12, fontWeight: "700", color: "#94A3B8" },

  rowCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    padding: 14,
    shadowColor: "#0B1220",
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 1,
    marginBottom: 10,
  },
  rowCardDanger: { borderColor: "rgba(239,68,68,0.25)" },
  rowInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  rowTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  rowTitleDanger: { color: "#991B1B" },
  rowSub: { marginTop: 2, fontSize: 12, fontWeight: "600", color: "#6B7280" },

  footer: { marginTop: 6, fontSize: 12, color: "#94A3B8", fontWeight: "700", textAlign: "center" },
});

