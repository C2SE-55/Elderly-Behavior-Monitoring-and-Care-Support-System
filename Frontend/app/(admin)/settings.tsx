import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function AdminSettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cài đặt</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.menuRow}>
          <Feather name="user" size={22} color="#64748B" />
          <Text style={styles.menuText}>Tài khoản Admin</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuRow}>
          <Feather name="bell" size={22} color="#64748B" />
          <Text style={styles.menuText}>Thông báo</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuRow}>
          <Feather name="shield" size={22} color="#64748B" />
          <Text style={styles.menuText}>Bảo mật</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#111" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingTop: 20 },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  menuText: { flex: 1, fontSize: 16, color: "#111", marginLeft: 12 },
});
