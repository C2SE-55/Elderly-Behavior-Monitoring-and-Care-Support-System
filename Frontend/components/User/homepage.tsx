import React, { useEffect, useMemo, useState } from "react";
import { Alert, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FloatingAssistant from "@/components/assistant/FloatingAssistant";
import type { AxiosError } from "axios";
import { getCurrentUser, logoutUser, refreshCurrentUserProfile } from "../../services/api";

type Tile = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống thuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối người thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin cá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát hành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh hoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức khỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerLeft} activeOpacity={0.85} onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}>
            <Text style={styles.hi}>Xin chào</Text>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatar} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}>
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Vào phòng chăm sóc</Text>
          <Text style={styles.heroDesc}>Quét mã bằng camera hoặc quản lý phòng/quyền thành viên.</Text>
          <View style={styles.heroRow}>
            <TouchableOpacity style={styles.primaryBtn} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}>
              <Ionicons name="qr-code-outline" size={18} color="#FFF" />
              <Text style={styles.primaryTxt}>Quét mã</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}>
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.secondaryTxt}>Room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.section}>Chức năng</Text>
        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tile} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push(t.route))}>
              <View style={[styles.tileIcon, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={22} color={t.color} />
              </View>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {t.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 28 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { padding: 18, paddingBottom: 36, gap: 14 },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flex: 1, paddingVertical: 6 },
  hi: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  name: { fontSize: 18, fontWeight: "900", color: "#111827", marginTop: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#FFF", fontSize: 16, fontWeight: "900" },

  hero: { backgroundColor: "#EDE9FE", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#DDD6FE" },
  heroTitle: { fontSize: 14, fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: 12, fontWeight: "600", color: "#4B5563", marginTop: 6, lineHeight: 18 },
  heroRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  primaryBtn: { flex: 1, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#56328C", borderRadius: 14, paddingVertical: 12 },
  primaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },
  secondaryBtn: { width: 110, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: "rgba(59,130,246,0.25)" },
  secondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  section: { fontSize: 14, fontWeight: "900", color: "#111827" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  tile: { width: "48%", backgroundColor: "#FFF", borderRadius: 16, borderWidth: 1, borderColor: "#EEF2FF", padding: 12, minHeight: 88 },
  tileIcon: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
});

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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

const { width } = Dimensions.get("window");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type Tile = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.greetWrap}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>
              Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.
            </Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}
            >
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tile}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push(t.route))}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});
  Alert,
  Dimensions,
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

const { width } = Dimensions.get("window");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type Tile = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.greetWrap} activeOpacity={0.85} onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}>
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.</Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.heroPrimaryBtn} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}>
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.heroSecondaryBtn} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}>
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tile} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push(t.route))}>
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: { marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
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

const { width } = Dimensions.get("window");
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type Tile = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.greetWrap}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.</Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}
            >
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tile} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push(t.route))}>
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14, gap: 12 },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#111827", alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: { width: 46, height: 46, borderRadius: 16, borderWidth: 1, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: { marginTop: 10, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.greetWrap}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>
              Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.
            </Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}
            >
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tile}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push(t.route))}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.greetWrap}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>
              Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.
            </Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}
            >
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity
              key={t.id}
              style={styles.tile}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push(t.route))}
            >
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type Tile = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  route: string;
};

