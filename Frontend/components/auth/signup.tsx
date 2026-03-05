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
              />
              <TextInput
                ref={usernameRef}
                placeholder="Username"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
              <TextInput
                ref={emailRef}
                placeholder="Email"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                keyboardType="email-address"
                onSubmitEditing={() => dateRef.current?.focus()}
              />
              <TextInput
                ref={dateRef}
                placeholder="dd/mm/yyyy"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              <TextInput
                ref={phoneRef}
                placeholder="Số điện thoại"
                placeholderTextColor="#999"
                style={styles.input}
                returnKeyType="next"
                keyboardType="phone-pad"
                onSubmitEditing={() => passRef.current?.focus()}
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
                />
                <TouchableOpacity onPress={() => setSecure1(!secure1)}>
                  <Ionicons
                    name={secure1 ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.passwordContainer}>
                <TextInput
                  ref={confirmRef}
                  placeholder="Xác nhận mật khẩu"
                  placeholderTextColor="#999"
                  secureTextEntry={secure2}
                  style={styles.passwordInput}
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <TouchableOpacity onPress={() => setSecure2(!secure2)}>
                  <Ionicons
                    name={secure2 ? "eye-off-outline" : "eye-outline"}
                    size={22}
                    color="#8E8E93"
                  />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => router.push("/(auths)/login")}
              >
                <Text style={styles.primaryText}>Đăng ký</Text>
              </TouchableOpacity>

              <View style={styles.linkRow}>
                <Text style={styles.linkText}>Bạn đã có tài khoản chưa?</Text>
                <TouchableOpacity onPress={() => router.push("/(auths)/login")}>
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
});
