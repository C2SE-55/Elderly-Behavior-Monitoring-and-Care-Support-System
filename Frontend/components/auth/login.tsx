import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, setAuth } from "../../services/api";
import Logo from "../../assets/images/Logo.png";

const PRIMARY = "#4B2E83";

export default function LoginScreen() {
  const router = useRouter();
  const [secure, setSecure] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Vui lòng nhập tên đăng nhập và mật khẩu");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/login", {
        username,
        password,
      });

      // Đọc dữ liệu trả về một cách an toàn, không crash nếu thiếu field
      const status = response.data?.status;
      const backendMessage = response.data?.message;
      const payload = response.data?.data || {};
      const token = payload?.token as string | undefined;
      const user = payload?.user as any | undefined;

      // Nếu backend trả lỗi theo chuẩn riêng (status !== 'success')
      if (status && status !== "success") {
        setError(backendMessage || "Đăng nhập thất bại, vui lòng thử lại");
        return;
      }

      // Lưu auth vào client (nhớ không dùng AsyncStorage để tránh lỗi native)
      if (token) {
        setAuth(token, user);
      }

      // Điều hướng theo role: admin vào khu vực admin, còn lại vào giao diện user
      const normalizedRole =
        typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
      const destination = normalizedRole === "admin" ? "/(admin)" : "/(tabs)";
      router.replace(destination);
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const networkMessage = err?.message;
      const message =
        backendMessage ||
        (networkMessage === "Network Error"
          ? "Không thể kết nối tới server. Vui lòng kiểm tra lại API_BASE_URL và việc backend đã chạy chưa."
          : networkMessage) ||
        "Đăng nhập thất bại, vui lòng thử lại";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Image source={Logo} style={styles.logo} resizeMode="contain" />

      {/* Form */}
      <View style={styles.form}>
        <TextInput
          placeholder="Tên đăng nhập"
          placeholderTextColor="#8E8E93"
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <View style={styles.passwordContainer}>
          <TextInput
            placeholder="Mật khẩu"
            placeholderTextColor="#8E8E93"
            secureTextEntry={secure}
            style={styles.passwordInput}
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => setSecure(!secure)}>
            <Ionicons
              name={secure ? "eye-off-outline" : "eye-outline"}
              size={22}
              color="#8E8E93"
            />
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.loginText}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Text>
        </TouchableOpacity>

        <View style={styles.signupContainer}>
          <Text style={styles.signupText}>
            Bạn không có tài khoản vui lòng?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(auths)/signup")}>
            <Text style={styles.signupLink}>Đăng ký</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

{/* Css style */ }
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F4F4F4",
    paddingHorizontal: 28,
    paddingTop: 60,
  },

  logo: {
    width: 200,
    height: 200,
    alignSelf: "center",
    marginBottom: 30,
  },

  form: {
    width: "100%",
  },

  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 18,
  },

  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 14,
    marginBottom: 10,
  },

  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
  },

  forgotContainer: {
    alignItems: "flex-end",
    marginBottom: 25,
  },

  forgotText: {
    fontSize: 13,
    color: "#000",
  },

  loginButton: {
    backgroundColor: PRIMARY,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },

  loginText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  signupContainer: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
  },

  signupText: {
    fontSize: 13,
    color: "#000",
  },

  signupLink: {
    fontSize: 13,
    color: PRIMARY,
    fontWeight: "600",
  },
  errorText: {
    color: "red",
    marginBottom: 12,
    fontSize: 13,
    textAlign: "center",
  },
});
