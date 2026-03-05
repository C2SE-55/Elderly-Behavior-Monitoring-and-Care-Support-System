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
const PRIMARY = "#4B2E83";

// HEADER: giống trang Chỉ số sức khỏe
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
};

const ProfileInput = ({
  label,
  value,
  placeholder,
  secure,
}: ProfileInputProps) => {
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={inputStyles.input}
        defaultValue={value}
        placeholder={placeholder}
        placeholderTextColor="#999"
        secureTextEntry={secure}
      />
    </View>
  );
};

// Vai trò (read-only box)
const ProfileRoleBox = () => (
  <View style={inputStyles.wrapper}>
    <Text style={inputStyles.label}>Vai trò</Text>
    <View style={roleBoxStyles.box}>
      <Text style={roleBoxStyles.text}>Người chăm sóc</Text>
    </View>
  </View>
);

// Nút cập nhật
const ProfileButton = () => (
  <TouchableOpacity style={buttonStyles.button}>
    <Text style={buttonStyles.text}>Cập Nhật</Text>
  </TouchableOpacity>
);

export default function ProfileScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

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

  const handleScrollToEnd = () => {
    scrollRef.current?.scrollToEnd({ animated: true });
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
            value=""
          />
          <ProfileInput
            label="Tên đăng nhập"
            placeholder="Nhập username"
            value=""
          />
          <ProfileInput label="Email" placeholder="Nhập email" value="" />
          <ProfileInput
            label="Số điện thoại"
            placeholder="Nhập số điện thoại"
            value=""
          />
          <ProfileInput
            label="Mật khẩu"
            placeholder="Nhập mật khẩu"
            secure
          />
          <ProfileInput
            label="Xác thực mật khẩu"
            placeholder="Nhập lại mật khẩu"
            secure
          />
          <ProfileRoleBox />
          <ProfileButton />
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
});

const roleBoxStyles = StyleSheet.create({
  box: {
    backgroundColor: "#EEEEEE",
    height: 45,
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  text: {
    fontSize: 14,
    color: "#333",
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
