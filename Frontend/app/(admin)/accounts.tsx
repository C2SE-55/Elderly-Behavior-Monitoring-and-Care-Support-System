import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AdminUserAccount, getAdminUsers } from "@/services/api";
import { AnimatedPressable, ScreenEnter } from "@/components/ui/AnimatedPressable";

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
};

export default function AdminAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AdminUserAccount[]>([]);

  const loadRows = useCallback(async (keyword?: string) => {
    try {
      setLoading(true);
      setError("");
      const data = await getAdminUsers(keyword);
      setRows(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được danh sách tài khoản.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadRows(search.trim());
    }, 300);
    return () => clearTimeout(t);
  }, [search, loadRows]);
  const totalRows = rows.length;
  const hostRows = useMemo(
    () => rows.filter((x) => String(x.role || "user").toLowerCase() === "family").length,
    [rows]
  );

  // Tab bar in this app is ~75px tall. Keep FAB above it.
  const fabBottom = insets.bottom + 75 + 14;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenEnter>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.replace("/(admin)")} style={styles.backBtn} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Quản lý tài khoản</Text>
          <Text style={styles.headerSub}>Danh sách và quản trị tài khoản hệ thống</Text>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{totalRows}</Text>
          <Text style={styles.summaryLabel}>Tổng tài khoản</Text>
        </View>
        <View style={styles.summaryPill}>
          <Text style={styles.summaryValue}>{hostRows}</Text>
          <Text style={styles.summaryLabel}>HOST</Text>
        </View>
      </View>

      <View style={styles.searchCard}>
        <View style={styles.searchInputWrap}>
          <Feather name="search" size={16} color={COLORS.sub} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm theo tên hoặc username..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadRows(search.trim())}
          />
        </View>
        <View style={styles.searchActions}>
          <TouchableOpacity
            style={styles.resetBtn}
            onPress={() => {
              setSearch("");
              loadRows();
            }}
            activeOpacity={0.9}
          >
            <Text style={styles.resetBtnText}>Làm mới</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!error && <Text style={styles.error}>{error}</Text>}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingTxt}>Đang tải...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {rows.map((acc) => (
            <AnimatedPressable
              key={acc.id}
              style={styles.card}
              onPress={() => router.push({ pathname: "/(admin)/account-detail", params: { id: String(acc.id) } })}
              accessibilityRole="button"
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(acc.fullName || acc.username || "U").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{acc.fullName || acc.username}</Text>
                <Text style={styles.meta}>@{acc.username} · {acc.email}</Text>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillTxt}>{(acc.role || "user").toUpperCase()}</Text>
                </View>
              </View>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </AnimatedPressable>
          ))}
          {!rows.length && <Text style={styles.empty}>Không có tài khoản nào.</Text>}
          <View style={{ height: fabBottom + 40 }} />
        </ScrollView>
      )}

      <AnimatedPressable
        style={[styles.fab, { bottom: fabBottom }]}
        onPress={() => router.push("/(admin)/add-account")}
        accessibilityRole="button"
      >
        <Feather name="plus" size={24} color="#FFF" />
      </AnimatedPressable>
      </ScreenEnter>
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
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 2,
  },
  summaryPill: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  summaryValue: { fontSize: 18, fontWeight: "900", color: COLORS.primary, lineHeight: 20 },
  summaryLabel: { marginTop: 2, fontSize: 11, fontWeight: "800", color: COLORS.sub },
  searchCard: {
    marginHorizontal: 18,
    marginTop: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 10,
    gap: 10,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.30)",
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "#FFFFFF",
  },
  searchInput: {
    flex: 1,
    paddingVertical: 9,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  searchActions: { flexDirection: "row", justifyContent: "flex-end" },
  resetBtn: {
    width: 112,
    backgroundColor: COLORS.blueSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
  },
  resetBtnText: { color: "#1D4ED8", fontWeight: "900", fontSize: 12 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 24, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 17, fontWeight: "900", color: COLORS.primary },
  name: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.sub, marginTop: 1, fontWeight: "600" },
  rolePill: {
    marginTop: 6,
    alignSelf: "flex-start",
    backgroundColor: "rgba(86,50,140,0.10)",
    borderColor: "rgba(86,50,140,0.28)",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  rolePillTxt: { fontSize: 10, fontWeight: "900", color: COLORS.primary },
  empty: { color: "#6B7280", textAlign: "center", marginTop: 20, fontSize: 13 },
  loading: { alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 30 },
  loadingTxt: { color: "#6B7280", fontSize: 12 },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    marginHorizontal: 18,
    marginTop: 10,
  },
  fab: {
    position: "absolute",
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
});
