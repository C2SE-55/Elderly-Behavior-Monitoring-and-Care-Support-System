import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Image,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from "react-native";
import { router, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Avatar from "../../assets/images/avatar.png";
import { api, logoutUser } from "../../services/api";
const PRIMARY = "#56328C";
const BG = "#F5F6FF";
const CARD = "rgba(255,255,255,0.92)";
const BORDER = "rgba(148,163,184,0.24)";

const ProfileHeader = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[headerStyles.container, { paddingTop: Math.max(10, insets.top) }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={headerStyles.backBtn}>
        <Ionicons name="arrow-back" size={22} color="#111827" />
      </TouchableOpacity>
      <Text style={headerStyles.title}>Thông tin cá nhân</Text>
      <View style={{ width: 36 }} />
    </View>
  );
};

const ProfileAvatar = ({ name }: { name: string }) => {
  const letter = useMemo(() => String(name || "A").trim().charAt(0).toUpperCase() || "A", [name]);
  return (
    <View style={avatarStyles.wrap}>
      <View style={avatarStyles.avatarOuter}>
        <Image source={Avatar} style={avatarStyles.avatar} />
        <View style={avatarStyles.avatarBadge}>
          <Text style={avatarStyles.avatarBadgeTxt}>{letter}</Text>
        </View>
      </View>
      <Text style={avatarStyles.hint}>Ảnh đại diện</Text>
    </View>
  );
};

// INPUT: 1 label + 1 TextInput (giống health)
type ProfileInputProps = {
  label: string;
  value?: string;
  placeholder?: string;
  secure?: boolean;
  editable?: boolean;
  helperText?: string;
  onChangeText?: (text: string) => void;
};

