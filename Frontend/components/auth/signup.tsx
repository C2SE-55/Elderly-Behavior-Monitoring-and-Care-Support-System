import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
} from "react-native";
import { useRef } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "../../services/api";
import Logo from "../../assets/images/Logo.png";

export default function SignupScreen() {
  const router = useRouter();
  const [secure1, setSecure1] = useState(true);
  const [secure2, setSecure2] = useState(true);
  const usernameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const dateRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const passRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const isValidUsername = (value: string) => {
    const v = String(value || "").trim();
    return v.length >= 6 && /^[A-Za-z0-9]+$/.test(v) && /[A-Za-z]/.test(v) && /[0-9]/.test(v);
  };

  const isValidPassword = (value: string) => {
    const v = String(value || "").trim();
    return v.length >= 7 && /[0-9]/.test(v) && /[^A-Za-z0-9]/.test(v);
  };

  const usernameRuleMessage = (value: string) => {
    const v = String(value || "").trim();
    if (v.length < 6) return "Tên đăng nhập phải có ít nhất 6 ký tự.";
    if (!/^[A-Za-z0-9]+$/.test(v)) return "Tên đăng nhập chỉ gồm chữ cái và số.";
    if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) return "Tên đăng nhập phải chứa cả chữ và số.";
    return "";
  };

  const passwordRuleMessage = (value: string) => {
    const v = String(value || "").trim();
    if (v.length < 7) return "Mật khẩu phải trên 6 ký tự.";
    if (!/[0-9]/.test(v)) return "Mật khẩu cần có ít nhất 1 số.";
    if (!/[^A-Za-z0-9]/.test(v)) return "Mật khẩu cần có ít nhất 1 ký tự đặc biệt (@#$*&...).";
    return "";
  };
  const passHasMinLen = String(password || "").trim().length >= 7;
  const passHasNumber = /[0-9]/.test(String(password || ""));
  const passHasSpecial = /[^A-Za-z0-9]/.test(String(password || ""));
  const showPasswordChecklist = passwordFocused;

  const handleDateChange = (text: string) => {
    // Chỉ cho nhập số, tối đa 8 ký tự (ddMMyyyy)
    const digits = text.replace(/[^\d]/g, "").slice(0, 8);

    let formatted = digits;

    if (digits.length > 4) {
      // ddMMyyyy -> dd/MM/yyyy
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      // ddMM -> dd/MM
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setDateOfBirth(formatted);
  };

  const handleSignup = async () => {
    if (!fullName || !username || !email || !password || !confirmPassword) {
      setError("Vui lòng điền đầy đủ các trường bắt buộc");
      return;
    }
    if (!isValidUsername(username)) {
      setError(usernameRuleMessage(username) || "Username không đúng định dạng.");
      return;
    }
    if (!isValidPassword(password)) {
      setError(passwordRuleMessage(password) || "Mật khẩu không đúng định dạng.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Mật khẩu và xác nhận mật khẩu không khớp");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await api.post("/auth/register", {
        fullName,
        username,
        email,
        dateOfBirth,
        phone,
        password,
        confirmPassword,
      });

      router.replace("/(auths)/login");
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      const networkMessage = err?.message;
      const message =
        backendMessage ||
        (networkMessage === "Network Error"
          ? "Không thể kết nối tới server. Bật Backend (port 5000), cùng Wi‑Fi với điện thoại; trên máy thật app tự dùng IP LAN từ Expo (không dùng localhost trên điện thoại)."
          : networkMessage) ||
        "Đăng ký thất bại, vui lòng thử lại";
      setError(message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.container}>
              <Image source={Logo} style={styles.logo} resizeMode="contain" />

              <TextInput
                placeholder="Họ và tên"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                value={fullName}
                onChangeText={setFullName}
              />
              <TextInput
                ref={usernameRef}
                placeholder="Tên đăng nhập"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
                value={username}
                onChangeText={setUsername}
                onBlur={() => setUsernameTouched(true)}
                autoCapitalize="none"
              />
              {usernameTouched && !!username && !isValidUsername(username) ? (
                <Text style={styles.ruleText}>{usernameRuleMessage(username)}</Text>
              ) : null}
              <TextInput
                ref={emailRef}
                placeholder="Email"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                keyboardType="email-address"
                onSubmitEditing={() => dateRef.current?.focus()}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
              />
              <TextInput
                ref={dateRef}
                placeholder="dd/mm/yyyy"
                placeholderTextColor="#999"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={10}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
                value={dateOfBirth}
                onChangeText={handleDateChange}
              />
              <TextInput
                ref={phoneRef}
                placeholder="Số điện thoại"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                keyboardType="phone-pad"
                onSubmitEditing={() => passRef.current?.focus()}
                value={phone}
                onChangeText={setPhone}
              />

              <View style={styles.passwordContainer}>
                <TextInput
                  ref={passRef}
                  placeholder="Mật khẩu"
                  placeholderTextColor="#999"
                  secureTextEntry={secure1}
                  style={styles.passwordInput}
                  returnKeyType="next"
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => {
                    setPasswordFocused(false);
                    setPasswordTouched(true);
                  }}
                />
                <TouchableOpacity onPress={() => setSecure1(!secure1)}>
                  <Ionicons
                    name={secure1 ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>
              {showPasswordChecklist ? (
                <View style={styles.passwordRulesWrap}>
                  <View style={styles.ruleRow}>
                    <View style={[styles.ruleDot, passHasSpecial && styles.ruleDotActive]} />
                    <Text style={[styles.ruleText, passHasSpecial && styles.ruleTextDone]}>
                      Phải có ít nhất 1 ký tự đặc biệt (@#$*&...)
                    </Text>
                  </View>
                  <View style={styles.ruleRow}>
                    <View style={[styles.ruleDot, passHasMinLen && styles.ruleDotActive]} />
                    <Text style={[styles.ruleText, passHasMinLen && styles.ruleTextDone]}>
                      Phải có ít nhất 6 ký tự
                    </Text>
                  </View>
                  <View style={styles.ruleRow}>
                    <View style={[styles.ruleDot, passHasNumber && styles.ruleDotActive]} />
                    <Text style={[styles.ruleText, passHasNumber && styles.ruleTextDone]}>
                      Phải có ít nhất 1 chữ số (0-9)
                    </Text>
                  </View>
                </View>
              ) : null}
              {passwordTouched && !!password && !isValidPassword(password) ? (
                <Text style={styles.ruleWarnText}>{passwordRuleMessage(password)}</Text>
              ) : null}

              <View style={styles.passwordContainer}>
                <TextInput
                  ref={confirmRef}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#999"
                  secureTextEntry={secure2}
                  style={styles.passwordInput}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setSecure2(!secure2)}>
                  <Ionicons
                    name={secure2 ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSignup}
                disabled={loading}
              >
                <Text style={styles.primaryText}>
                  {loading ? "Đang đăng ký..." : "Đăng ký"}
                </Text>
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <Text style={styles.linkText}>Bạn đã có tài khoản chưa?</Text>
                <TouchableOpacity onPress={() => router.replace("/(auths)/login")}>
                  <Text style={styles.linkHighlight}> Đăng nhập</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

{/* Css style */}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F4F4",
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 40,
  },
  logo: {
    width: 300,
    height: 200,
    alignSelf: "center",
    marginBottom: 25,
  },
  input: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 15,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 14,
    fontSize: 14,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 15,
    marginBottom: 14,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: "#4B2E83",
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: "center",
    marginTop: 10,
  },
  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 20,
  },
  linkText: {
    color: "#8E8E93",
    fontSize: 14,
  },
  linkHighlight: {
    color: "#4B2E83",
    fontWeight: "600",
    fontSize: 14,
  },
  errorText: {
    color: "red",
    marginTop: 8,
    marginBottom: 8,
    fontSize: 13,
    textAlign: "center",
  },
  passwordRulesWrap: {
    marginTop: -6,
    marginBottom: 10,
    gap: 4,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ruleDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: "#9CA3AF",
  },
  ruleDotActive: {
    backgroundColor: "#16A34A",
  },
  ruleText: {
    color: "#6B7280",
    fontSize: 12,
  },
  ruleTextDone: {
    color: "#166534",
    fontWeight: "600",
  },
  ruleWarnText: {
    color: "#B45309",
    marginTop: -2,
    marginBottom: 10,
    fontSize: 12,
  },
});
