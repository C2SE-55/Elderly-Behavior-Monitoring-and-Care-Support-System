import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AdminUserAccount, adminDeleteUser, getAdminUserById } from "@/services/api";

/** Lấy phần ngày (YYYY-MM-DD) từ ISO hoặc chuỗi tương tự, hiển thị DD/MM/YYYY — không nối thêm giờ/múi giờ. */
function formatDateOnly(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "-";
  const raw = String(value).trim();
  const head = raw.includes("T") ? raw.split("T")[0]! : raw.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(head);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const t = Date.parse(raw);
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const yyyy = d.getUTCFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return raw;
}

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.9}>
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chi tiết tài khoản</Text>
          <Text style={styles.headerSub}>Thông tin hồ sơ và thao tác quản trị</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.loadingTxt}>Đang tải dữ liệu...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!row ? (
            <Text style={styles.meta}>Không tìm thấy tài khoản.</Text>
          ) : (
            <>
              <View style={styles.heroCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarTxt}>{(row.fullName || row.username || "U").charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{row.fullName || row.username}</Text>
                  <Text style={styles.meta}>@{row.username}</Text>
                  <View style={styles.rolePill}>
                    <Text style={styles.rolePillTxt}>{(row.role || "user").toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Thông tin tài khoản</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{row.email || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Số điện thoại</Text>
                  <Text style={styles.infoValue}>{row.phone || "-"}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ngày sinh</Text>
                  <Text style={styles.infoValue}>{formatDateOnly(row.dateOfBirth)}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Ngày tạo</Text>
                  <Text style={styles.infoValue}>{formatDateOnly(row.createdAt)}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.title}>Gán room cho user</Text>
                <Text style={styles.metaBlock}>
                  Admin tạo room ở màn hình &quot;Tạo room / QR&quot;, sau đó gửi room_id cho user này để user nhập và lên FAMILY.
                </Text>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.push("/(admin)/room-management")}
                  activeOpacity={0.9}
                >
                  <Feather name="home" size={16} color="#1D4ED8" />
                  <Text style={styles.secondaryTxt}>Đi tới màn hình tạo room</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.deleteBtn, deleting && { opacity: 0.6 }]}
                onPress={onDelete}
                disabled={deleting}
                activeOpacity={0.9}
              >
                <Feather name="trash-2" size={16} color={COLORS.dangerText} />
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
  scrollContent: { padding: 18, gap: 10, paddingBottom: 24 },
  heroCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { fontSize: 19, fontWeight: "900", color: COLORS.primary },
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
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 12,
    gap: 8,
  },
  name: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  title: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.sub, fontWeight: "700" },
  metaBlock: { fontSize: 12, color: COLORS.sub, fontWeight: "600", lineHeight: 18 },
  infoRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 2,
  },
  infoLabel: { fontSize: 11, fontWeight: "800", color: COLORS.sub },
  infoValue: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  loading: { alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 30 },
  loadingTxt: { color: COLORS.sub, fontSize: 12 },
  secondaryBtn: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryTxt: { color: "#1D4ED8", textAlign: "center", fontWeight: "900", fontSize: 13 },
  deleteBtn: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteTxt: { color: COLORS.dangerText, textAlign: "center", fontWeight: "900", fontSize: 13 },
  error: {
    color: COLORS.dangerText,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