const ProfileInput = ({
  label,
  value,
  placeholder,
  secure,
  editable = true,
  helperText,
  onChangeText,
}: ProfileInputProps) => {
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <View style={[inputStyles.inputShell, !editable && inputStyles.inputShellDisabled]}>
        <TextInput
          style={[inputStyles.input, !editable && inputStyles.inputDisabled]}
          value={value}
          editable={editable}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secure}
          onChangeText={onChangeText}
        />
        {!editable && <Ionicons name="lock-closed-outline" size={16} color="#9CA3AF" />}
      </View>
      {helperText ? (
        <Text style={inputStyles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
};

export default function ProfileScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Khi mở màn hình, lấy ngay thông tin profile từ API
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const response = await api.get("/auth/profile");
        const data = response.data?.data;

        if (!data) {
          setError("Không lấy được thông tin tài khoản. Vui lòng đăng nhập lại.");
          return;
        }

        setFullName(data.fullName || data.full_name || "");
        setUsername(data.username || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
      } catch (err: any) {
        const backendMessage = err?.response?.data?.message;
        setError(
          backendMessage ||
            "Không thể tải thông tin tài khoản. Vui lòng kiểm tra kết nối hoặc đăng nhập lại."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleScrollToEnd = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
  };

  const handleUpdateProfile = async () => {
    const wantsChangePassword =
      oldPassword.trim() || newPassword.trim() || confirmNewPassword.trim();

    if (!fullName && !phone) {
      if (!wantsChangePassword) {
        setError("Vui lòng nhập ít nhất Họ và tên, Số điện thoại hoặc thông tin đổi mật khẩu.");
        setSuccess("");
        return;
      }
    }

    if (wantsChangePassword) {
      if (!oldPassword.trim() || !newPassword.trim() || !confirmNewPassword.trim()) {
        setError("Đổi mật khẩu cần nhập đủ mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.");
        setSuccess("");
        return;
      }
      if (newPassword.length < 6) {
        setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
        setSuccess("");
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setError("Mật khẩu mới và xác nhận mật khẩu mới không khớp.");
        setSuccess("");
        return;
      }
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await api.put("/auth/profile", {
        fullName,
        phone,
        ...(wantsChangePassword
          ? {
              oldPassword: oldPassword.trim(),
              newPassword: newPassword.trim(),
              confirmNewPassword: confirmNewPassword.trim(),
            }
          : {}),
      });

      const status = response.data?.status;
      const message = response.data?.message;
      const passwordChanged = !!response.data?.data?.passwordChanged;

      if (status && status !== "success") {
        setError(
          message || "Cập nhật hồ sơ thất bại. Vui lòng kiểm tra lại thông tin."
        );
        return;
      }

      setSuccess(message || "Cập nhật profile thành công.");
      if (wantsChangePassword) {
        setOldPassword("");
        setNewPassword("");
        setConfirmNewPassword("");
      }

      // Nếu đổi mật khẩu thành công, đưa user về màn login để đăng nhập lại bằng mật khẩu mới
      // (tránh hiểu nhầm “đổi mật khẩu không vào DB” và đảm bảo token cũ không tiếp tục dùng)
      if (passwordChanged) {
        logoutUser();
        router.replace("/(auths)/login");
      }
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setError(
        backendMessage ||
          "Không thể cập nhật thông tin tài khoản. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={screenStyles.safe} edges={["bottom"]}>
      <ProfileHeader />

      <KeyboardAvoidingView style={screenStyles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={screenStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProfileAvatar name={fullName || username || "Bạn"} />

          <View style={screenStyles.sectionCard}>
            <Text style={screenStyles.sectionTitle}>Tài khoản</Text>
            <ProfileInput
              label="Họ và tên"
              placeholder="Nhập họ và tên"
              value={fullName}
              editable
              onChangeText={setFullName}
              helperText="Bạn có thể cập nhật tên và số điện thoại."
            />
            <ProfileInput label="Tên đăng nhập" placeholder="username" value={username} editable={false} helperText="Không thể thay đổi." />
            <ProfileInput label="Email" placeholder="email" value={email} editable={false} helperText="Không thể thay đổi." />
            <ProfileInput
              label="Số điện thoại"
              placeholder="0912345678"
              value={phone}
              editable
              onChangeText={setPhone}
              helperText="Ví dụ: 0912345678"
            />
          </View>

          <View style={screenStyles.sectionCard}>
            <TouchableOpacity
              style={screenStyles.sectionRowHead}
              activeOpacity={0.9}
              onPress={() => setShowPasswordFields((v) => !v)}
            >
              <View style={screenStyles.sectionRowLeft}>
                <View style={screenStyles.sectionIcon}>
                  <Ionicons name="lock-closed-outline" size={18} color={PRIMARY} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={screenStyles.sectionTitle}>Bảo mật</Text>
                  <Text style={screenStyles.sectionSub}>Đổi mật khẩu (tuỳ chọn)</Text>
                </View>
              </View>
              <Ionicons name={showPasswordFields ? "chevron-up" : "chevron-down"} size={18} color="#6B7280" />
            </TouchableOpacity>

            {showPasswordFields ? (
              <View style={{ marginTop: 10 }}>
                <ProfileInput
                  label="Mật khẩu cũ"
                  placeholder="Nhập mật khẩu cũ"
                  value={oldPassword}
                  secure
                  editable
                  onChangeText={setOldPassword}
                />
                <ProfileInput
                  label="Mật khẩu mới"
                  placeholder="Nhập mật khẩu mới"
                  value={newPassword}
                  secure
                  editable
                  onChangeText={setNewPassword}
                  helperText="Tối thiểu 6 ký tự."
                />
                <ProfileInput
                  label="Xác nhận mật khẩu mới"
                  placeholder="Nhập lại mật khẩu mới"
                  value={confirmNewPassword}
                  secure
                  editable
                  onChangeText={setConfirmNewPassword}
                />
              </View>
            ) : null}
          </View>

          {!!error && <Text style={screenStyles.errorText}>{error}</Text>}
          {!!success && <Text style={screenStyles.successText}>{success}</Text>}

          <TouchableOpacity style={[buttonStyles.button, loading && { opacity: 0.7 }]} onPress={handleUpdateProfile} disabled={loading}>
            <Text style={buttonStyles.text}>{loading ? "Đang cập nhật..." : "Lưu thay đổi"}</Text>
          </TouchableOpacity>
        </ScrollView>

        {keyboardVisible && (
          <TouchableOpacity style={screenStyles.scrollDownButton} onPress={handleScrollToEnd} activeOpacity={0.9}>
            <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
            <Text style={screenStyles.scrollDownText}>Cuộn xuống</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  flex: {
    flex: 1,
  },
  content: {
    padding: 18,
    paddingBottom: 44,
    gap: 12,
  },
  scrollDownButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scrollDownText: {
    color: "white",
    fontSize: 12,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 8,
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  successText: {
    marginTop: 8,
    color: "#047857",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  sectionSub: { marginTop: 2, fontSize: 12, fontWeight: "700", color: "#6B7280" },
  sectionRowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionRowLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.16)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
  },
});

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: BG,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  title: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
    textAlign: "center",
  },
});

const avatarStyles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 6, marginBottom: 6 },
  avatarOuter: { width: 110, height: 110, borderRadius: 55, padding: 4, backgroundColor: CARD, borderWidth: 1, borderColor: BORDER },
  avatar: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
  },
  avatarBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: BG,
  },
  avatarBadgeTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
  hint: { marginTop: 10, fontSize: 12, fontWeight: "700", color: "#6B7280" },
});

const inputStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: "#111827",
    fontWeight: "800",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputShellDisabled: { backgroundColor: "#F8FAFC" },
  input: { flex: 1, fontSize: 14, color: "#0F172A", fontWeight: "700", paddingVertical: 0 },
  inputDisabled: { color: "#6B7280" },
  helper: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
  },
});

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: PRIMARY,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  text: {
    color: "white",
    fontWeight: "900",
  },
});
