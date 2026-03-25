import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AdminUserAccount, getAdminUsers } from "@/services/api";

export default function AdminAccountsScreen() {
  const router = useRouter();
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

  const onSearch = () => loadRows(search);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>CRUD tài khoản người dùng</Text>
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Nhập tên để tìm kiếm..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearch}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
          <Text style={styles.searchBtnText}>Tìm</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.resetBtn} onPress={() => { setSearch(""); loadRows(); }}>
          <Text style={styles.resetBtnText}>Reset</Text>
        </TouchableOpacity>
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
            <TouchableOpacity
              key={acc.id}
              style={styles.card}
              onPress={() => router.push({ pathname: "/(admin)/account-detail", params: { id: String(acc.id) } })}
              activeOpacity={0.88}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(acc.fullName || acc.username || "U").charAt(0).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{acc.fullName || acc.username}</Text>
                <Text style={styles.meta}>@{acc.username} · {acc.email}</Text>
                <Text style={styles.meta}>Role: {(acc.role || "user").toUpperCase()}</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ))}
          {!rows.length && <Text style={styles.empty}>Không có tài khoản nào.</Text>}
          <View style={{ height: 80 }} />
        </ScrollView>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => router.push("/(admin)/add-account")}>
        <Feather name="plus" size={24} color="#FFF" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111", marginLeft: 10 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFF",
    fontSize: 14,
  },
  searchBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  searchBtnText: { color: "#FFF", fontWeight: "700", fontSize: 12 },
  resetBtn: { backgroundColor: "#E5E7EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  resetBtnText: { color: "#374151", fontWeight: "700", fontSize: 12 },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 10 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  avatarTxt: { fontSize: 17, fontWeight: "700", color: "#334155" },
  name: { fontSize: 15, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 12, color: "#6B7280", marginTop: 1 },
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
    marginHorizontal: 16,
    marginTop: 10,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
});
