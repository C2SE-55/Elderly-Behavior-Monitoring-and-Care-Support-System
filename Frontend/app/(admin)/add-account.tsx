import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminCreateUser } from "@/services/api";

export default function AdminAddAccountScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const onCreate = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("Username, email, password, confirmPassword là bắt buộc.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      setSuccess("");
      await adminCreateUser({
        username: username.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        dateOfBirth: dob.trim() || undefined,
      });
      setSuccess("Tạo tài khoản USER thành công.");
      setFullName("");
      setUsername("");
      setEmail("");
      setPhone("");
      setDob("");
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể tạo tài khoản.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin tạo tài khoản USER</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}

        <TextInput style={styles.input} placeholder="Họ tên" value={fullName} onChangeText={setFullName} />
        <TextInput
          style={styles.input}
          placeholder="Username *"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email *"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput style={styles.input} placeholder="Số điện thoại" value={phone} onChangeText={setPhone} />
        <TextInput style={styles.input} placeholder="Ngày sinh (YYYY-MM-DD)" value={dob} onChangeText={setDob} />
        <TextInput
          style={styles.input}
          placeholder="Mật khẩu *"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Nhắc lại mật khẩu *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <TouchableOpacity style={[styles.nextBtn, loading && { opacity: 0.7 }]} onPress={onCreate} disabled={loading}>
          {loading ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.nextBtnText}>Tạo tài khoản</Text>}
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
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#111" },
  scrollContent: { padding: 16, paddingBottom: 24, gap: 10 },
  input: {
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  nextBtn: {
    backgroundColor: "#2563EB",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 8,
  },
  nextBtnText: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  success: {
    color: "#166534",
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
