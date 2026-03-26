import React, { useEffect, useRef, useState } from "react";
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
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Avatar from "../../assets/images/avatar.png";
import { api } from "../../services/api";
const PRIMARY = "#4B2E83";

// HEADER: giống trang Quản lý thông tin sức khỏe
const ProfileHeader = () => {
  const router = useRouter();

  return (
    <View style={headerStyles.container}>
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="white" />
      </TouchableOpacity>
      <Text style={headerStyles.title}>Thông tin cá nhân</Text>
      <View style={{ width: 22 }} />
    </View>
  );
};

// AVATAR: Ảnh đại diện + nút đổi hình (giống health)
const ProfileAvatar = () => {
  return (
    <View style={avatarStyles.container}>
      <Image source={Avatar} style={avatarStyles.avatar} />
      <TouchableOpacity>
        <Text style={avatarStyles.change}>Đổi hình đại diện</Text>
      </TouchableOpacity>
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
      <TextInput
        style={inputStyles.input}
        value={value}
        editable={editable}
        placeholder={placeholder}
        placeholderTextColor="#999"
        secureTextEntry={secure}
        onChangeText={onChangeText}
      />
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
    <View style={screenStyles.container}>
      <ProfileHeader />

      <KeyboardAvoidingView
        style={screenStyles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={screenStyles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ProfileAvatar />

          <ProfileInput
            label="Họ và tên"
            placeholder="Nhập họ và tên"
            value={fullName}
            editable
            onChangeText={setFullName}
            helperText="Có thể thay đổi. Không được để trống nếu muốn cập nhật."
          />
          <View style={{ height: 4 }} />
          <ProfileInput
            label="Tên đăng nhập"
            placeholder="Nhập username"
            value={username}
            editable={false}
            helperText="Không thể thay đổi username."
          />
          <ProfileInput
            label="Email"
            placeholder="Nhập email"
            value={email}
            editable={false}
            helperText="Không thể thay đổi email."
          />
          <ProfileInput
            label="Số điện thoại"
            placeholder="Nhập số điện thoại"
            value={phone}
            editable
            onChangeText={setPhone}
            helperText="Phải có đúng 10 chữ số (định dạng Việt Nam, ví dụ: 0912345678)."
          />
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
            helperText="Mật khẩu mới tối thiểu 6 ký tự."
          />
          <ProfileInput
            label="Xác nhận mật khẩu mới"
            placeholder="Nhập lại mật khẩu mới"
            value={confirmNewPassword}
            secure
            editable
            onChangeText={setConfirmNewPassword}
          />

          {error ? (
            <Text style={screenStyles.errorText}>{error}</Text>
          ) : null}
          {success ? (
            <Text style={screenStyles.successText}>{success}</Text>
          ) : null}

          <TouchableOpacity
            style={buttonStyles.button}
            onPress={handleUpdateProfile}
            disabled={loading}
          >
            <Text style={buttonStyles.text}>
              {loading ? "Đang cập nhật..." : "Cập Nhật"}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {keyboardVisible && (
          <TouchableOpacity
            style={screenStyles.scrollDownButton}
            onPress={handleScrollToEnd}
          >
            <Text style={screenStyles.scrollDownText}>Cuộn xuống</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// STYLES (giống health)
const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  scrollDownButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  scrollDownText: {
    color: "white",
    fontSize: 12,
    fontWeight: "500",
  },
  errorText: {
    marginTop: 12,
    color: "red",
    fontSize: 13,
    textAlign: "center",
  },
  successText: {
    marginTop: 12,
    color: "green",
    fontSize: 13,
    textAlign: "center",
  },
});

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: PRIMARY,
    height: 110,
    paddingTop: 45,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

const avatarStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  change: {
    marginTop: 8,
    color: PRIMARY,
    fontSize: 13,
  },
});

const inputStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 15,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: "#333",
  },
  input: {
    backgroundColor: "#EEEEEE",
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  helper: {
    marginTop: 4,
    fontSize: 11,
    color: "#6B7280",
  },
});

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: PRIMARY,
    height: 48,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
  },
  text: {
    color: "white",
    fontWeight: "600",
  },
});
