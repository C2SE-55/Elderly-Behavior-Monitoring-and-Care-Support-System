import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getAdminUsers, getCurrentUser, logoutUser } from "@/services/api";

export default function AdminHomepage() {
  const router = useRouter();
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

  const handleLogout = () => {
    logoutUser();
    router.replace("/(auths)/login");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Admin Console</Text>
            <Text style={styles.subtitle}>Xin chào, {displayName}</Text>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutTxt}>Đăng xuất</Text>
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingTxt}>Đang tải thống kê...</Text>
          </View>
        )}

        <View style={styles.grid}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Tổng tài khoản</Text>
            <Text style={styles.statValue}>{usersCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>USER</Text>
            <Text style={styles.statValue}>{userCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>FAMILY (HOST)</Text>
            <Text style={styles.statValue}>{familyCount}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>CAREGIVER</Text>
            <Text style={styles.statValue}>{caregiverCount}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tính năng chính</Text>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push("/(admin)/accounts")}>
            <Feather name="users" size={18} color="#2563EB" />
            <Text style={styles.actionTxt}>CRUD tài khoản người dùng</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push("/(admin)/add-account")}>
            <Feather name="user-plus" size={18} color="#2563EB" />
            <Text style={styles.actionTxt}>Tạo tài khoản mới</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionRow} onPress={() => router.push("/(admin)/room-management")}>
            <Feather name="home" size={18} color="#2563EB" />
            <Text style={styles.actionTxt}>Tạo room, sinh room_id và QR payload</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  wrap: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#0F172A" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  logoutBtn: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  logoutTxt: {
    color: "#991B1B",
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  loading: { flexDirection: "row", alignItems: "center", gap: 8 },
  loadingTxt: { color: "#6B7280", fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCard: {
    width: "48%",
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  statLabel: { color: "#6B7280", fontSize: 12, fontWeight: "600" },
  statValue: { color: "#0F172A", fontSize: 24, fontWeight: "700", marginTop: 6 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  cardTitle: { color: "#111827", fontSize: 15, fontWeight: "700" },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
  },
  actionTxt: { color: "#0F172A", fontSize: 13, fontWeight: "600" },
});