const TILES: Tile[] = [
  { id: "medicine-reminder", title: "Nhắc uống\nthuốc", icon: "medkit-outline", color: "#10B981", route: "/(screens)/medicine-reminder" },
  { id: "family", title: "Kết nối\nngười thân", icon: "people-outline", color: "#3B82F6", route: "/(screens)/family-chat" },
  { id: "personal-info", title: "Thông tin\ncá nhân", icon: "person-circle-outline", color: "#8B5CF6", route: "/(profiles)/profile" },
  { id: "behavior", title: "Giám sát\nhành vi", icon: "videocam-outline", color: "#F59E0B", route: "/(cameras)/camera" },
  { id: "schedule", title: "Lịch sinh\nhoạt", icon: "calendar-outline", color: "#EF4444", route: "/(screens)/weekly-schedule" },
  { id: "health", title: "Sức\nkhỏe", icon: "heart-outline", color: "#EC4899", route: "/(healths)/health" },
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
        const status = Number(ax?.response?.status || 0);
        if (status === 401) {
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

  const displayName = useMemo(() => user?.fullName || user?.username || "Bạn", [user]);
  const avatarLetter = useMemo(() => String(displayName || "A").charAt(0).toUpperCase(), [displayName]);

  const ensureAuthed = (action: () => void) => {
    if (!user) {
      Alert.alert("Cần đăng nhập", "Bạn cần đăng nhập để có thể sử dụng chức năng này.", [
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
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.greetWrap}
            activeOpacity={0.85}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
          >
            <Text style={styles.greetWave}>👋</Text>
            <View style={{ flexShrink: 1 }}>
              <Text style={styles.greetTitle} numberOfLines={1}>
                Xin chào {displayName}
              </Text>
              <Text style={styles.greetSub} numberOfLines={1}>
                Chúc bạn một ngày thật an lành
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatar}
            activeOpacity={0.9}
            onPress={() => ensureAuthed(() => router.push("/(profiles)/profile"))}
            accessibilityRole="button"
            accessibilityLabel="Mở thông tin cá nhân"
          >
            <Text style={styles.avatarTxt}>{avatarLetter}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroBadge}>
              <Ionicons name="sparkles-outline" size={14} color="#4C1D95" />
              <Text style={styles.heroBadgeTxt}>EBMS Dashboard</Text>
            </View>
            <Text style={styles.heroTitle}>Hôm nay của bạn</Text>
            <Text style={styles.heroDesc}>
              Quét mã để vào phòng chăm sóc, hoặc quản lý phòng/quyền thành viên nhanh chóng.
            </Text>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity
              style={styles.heroPrimaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-qr-scan"))}
            >
              <Ionicons name="qr-code-outline" size={18} color="#FFFFFF" />
              <Text style={styles.heroPrimaryTxt}>Quét mã vào phòng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.heroSecondaryBtn}
              activeOpacity={0.9}
              onPress={() => ensureAuthed(() => router.push("/(screens)/room-access"))}
            >
              <Ionicons name="key-outline" size={18} color="#1D4ED8" />
              <Text style={styles.heroSecondaryTxt}>Quản lý room</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Chức năng</Text>
          <Text style={styles.sectionMeta}>6 tiện ích nhanh</Text>
        </View>

        <View style={styles.grid}>
          {TILES.map((t) => (
            <TouchableOpacity key={t.id} style={styles.tile} activeOpacity={0.9} onPress={() => ensureAuthed(() => router.push(t.route))}>
              <View style={[styles.tileIconWrap, { backgroundColor: `${t.color}14`, borderColor: `${t.color}2E` }]}>
                <Ionicons name={t.icon} size={26} color={t.color} />
              </View>
              <Text style={styles.tileTitle}>{t.title}</Text>
              <View style={[styles.tilePill, { backgroundColor: `${t.color}12` }]}>
                <Text style={[styles.tilePillTxt, { color: t.color }]}>Mở</Text>
                <Ionicons name="chevron-forward" size={14} color={t.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 18 }} />
        <FloatingAssistant />
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F6FF" },
  container: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 40 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  greetWrap: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingVertical: 8 },
  greetWave: { fontSize: scaleFont(20) },
  greetTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#1F1B2E" },
  greetSub: { marginTop: 2, fontSize: scaleFont(12), color: "#6B7280", fontWeight: "600" },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: "#FFF", fontSize: scaleFont(16), fontWeight: "800" },

  hero: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: "#EDE9FE",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    shadowColor: "#4C1D95",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 2,
    marginBottom: 16,
  },
  heroTop: { gap: 8 },
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
  heroTitle: { fontSize: scaleFont(18), fontWeight: "900", color: "#2E1065" },
  heroDesc: { fontSize: scaleFont(12), color: "#4B5563", fontWeight: "600", lineHeight: 18 },

  heroActions: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  heroPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#56328C",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 160,
    shadowColor: "#56328C",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  heroPrimaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13 },

  heroSecondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.8)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.25)",
  },
  heroSecondaryTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 13 },

  sectionHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  sectionMeta: { fontSize: 12, color: "#6B7280", fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  tile: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    minHeight: 126,
    borderWidth: 1,
    borderColor: "#EEF2FF",
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 2,
  },
  tileIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  tileTitle: { fontSize: 14, fontWeight: "900", color: "#111827", lineHeight: 18 },
  tilePill: {
    marginTop: 10,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tilePillTxt: { fontSize: 12, fontWeight: "900" },
});
import {
    Alert,
    SafeAreaView,
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import FloatingAssistant from "@/components/assistant/FloatingAssistant";
import type { AxiosError } from "axios";
import { getCurrentUser, logoutUser, refreshCurrentUserProfile } from "../../services/api";
import { getNotificationLogs, subscribeNotificationLogChange } from "@/services/notificationLog";

const { width } = Dimensions.get("window");

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const scale = clamp(width / 375, 0.95, 1.2);
const scaleFont = (size: number) => Math.round(size * scale);

type HomeOption = {
    id: string;
    title: string;
    emoji: string;
};

const OPTIONS: HomeOption[] = [
    { id: "medicine-reminder", title: "Nhắc nhở uống\nthuốc", emoji: "💊" },
    { id: "family", title: "Kết nối với\nngười thân", emoji: "🧑‍🤝‍🧑" },
    { id: "personal-info", title: "Thông tin cá\nnhân", emoji: "🫃" },
    { id: "behavior", title: "Giám sát và phát\nhiện hành vi", emoji: "📷" },
    { id: "schedule", title: "Quản lý lịch sinh\nhoạt", emoji: "📅" },
    { id: "health", title: "Quản lý thông\ntin sức khỏe", emoji: "💼" },
];

const HomepageUserScreen = () => {
    const router = useRouter();
    const [user, setUser] = useState(() => getCurrentUser());
    const [roomMessageUnread, setRoomMessageUnread] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                // If session expired, backend will 401 here.
                await refreshCurrentUserProfile();
                if (!cancelled) setUser(getCurrentUser());
            } catch (e) {
                const ax = e as AxiosError<any>;
                const status = Number(ax?.response?.status || 0);
                if (status === 401) {
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

    useEffect(() => {
        let mounted = true;
        const refreshRoomMessageUnread = async () => {
            try {
                const logs = await getNotificationLogs();
                if (!mounted) return;
                const count = logs.reduce((acc, it) => {
                    if (it.type !== "room-message" || it.read) return acc;
                    return acc + 1;
                }, 0);
                setRoomMessageUnread(count);
            } catch {
                if (mounted) setRoomMessageUnread(0);
            }
        };
        void refreshRoomMessageUnread();
        const unsub = subscribeNotificationLogChange(() => {
            void refreshRoomMessageUnread();
        });
        const t = setInterval(() => void refreshRoomMessageUnread(), 5000);
        return () => {
            mounted = false;
            unsub();
            clearInterval(t);
        };
    }, []);

    const displayName =
        user?.fullName || user?.username || "A";
    const avatarLetter = (displayName || "A").charAt(0).toUpperCase();

    const handleLogout = () => {
        logoutUser();
        setUser(null);
        router.replace("/(homepages)/homepage_user");
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                {user ? (
                    <>
                        <View style={styles.headerTextWrapper}>
                            <Text style={styles.wave}>👋</Text>
                            <Text style={styles.greeting}>Xin chào {displayName}</Text>
                        </View>

                        <View style={styles.headerActions}>
                            <View style={styles.avatar}>
                                <Text style={styles.avatarText}>{avatarLetter}</Text>
                            </View>
                            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                                <Text style={styles.logoutText}>Đăng xuất</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                ) : (
                    <View style={styles.headerLoggedOut}>
                        <View style={{ flex: 1 }} />
                        <TouchableOpacity
                            style={styles.loginBtn}
                            onPress={() => router.replace("/(auths)/login")}
                            accessibilityRole="button"
                            accessibilityLabel="Đăng nhập"
                        >
                            <Text style={styles.loginText}>Đăng nhập</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {user ? (
                <TouchableOpacity
                    style={styles.scanRoomBtn}
                    onPress={() => router.push("/(screens)/room-qr-scan")}
                    activeOpacity={0.88}
                    accessibilityRole="button"
                    accessibilityLabel="Quét mã vào phòng"
                >
                    <Ionicons name="qr-code-outline" size={22} color="#1D4ED8" />
                    <Text style={styles.scanRoomBtnText}>Quét mã vào phòng</Text>
                </TouchableOpacity>
            ) : null}

            {/* List */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            >
                {OPTIONS.map((item) => {
                    const isComingSoon = false;
                    const handlePress = () => {
                        if (!user) {
                            Alert.alert(
                                "Cần đăng nhập",
                                "Bạn cần đăng nhập để có thể sử dụng chức năng này.",
                                [
                                    { text: "Đóng", style: "cancel" },
                                    { text: "Đăng nhập", onPress: () => router.replace("/(auths)/login") },
                                ]
                            );
                            return;
                        }
                        if (item.id === "medicine-reminder") {
                            router.push("/(screens)/medicine-reminder");
                        } else if (item.id === "personal-info") {
                            router.push("/(profiles)/profile");
                        } else if (item.id === "health") {
                            router.push("/(healths)/health");
                        } else if (item.id === "behavior") {
                            router.push("/(cameras)/camera");
                        } else if (item.id === "schedule") {
                            router.push("/(screens)/weekly-schedule");
                        } else if (item.id === "family") {
                            router.push("/(screens)/family-chat");
                        }
                    };

                    return (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.card,
                                isComingSoon && styles.cardDisabled,
                            ]}
                            activeOpacity={0.85}
                            onPress={handlePress}
                        >
                            {item.id === "family" && roomMessageUnread > 0 ? (
                                <View style={styles.chatUnreadBadge}>
                                    <Text style={styles.chatUnreadBadgeText}>
                                        {roomMessageUnread > 99 ? "99+" : roomMessageUnread}
                                    </Text>
                                </View>
                            ) : null}
                            <View style={styles.cardTextWrapper}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                {isComingSoon && <Text style={styles.comingSoonText}>Sắp ra mắt</Text>}
                            </View>

                            <Text style={styles.cardEmoji}>{item.emoji}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
            <FloatingAssistant />
        </SafeAreaView>
    );
};

export default HomepageUserScreen;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F7F7FB",
        paddingHorizontal: 24,
        paddingTop: 60,
    },

    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 6, 
        marginBottom: 24,
    },

    headerTextWrapper: {
        flexDirection: "row",
        alignItems: "center",
        marginLeft: 12,
    },

    wave: {
        fontSize: scaleFont(24),
        marginRight: 8,
    },

    greeting: {
        fontSize: scaleFont(22),
        fontWeight: "800",
        color: "#4B2E83",
        letterSpacing: 0.5,
    },

    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: "#111827",
        alignItems: "center",
        justifyContent: "center",
    },

    avatarText: {
        color: "#FFF",
        fontSize: scaleFont(16),
        fontWeight: "700",
    },
    headerActions: {
        alignItems: "center",
        gap: 6,
    },
    headerLoggedOut: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        flex: 1,
        paddingHorizontal: 6,
    },
    loginBtn: {
        backgroundColor: "#EDE9FE",
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#C4B5FD",
    },
    loginText: {
        color: "#56328C",
        fontSize: scaleFont(12),
        fontWeight: "800",
    },
    scanRoomBtn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        alignSelf: "center",
        width: "86%",
        maxWidth: 320,
        paddingVertical: 14,
        paddingHorizontal: 18,
        marginBottom: 18,
        borderRadius: 14,
        backgroundColor: "#EEF2FF",
        borderWidth: 1.5,
        borderColor: "#C7D2FE",
    },
    scanRoomBtnText: {
        color: "#1D4ED8",
        fontSize: scaleFont(16),
        fontWeight: "800",
    },
    logoutBtn: {
        backgroundColor: "#FEE2E2",
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
    },
    logoutText: {
        color: "#991B1B",
        fontSize: scaleFont(12),
        fontWeight: "700",
    },

    listContent: {
        paddingBottom: 100,
        gap: 16,
        alignItems: "center",
    },

    card: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",

        width: "80%",
        maxWidth: 300,

        paddingVertical: 20,
        paddingHorizontal: 18,

        borderRadius: 16,

        backgroundColor: "#DDE3F0",

        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },

        elevation: 3,
    },
    cardDisabled: {
        opacity: 0.6,
    },
    chatUnreadBadge: {
        position: "absolute",
        top: 8,
        right: 8,
        minWidth: 24,
        height: 24,
        borderRadius: 999,
        backgroundColor: "#EF4444",
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 6,
        zIndex: 3,
    },
    chatUnreadBadgeText: {
        color: "#FFFFFF",
        fontSize: scaleFont(11),
        fontWeight: "900",
    },

    cardTextWrapper: {
        flex: 1,
        marginRight: 14,
    },

    cardTitle: {
        fontSize: scaleFont(18),
        fontWeight: "700",
        lineHeight: scaleFont(24),
        color: "#111827",
    },
    comingSoonText: {
        marginTop: 6,
        alignSelf: "flex-start",
        backgroundColor: "#FFFFFF",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 5,
        color: "#6B7280",
        fontSize: scaleFont(11),
        fontWeight: "800",
    },

    cardEmoji: {
        fontSize: scaleFont(36),
    },
});
*/