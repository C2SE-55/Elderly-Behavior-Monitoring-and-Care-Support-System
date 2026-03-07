import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const { width } = Dimensions.get("window");
const H_PAD = Math.min(20, width * 0.05);
const CARD_GAP = 10;
const CARD_WIDTH = (width - H_PAD * 2 - CARD_GAP) / 2;
const scale = Math.min(1.15, Math.max(0.9, width / 375));
const s = (n: number) => Math.round(n * scale);

const PRIMARY = "#4B2E83";
const BLUE = "#2563EB";
const GREEN = "#22C55E";
const RED = "#EF4444";
const ORANGE = "#F97316";
const TEAL = "#14B8A6";

// Dữ liệu mẫu biểu đồ (active / inactive) - tỉ lệ %
const CHART_DATA = [
  { day: "T2", active: 18, inactive: 5 },
  { day: "T3", active: 20, inactive: 4 },
  { day: "T4", active: 15, inactive: 8 },
  { day: "T5", active: 22, inactive: 3 },
  { day: "T6", active: 19, inactive: 6 },
  { day: "T7", active: 21, inactive: 4 },
  { day: "CN", active: 23, inactive: 2 },
];
const MAX_BAR = 25;

const PENDING_ACCOUNTS = [
  { name: "Bà Nguyễn Thị Hoa", id: "NTH1943" },
  { name: "Ông Trần Vân Minh", id: "TVM1950" },
];

