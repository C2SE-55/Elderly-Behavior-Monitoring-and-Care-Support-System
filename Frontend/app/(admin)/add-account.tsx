import React, { useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { adminCreateUser } from "@/services/api";
import { AnimatedPressable, ScreenEnter } from "@/components/ui/AnimatedPressable";

const PLACEHOLDER_COLOR = "#64748B";
const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.34)",
};

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
      <ScreenEnter>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Feather name="arrow-left" size={20} color={COLORS.text} />
        </AnimatedPressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Tạo tài khoản mới</Text>
          <Text style={styles.headerSub}>Admin tạo tài khoản USER trong hệ thống</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}

        <View style={styles.formCard}>
          <View style={styles.formHead}>
            <View style={styles.formHeadIcon}>
              <Feather name="user-plus" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.formTitle}>Thông tin tài khoản</Text>
              <Text style={styles.formHint}>Các trường có dấu * là bắt buộc</Text>
            </View>
          </View>

          <Field label="Họ tên">
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: Nguyễn Văn A"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={fullName}
              onChangeText={setFullName}
            />
          </Field>

          <Field label="Username *">
            <TextInput
              style={styles.input}
              placeholder="username đăng nhập"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </Field>

          <Field label="Email *">
            <TextInput
              style={styles.input}
              placeholder="example@email.com"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Field>

          <Field label="Số điện thoại">
            <TextInput
              style={styles.input}
              placeholder="Ví dụ: 09xxxxxxxx"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={phone}
              onChangeText={setPhone}
            />
          </Field>

          <Field label="Ngày sinh">
            <TextInput
              style={styles.input}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={dob}
              onChangeText={setDob}
            />
          </Field>

          <Field label="Mật khẩu *">
            <TextInput
              style={styles.input}
              placeholder="Nhập mật khẩu"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </Field>

          <Field label="Nhắc lại mật khẩu *">
            <TextInput
              style={styles.input}
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor={PLACEHOLDER_COLOR}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </Field>
        </View>

        <AnimatedPressable
          style={[styles.nextBtn, loading && { opacity: 0.7 }]}
          onPress={onCreate}
          disabled={loading}
          accessibilityRole="button"
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Feather name="check-circle" size={18} color="#FFF" />
              <Text style={styles.nextBtnText}>Tạo tài khoản</Text>
            </>
          )}
        </AnimatedPressable>
      </ScrollView>
      </ScreenEnter>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
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
  scrollContent: { padding: 18, paddingBottom: 24, gap: 10 },
  formCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  formHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  formHeadIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  formTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  formHint: { marginTop: 2, fontSize: 11, fontWeight: "700", color: COLORS.sub },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "800", color: COLORS.sub },
  input: {
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.30)",
    color: COLORS.text,
    fontWeight: "700",
  },
  nextBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  nextBtnText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
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
