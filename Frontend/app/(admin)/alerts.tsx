import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BLUE = "#2563EB";
const RED = "#EF4444";
const ORANGE = "#F97316";

const TABS = ["Tất cả", "Chưa xử lý", "Đã xử lý"] as const;

const MOCK_ALERTS = [
  { title: "Camera phòng 302", sub: "Không kết nối", tag: "Offline", color: RED, time: "10:18" },
  { title: "Bà Mai - Phòng 303", sub: "Không hoạt động", tag: "ngã trượt đáng ngờ", color: RED, time: "09:30" },
  { title: "Ông Trung - Pin yếu", sub: "Vòng tay gần hết pin", tag: "", color: ORANGE, time: "09:45" },
  { title: "2 tài khoản mới cần duyệt", sub: "Bà Hoa, Ông Minh", tag: "", color: BLUE, time: "" },
];

export default function AdminAlertsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Tất cả");

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cảnh báo hệ thống</Text>
        <TouchableOpacity style={styles.bellBtn}>
          <Feather name="bell" size={22} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_ALERTS.map((item, i) => (
          <View key={i} style={styles.alertCard}>
            <View style={styles.alertBody}>
              <Text style={styles.alertTitle}>{item.title}</Text>
              <Text style={styles.alertSub}>{item.sub}</Text>
              {item.tag ? (
                <View style={[styles.alertTag, { backgroundColor: item.color + "20" }]}>
                  <Text style={[styles.alertTagText, { color: item.color }]}>{item.tag}</Text>
                </View>
              ) : null}
            </View>
            {item.time ? <Text style={styles.alertTime}>{item.time}</Text> : null}
          </View>
        ))}
        <TouchableOpacity style={styles.viewAllBtn}>
          <Text style={styles.viewAllText}>Xem tất cả</Text>
        </TouchableOpacity>
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111", flex: 1 },
  bellBtn: { padding: 4 },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  tabActive: { backgroundColor: BLUE },
  tabText: { fontSize: 14, color: "#64748B", fontWeight: "600" },
  tabTextActive: { color: "#FFF" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  alertCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  alertBody: { flex: 1 },
  alertTitle: { fontSize: 15, fontWeight: "600", color: "#111" },
  alertSub: { fontSize: 13, color: "#64748B", marginTop: 2 },
  alertTag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  alertTagText: { fontSize: 12, fontWeight: "600" },
  alertTime: { fontSize: 13, color: "#64748B", marginLeft: 8 },
  viewAllBtn: {
    backgroundColor: BLUE,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 16,
  },
  viewAllText: { color: "#FFF", fontSize: 15, fontWeight: "600" },
});