export default function AdminHomepage() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 88 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: H_PAD }]}>
          <TouchableOpacity style={styles.headerLeft}>
            <Feather name="menu" size={24} color="#111" />
            <Text style={[styles.headerTitle, { fontSize: s(18) }]}>Admin Dashboard</Text>
          </TouchableOpacity>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(admin)/alerts")}>
              <Feather name="bell" size={22} color="#111" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>A</Text>
            </View>
          </View>
        </View>

        {/* Welcome */}
        <View style={[styles.welcomeBlock, { paddingHorizontal: H_PAD }]}>
          <Text style={[styles.welcomeTitle, { fontSize: s(20) }]}>Xin chào, Admin</Text>
          <Text style={[styles.welcomeSub, { fontSize: s(14) }]}>Quản lý tài khoản người cao tuổi</Text>
        </View>

        {/* 4 summary cards */}
        <View style={[styles.cardsRow, { paddingHorizontal: H_PAD }]}>
          <View style={[styles.summaryCard, { width: CARD_WIDTH }]}>
            <Feather name="user" size={s(22)} color={PRIMARY} />
            <Text style={[styles.cardLabel, { fontSize: s(12), marginTop: s(8) }]}>Tổng tài khoản</Text>
            <Text style={[styles.cardValue, { fontSize: s(20), marginTop: 4 }]}>120</Text>
          </View>
          <View style={[styles.summaryCard, styles.cardActive, { width: CARD_WIDTH }]}>
            <Feather name="users" size={s(22)} color={GREEN} />
            <Text style={[styles.cardLabel, { fontSize: s(12), marginTop: s(8) }]}>Hoạt động</Text>
            <Text style={[styles.cardValue, { color: GREEN, fontSize: s(20), marginTop: 4 }]}>108</Text>
          </View>
        </View>
        <View style={[styles.cardsRow, { paddingHorizontal: H_PAD }]}>
          <View style={[styles.summaryCard, styles.cardAlert, { width: CARD_WIDTH }]}>
            <Ionicons name="warning" size={s(22)} color={RED} />
            <Text style={[styles.cardLabel, { fontSize: s(12), marginTop: s(8) }]}>Cảnh báo</Text>
            <Text style={[styles.cardValue, { color: RED, fontSize: s(20), marginTop: 4 }]}>12</Text>
          </View>
          <View style={[styles.summaryCard, { width: CARD_WIDTH }]}>
            <Ionicons name="person-remove-outline" size={s(22)} color="#64748B" />
            <Text style={[styles.cardLabel, { fontSize: s(12), marginTop: s(8) }]}>Không hoạt động</Text>
            <Text style={[styles.cardValue, { fontSize: s(20), marginTop: 4 }]}>8</Text>
          </View>
        </View>

        {/* Account statistics chart */}
        <View style={[styles.chartCard, { marginHorizontal: H_PAD }]}>
          <View style={styles.chartHeader}>
            <Text style={[styles.chartTitle, { fontSize: s(16) }]}>Thống kê tài khoản</Text>
            <TouchableOpacity onPress={() => router.push("/(admin)/accounts")}>
              <Text style={[styles.chartLink, { fontSize: s(13) }]}>Yêu cầu mới</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.chartWrap}>
            {CHART_DATA.map((d, i) => {
              const total = d.active + d.inactive;
              const activeH = total > 0 ? (d.active / MAX_BAR) * 80 : 0;
              const inactiveH = total > 0 ? (d.inactive / MAX_BAR) * 80 : 0;
              return (
                <View key={i} style={styles.barCol}>
                  <View style={styles.barStack}>
                    <View
                      style={[
                        styles.barSegment,
                        styles.barActive,
                        { height: activeH },
                      ]}
                    />
                    <View
                      style={[
                        styles.barSegment,
                        styles.barInactive,
                        { height: inactiveH },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, { fontSize: s(11), marginTop: 6 }]}>{d.day}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: TEAL }]} />
              <Text style={styles.legendText}>Hoạt động</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ORANGE }]} />
              <Text style={styles.legendText}>Không hoạt động</Text>
            </View>
          </View>
        </View>

        {/* Pending accounts */}
        <Text style={[styles.sectionTitle, { paddingHorizontal: H_PAD, fontSize: s(16) }]}>Tài khoản chờ duyệt</Text>
        {PENDING_ACCOUNTS.map((acc, i) => (
          <View key={i} style={[styles.pendingCard, { marginHorizontal: H_PAD }]}>
            <View style={styles.pendingAvatar}>
              <Text style={styles.pendingAvatarText}>
                {acc.name.charAt(acc.name.indexOf(" ") + 1)}
              </Text>
            </View>
            <View style={styles.pendingInfo}>
              <Text style={[styles.pendingName, { fontSize: s(15) }]} numberOfLines={1}>{acc.name}</Text>
              <Text style={[styles.pendingId, { fontSize: s(13) }]}>{acc.id}</Text>
            </View>
            <TouchableOpacity style={styles.pendingBtn} onPress={() => router.push("/(admin)/accounts")}>
              <Text style={[styles.pendingBtnText, { fontSize: s(13) }]}>Chờ duyệt</Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Device status - Camera */}
        <View style={[styles.deviceCard, { marginHorizontal: H_PAD }]}>
          <View style={styles.deviceRow}>
            <Feather name="video" size={24} color="#64748B" />
            <View style={styles.deviceInfo}>
              <Text style={[styles.deviceName, { fontSize: s(15) }]}>Camera phòng 302</Text>
              <Text style={[styles.deviceStatus, { fontSize: s(13) }]}>Không kết nối 2 giờ</Text>
            </View>
            <View style={styles.offlineBadge}>
              <Text style={[styles.offlineText, { fontSize: s(12) }]}>Offline</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={[styles.actions, { paddingHorizontal: H_PAD }]}>
          <TouchableOpacity style={styles.primaryAction} onPress={() => router.push("/(admin)/add-account")}>
            <Feather name="plus" size={s(20)} color="#FFF" />
            <Text style={[styles.primaryActionText, { fontSize: s(15) }]}>Thêm tài khoản</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => Alert.alert("Xuất báo cáo", "Chức năng xuất báo cáo sẽ được triển khai.")}
          >
            <Feather name="download" size={s(20)} color={BLUE} />
            <Text style={[styles.secondaryActionText, { fontSize: s(15) }]}>Xuất báo cáo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  iconBtn: { padding: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  welcomeBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },
  welcomeSub: {
    fontSize: 14,
    color: "#64748B",
    marginTop: 4,
  },

  cardsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: CARD_GAP,
    marginBottom: CARD_GAP,
  },
  summaryCard: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardActive: { borderColor: "transparent" },
  cardAlert: { borderColor: "transparent" },
  cardLabel: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
    marginTop: 4,
  },

  chartCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  chartTitle: { fontSize: 16, fontWeight: "700", color: "#111" },
  chartLink: { fontSize: 13, color: BLUE, fontWeight: "600" },
  chartWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 120,
  },
  barCol: { flex: 1, alignItems: "center" },
  barStack: {
    width: "70%",
    height: 80,
    flexDirection: "column-reverse",
    borderRadius: 6,
    overflow: "hidden",
    gap: 0,
  },
  barSegment: { width: "100%", minHeight: 2 },
  barActive: { backgroundColor: TEAL },
  barInactive: { backgroundColor: ORANGE },
  barLabel: { fontSize: 11, color: "#64748B", marginTop: 6 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginTop: 12,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: "#64748B" },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  pendingAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  pendingAvatarText: { fontSize: 16, fontWeight: "700", color: "#64748B" },
  pendingInfo: { flex: 1, marginLeft: 12 },
  pendingName: { fontSize: 15, fontWeight: "600", color: "#111" },
  pendingId: { fontSize: 13, color: "#64748B", marginTop: 2 },
  pendingBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
  },
  pendingBtnText: { fontSize: 13, fontWeight: "600", color: "#B45309" },

  deviceCard: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  deviceInfo: { flex: 1, marginLeft: 12 },
  deviceName: { fontSize: 15, fontWeight: "600", color: "#111" },
  deviceStatus: { fontSize: 13, color: "#64748B", marginTop: 2 },
  offlineBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
  },
  offlineText: { fontSize: 12, fontWeight: "600", color: RED },

  actions: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
  },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: BLUE,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryActionText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: BLUE,
    paddingVertical: 14,
    borderRadius: 12,
  },
  secondaryActionText: { color: BLUE, fontSize: 15, fontWeight: "600" },
});
