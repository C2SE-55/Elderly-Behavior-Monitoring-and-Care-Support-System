import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FloatingAssistant from "@/components/assistant/FloatingAssistant";
import type { AxiosError } from "axios";
import { getCurrentUser, logoutUser, refreshCurrentUserProfile } from "../../services/api";

type Tile = {
  id: string;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const COLORS = {
  ink: "#0B1220",
  title: "#0F172A",
  sub: "#6B7280",
  border: "rgba(148,163,184,0.24)",
  card: "rgba(255,255,255,0.92)",
  purple: "#56328C",
  purpleDark: "#2E1065",
};

const TILES: Tile[] = [
  {
    id: "medicine-reminder",
    title: "Nhắc uống thuốc",
    desc: "Thiết lập nhắc nhở",
    icon: "medkit-outline",
    color: "#10B981",
    route: "/(screens)/medicine-reminder",
  },
  {
    id: "schedule",
    title: "Lịch sinh hoạt",
    desc: "Theo dõi theo tuần",
    icon: "calendar-outline",
    color: "#EF4444",
    route: "/(screens)/weekly-schedule",
  },
  {
    id: "behavior",
    title: "Giám sát hành vi",
    desc: "Camera & cảnh báo",
    icon: "videocam-outline",
    color: "#F59E0B",
    route: "/(cameras)/camera",
  },
  {
    id: "health",
    title: "Sức khỏe",
    desc: "Chỉ số & theo dõi",
    icon: "heart-outline",
    color: "#EC4899",
    route: "/(healths)/health",
  },
  {
    id: "family",
    title: "Người thân",
    desc: "Trao đổi, hỗ trợ",
    icon: "people-outline",
    color: "#3B82F6",
    route: "/(screens)/family-chat",
  },
  {
    id: "personal-info",
    title: "Thông tin cá nhân",
    desc: "Hồ sơ của bạn",
    icon: "person-circle-outline",
    color: "#8B5CF6",
    route: "/(profiles)/profile",
  },
];

export default function HomepageUserScreen() {
  const router = useRouter();
  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        await refreshCurrentUserProfile();
        if (!cancelled) setUser(getCurrentUser());
      } catch (e) {
        const ax = e as AxiosError<any>;
        if (Number(ax?.response?.status || 0) === 401) {
          logoutUser();
          if (!cancelled) setUser(null);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const name = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(name).trim().charAt(0).toUpperCase() || "A", [name]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để sử dụng chức năng này.", [
        { text: "Đóng", style: "cancel" },
        { text: "Đăng nhập", onPress: () => router.replace("/(auths)/login") },
      ]);
      return;
    }
    action();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View pointerEvents="none" style={styles.bgBlobA} />
        <View pointerEvents="none" style={styles.bgBlobB} />
        <View pointerEvents="none" style={styles.bgBlobC} />
        <View pointerEvents="none" style={styles.bgGrid} />

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.hi}>Xin chào</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            <Text style={styles.sub} numberOfLines={1}>
              Dashboard chăm sóc • EBMS
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View pointerEvents="none" style={styles.heroGlow} />
          <View pointerEvents="none" style={styles.heroGlow2} />
          <View style={styles.heroRow}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#2E1065" />
              <Text style={styles.heroBadgeTxt}>EBMS • Chăm sóc thông minh</Text>
            </View>
          </View>

          <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
          <Text style={styles.heroDesc}>
            Chăm sóc tận tâm, theo dõi nhẹ nhàng mỗi ngày.
          </Text>
          <Text style={styles.heroDesc2}>
            Giữ kết nối với người thân, nhắc nhở đúng lúc và hỗ trợ kịp thời khi cần.
          </Text>

          <View style={styles.heroPills}>
            <View style={[styles.pill, { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.22)" }]}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#059669" />
              <Text style={[styles.pillTxt, { color: "#065F46" }]}>An toàn</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: "rgba(59,130,246,0.12)", borderColor: "rgba(59,130,246,0.22)" }]}>
              <Ionicons name="pulse-outline" size={16} color="#1D4ED8" />
              <Text style={[styles.pillTxt, { color: "#1E3A8A" }]}>Theo dõi</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: "rgba(167,139,250,0.14)", borderColor: "rgba(167,139,250,0.28)" }]}>
              <Ionicons name="time-outline" size={16} color="#56328C" />
              <Text style={[styles.pillTxt, { color: "#2E1065" }]}>Nhắc nhở</Text>
            </View>
          </View>
        </View>

        <View style={styles.welcomeCard}>
          <View style={styles.welcomeCardTop}>
            <View style={styles.welcomeCardIcon}>
              <Ionicons name="hand-left-outline" size={18} color="#2E1065" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeCardTitle}>Chào mừng bạn</Text>
              <Text style={styles.welcomeCardSub}>
                Hãy bắt đầu bằng việc vào phòng chăm sóc, sau đó sử dụng các tính năng theo nhu cầu của bạn.
              </Text>
            </View>
          </View>

          <View style={styles.welcomeCardCallout}>
            <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.welcomeCardCalloutTxt}>
              Mọi thứ đã sẵn sàng. Bạn có thể bắt đầu từ phần <Text style={{ fontWeight: "900" }}>Chức năng</Text> bên dưới.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tính năng chính</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tile} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push(t.route as any))}>
              <View style={[styles.tileIcon, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={22} color={t.color} />
              </View>
              <View pointerEvents="none" style={[styles.tileSheen, { backgroundColor: `${t.color}10` }]} />
              <Text style={styles.tileTitle} numberOfLines={2}>
                {t.title}
              </Text>
              <Text style={styles.tileDesc} numberOfLines={2}>
                {t.desc}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>
      <FloatingAssistant />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 40, gap: 14 },

  bgBlobA: {
    position: "absolute",
    top: -90,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 160,
    backgroundColor: "rgba(167,139,250,0.24)",
  },
  bgBlobB: {
    position: "absolute",
    top: 120,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 180,
    backgroundColor: "rgba(59,130,246,0.14)",
  },
  bgBlobC: {
    position: "absolute",
    bottom: 160,
    right: -120,
    width: 340,
    height: 340,
    borderRadius: 200,
    backgroundColor: "rgba(16,185,129,0.10)",
  },
  bgGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.08)",
    opacity: 1,
  },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flex: 1, paddingVertical: 6 },
  hi: { fontSize: 12, fontWeight: "800", color: COLORS.sub, letterSpacing: 0.2 },
  name: { fontSize: 22, fontWeight: "900", color: COLORS.title, marginTop: 2, letterSpacing: -0.2 },
  sub: { marginTop: 4, fontSize: 12, fontWeight: "700", color: COLORS.sub },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: 16, fontWeight: "900" },

  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: "#0B1220",
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 2,
    overflow: "hidden",
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 140,
    backgroundColor: "rgba(167,139,250,0.22)",
  },
  heroGlow2: {
    position: "absolute",
    bottom: -100,
    left: -110,
    width: 260,
    height: 260,
    borderRadius: 160,
    backgroundColor: "rgba(59,130,246,0.16)",
  },
  heroRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(237,233,254,0.9)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(124,58,237,0.18)",
  },
  heroBadgeTxt: { fontSize: 11, fontWeight: "900", color: COLORS.purpleDark },
  heroRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroRightTxt: { fontSize: 12, fontWeight: "900", color: COLORS.purple },
  heroTitle: { marginTop: 12, fontSize: 17, fontWeight: "900", color: COLORS.title, letterSpacing: -0.1 },
  heroDesc: { marginTop: 6, fontSize: 12, fontWeight: "700", color: COLORS.sub, lineHeight: 18 },
  heroDesc2: { marginTop: 4, fontSize: 12, fontWeight: "600", color: COLORS.sub, lineHeight: 18 },
  heroPills: { flexDirection: "row", gap: 8, marginTop: 14 },
  pill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pillTxt: { fontSize: 12, fontWeight: "900" },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginTop: 6 },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: COLORS.title },
  sectionMeta: { fontSize: 12, fontWeight: "800", color: COLORS.sub },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    minHeight: 118,
    shadowColor: "#0B1220",
    shadowOpacity: 0.05,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 14 },
    elevation: 1,
    overflow: "hidden",
  },
  tileIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileSheen: {
    position: "absolute",
    top: -18,
    right: -22,
    width: 90,
    height: 90,
    borderRadius: 55,
  },
  tileTitle: { fontSize: 13, fontWeight: "900", color: COLORS.title },
  tileDesc: { marginTop: 4, fontSize: 12, fontWeight: "700", color: COLORS.sub, lineHeight: 16 },

  welcomeCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    shadowColor: "#0B1220",
    shadowOpacity: 0.07,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 2,
  },
  welcomeCardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  welcomeCardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.16)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
  },
  welcomeCardTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  welcomeCardSub: { marginTop: 4, fontSize: 12, fontWeight: "600", color: "#6B7280", lineHeight: 18 },
  welcomeCardCallout: {
    marginTop: 14,
    backgroundColor: "#56328C",
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  welcomeCardCalloutTxt: { flex: 1, fontSize: 12, fontWeight: "700", color: "#FFFFFF", lineHeight: 18 },
});

