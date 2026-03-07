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

export default function AdminAddAccountScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const formatDate = (text: string) => {
    const d = text.replace(/\D/g, "").slice(0, 8);
    if (d.length > 4) return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    if (d.length > 2) return `${d.slice(0, 2)}/${d.slice(2)}`;
    return d;
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={24} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thêm tài khoản</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Thông tin người dùng</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Thân nhân</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>Người thân</Text>
          <Feather name="chevron-right" size={20} color="#94A3B8" />
        </TouchableOpacity>

        <View style={styles.avatarSection}>
          <Text style={styles.avatarLabel}>Ảnh đại diện</Text>
          <TouchableOpacity style={styles.avatarPlaceholder}>
            <Feather name="camera" size={32} color="#94A3B8" />
            <Text style={styles.avatarBtnText}>Chọn ảnh</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Họ tên"
          placeholderTextColor="#94A3B8"
          value={fullName}
          onChangeText={setFullName}
        />
        <TextInput
          style={styles.input}
          placeholder="Ngày sinh (dd/mm/yyyy)"
          placeholderTextColor="#94A3B8"
          value={dob}
          onChangeText={(t) => setDob(formatDate(t))}
          keyboardType="number-pad"
          maxLength={10}
        />
        <TextInput
          style={styles.input}
          placeholder="Số điện thoại"
          placeholderTextColor="#94A3B8"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Địa chỉ"
          placeholderTextColor="#94A3B8"
          value={address}
          onChangeText={setAddress}
        />

        <TouchableOpacity
          style={styles.nextBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.nextBtnText}>Tiếp theo</Text>
        </TouchableOpacity>
        <View style={{ height: 40 }} />
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
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionLabel: { fontSize: 16, color: "#111", fontWeight: "500" },
  avatarSection: { marginTop: 20, marginBottom: 16 },
  avatarLabel: { fontSize: 14, color: "#64748B", marginBottom: 8 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtnText: { fontSize: 13, color: "#64748B", marginTop: 6 },
  input: {
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  nextBtn: {
    backgroundColor: BLUE,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  nextBtnText: { color: "#FFF", fontSize: 16, fontWeight: "600" },
});
