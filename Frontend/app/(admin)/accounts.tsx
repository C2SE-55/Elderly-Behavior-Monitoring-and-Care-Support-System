import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BLUE = "#2563EB";
const GREEN = "#22C55E";
const RED = "#EF4444";
const ORANGE = "#F97316";

const MOCK_ACCOUNTS = [
  { name: "Bà Nguyễn Thị Lan", age: 75, id: "NL1948", status: "active" as const },
  { name: "Ông Trần Văn Minh", age: 78, id: "TVM1950", status: "alert" as const },
  { name: "Bà Lê Thị Hoa", age: 72, id: "LTH1951", status: "inactive" as const },
];

export default function AdminAccountsScreen() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const getStatusStyle = (status: string) => {
    if (status === "active") return { color: GREEN, label: "Hoạt động" };
    if (status === "alert") return { color: ORANGE, label: "Cảnh báo" };
    return { color: RED, label: "Không hoạt động" };
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/(admin)")} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý tài khoản</Text>
        <View style={styles.headerRight}>
          <View style={styles.searchWrap}>
            <Feather name="search" size={18} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
            />
          </View>
          <TouchableOpacity style={styles.filterBtn}>
            <Text style={styles.filterText}>Lọc</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {MOCK_ACCOUNTS.map((acc, i) => {
          const st = getStatusStyle(acc.status);
          return (
            <TouchableOpacity
              key={i}
              style={styles.card}
              onPress={() => router.push("/(admin)/account-detail")}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{acc.name.charAt(acc.name.indexOf(" ") + 1)}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardName}>{acc.name}</Text>
                <Text style={styles.cardMeta}>{acc.age} tuổi · ID: {acc.id}</Text>
                <View style={[styles.statusBadge, { backgroundColor: st.color + "20" }]}>
                  <Text style={[styles.statusText, { color: st.color }]}>{st.label}</Text>
                </View>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity style={styles.iconBtn}>
                  <Feather name="phone" size={20} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Feather name="mail" size={20} color="#64748B" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn}>
                  <Feather name="more-vertical" size={20} color="#64748B" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 88 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push("/(admin)/add-account")}
      >
        <Feather name="plus" size={28} color="#FFF" />
      </TouchableOpacity>
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
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 10,
    width: 140,
  },
  searchInput: { flex: 1, paddingVertical: 8, paddingLeft: 6, fontSize: 14 },
  filterBtn: { padding: 6 },
  filterText: { fontSize: 14, color: BLUE, fontWeight: "600" },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 24 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700", color: "#64748B" },
  cardBody: { flex: 1, marginLeft: 12 },
  cardName: { fontSize: 16, fontWeight: "600", color: "#111" },
  cardMeta: { fontSize: 13, color: "#64748B", marginTop: 2 },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  statusText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", gap: 4 },
  iconBtn: { padding: 8 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 80,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});
