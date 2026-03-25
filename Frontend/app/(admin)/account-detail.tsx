import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AdminUserAccount, adminDeleteUser, getAdminUserById } from "@/services/api";

export default function AdminAccountDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const userId = Number(params?.id || 0);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [row, setRow] = useState<AdminUserAccount | null>(null);

  const loadDetail = useCallback(async () => {
    if (!userId) {
      setError("Thiếu user id.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const data = await getAdminUserById(userId);
      setRow(data);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được chi tiết tài khoản.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const onDelete = () => {
    if (!row?.id) return;
    Alert.alert("Xóa tài khoản", `Bạn có chắc muốn xóa @${row.username}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            setDeleting(true);
            setError("");
            await adminDeleteUser(row.id);
            router.replace("/(admin)/accounts");
          } catch (e: any) {
            setError(e?.response?.data?.message || "Không thể xóa tài khoản.");
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tài khoản</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingTxt}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!row ? (
            <Text style={styles.meta}>Không tìm thấy tài khoản.</Text>
          ) : (
            <>
              <View style={styles.card}>
                <Text style={styles.name}>{row.fullName || row.username}</Text>
                <Text style={styles.meta}>@{row.username}</Text>
                <Text style={styles.meta}>Role hệ thống: {(row.role || "user").toUpperCase()}</Text>
                <Text style={styles.meta}>Email: {row.email}</Text>
                <Text style={styles.meta}>SĐT: {row.phone || "-"}</Text>
                <Text style={styles.meta}>Ngày sinh: {row.dateOfBirth || "-"}</Text>
                <Text style={styles.meta}>Tạo lúc: {row.createdAt || "-"}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Gán room cho user</Text>
                <Text style={styles.meta}>
                  Admin tạo room ở màn hình "Tạo room / QR", sau đó gửi room_id cho user này để user nhập và lên FAMILY.
                </Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/(admin)/room-management")}>
                  <Text style={styles.secondaryTxt}>Đi tới màn hình tạo room</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={[styles.deleteBtn, deleting && { opacity: 0.6 }]} onPress={onDelete} disabled={deleting}>
                <Text style={styles.deleteTxt}>{deleting ? "Đang xóa..." : "Xóa tài khoản"}</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      )}
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
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  scrollContent: { padding: 16, gap: 10, paddingBottom: 24 },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 6 },
  name: { fontSize: 16, fontWeight: "700", color: "#111827" },
  title: { fontSize: 14, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 12, color: "#6B7280" },
  loading: { alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 30 },
  loadingTxt: { color: "#6B7280", fontSize: 12 },
  secondaryBtn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  secondaryTxt: { color: "#1D4ED8", textAlign: "center", fontWeight: "700", fontSize: 13 },
  deleteBtn: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  deleteTxt: { color: "#991B1B", textAlign: "center", fontWeight: "700", fontSize: 13 },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
