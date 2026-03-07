import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BLUE = "#2563EB";
const GREEN = "#22C55E";

export default function AdminAccountDetailScreen() {
  const router = useRouter();
  const [active, setActive] = React.useState(true);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tài khoản</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>L</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Bà Nguyễn Thị Lan</Text>
            <Text style={styles.profileMeta}>75 tuổi · ID: NL1948</Text>
          </View>
          <TouchableOpacity>
            <Feather name="edit-2" size={20} color={BLUE} />
          </TouchableOpacity>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Trạng thái: Hoạt động</Text>
          <Switch value={active} onValueChange={setActive} trackColor={{ false: "#E2E8F0", true: GREEN }} thumbColor="#FFF" />
        </View>

        <Text style={styles.sectionTitle}>Thông tin liên hệ</Text>
        <View style={styles.infoCard}>
          <Feather name="phone" size={20} color="#64748B" />
          <Text style={styles.infoText}>Số điện thoại: 0978 xxx xxx</Text>
        </View>
        <View style={styles.infoCard}>
          <Feather name="mail" size={20} color="#64748B" />
          <Text style={styles.infoText}>Email: ngothilan@gmail.com</Text>
        </View>
        <View style={styles.infoCard}>
          <Feather name="map-pin" size={20} color="#64748B" />
          <Text style={styles.infoText}>Địa chỉ: HN – Phòng 101, Chung cư ABC</Text>
        </View>

        <Text style={styles.sectionTitle}>Người thân</Text>
        <View style={styles.infoCard}>
          <Feather name="phone" size={20} color="#64748B" />
          <View>
            <Text style={styles.infoText}>Nguyễn Vân A (Con trai)</Text>
            <Text style={styles.infoSub}>0903 xxx xxx</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Thiết bị</Text>
        <View style={styles.deviceRow}>
          <Feather name="video" size={22} color="#64748B" />
          <Text style={styles.deviceName}>Camera phòng 101</Text>
          <View style={styles.onlineBadge}><Text style={styles.onlineText}>Online</Text></View>
        </View>
        <View style={styles.deviceRow}>
          <Feather name="watch" size={22} color="#64748B" />
          <Text style={styles.deviceName}>Vòng đeo tay - Đã kết nối, 95%</Text>
          <TouchableOpacity><Feather name="trash-2" size={18} color="#64748B" /></TouchableOpacity>
        </View>
        <View style={styles.deviceRow}>
          <Feather name="layers" size={22} color="#64748B" />
          <Text style={styles.deviceName}>Cảm biến cửa</Text>
        </View>

        <Text style={styles.sectionTitle}>Lịch sử hoạt động</Text>
        <View style={styles.historyItem}>
          <Text style={styles.historyDate}>24/04/2024</Text>
          <Text style={styles.historyText}>Đăng nhập hệ thống</Text>
        </View>
        <View style={styles.historyItem}>
          <Text style={styles.historyDate}>23/04/2024</Text>
          <Text style={styles.historyText}>Xem camera phòng 101</Text>
        </View>
        <View style={styles.historyItem}>
          <Text style={styles.historyDate}>22/04/2024</Text>
          <Text style={styles.historyText}>Gửi cảnh báo khẩn cấp</Text>
        </View>
        <View style={{ height: 88 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F4F4F4" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  profileRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#E2E8F0", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#64748B" },
  profileInfo: { flex: 1, marginLeft: 14 },
  profileName: { fontSize: 17, fontWeight: "700", color: "#111" },
  profileMeta: { fontSize: 14, color: "#64748B", marginTop: 2 },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFF", padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  statusLabel: { fontSize: 15, color: "#111", fontWeight: "500" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#111", marginBottom: 10, marginTop: 8 },
  infoCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", gap: 12 },
  infoText: { flex: 1, fontSize: 14, color: "#111" },
  infoSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  deviceRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFF", padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", gap: 12 },
  deviceName: { flex: 1, fontSize: 14, color: "#111" },
  onlineBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#DCFCE7" },
  onlineText: { fontSize: 12, fontWeight: "600", color: GREEN },
  historyItem: { backgroundColor: "#FFF", padding: 14, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB" },
  historyDate: { fontSize: 12, color: "#64748B" },
  historyText: { fontSize: 14, color: "#111", marginTop: 4 },
});
