import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const FEATURES = [
  "CRUD user",
  "Tạo room / room_id / QR payload",
  "Mỗi room có đúng 1 HOST duy nhất",
  "Family toàn quyền quản lý trong room",
  "Caregiver chỉ đọc, quyền mở rộng bằng toggle",
];

export default function AdminAlertsScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trạng thái hệ thống phân quyền</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>RBAC Flow đã triển khai</Text>
          {FEATURES.map((item) => (
            <Text key={item} style={styles.item}>
              - {item}
            </Text>
          ))}
        </View>
        <TouchableOpacity style={styles.goBtn} onPress={() => router.push("/(admin)/room-management")}>
          <Text style={styles.goTxt}>Đi tới quản lý room</Text>
        </TouchableOpacity>
      </ScrollView>
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
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111", flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  item: { fontSize: 13, color: "#334155" },
  goBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12 },
  goTxt: { color: "#FFF", textAlign: "center", fontWeight: "700", fontSize: 13 },
});
