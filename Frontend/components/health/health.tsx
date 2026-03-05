import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
const PRIMARY = "#4B2E83";

// HEADER: Thanh tiêu đề trên cùng
const HealthHeader = () => {
  const router = useRouter();

  return (
    <View style={headerStyles.container}>
      {/* Nút back về màn trước */}
      <TouchableOpacity onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={22} color="white" />
      </TouchableOpacity>

      {/* Tiêu đề */}
      <Text style={headerStyles.title}>Chỉ số sức khỏe</Text>

      {/* View rỗng để canh đều 2 bên icon */}
      <View style={{ width: 22 }} />
    </View>
  );
};

// AVATAR: Ảnh đại diện + nút đổi hình
const HealthAvatar = () => {
  return (
    <View style={avatarStyles.container}>
      <Image
        // Ảnh avatar mẫu, bạn có thể thay file khác trong assets
        source={require("../../assets/images/avatar.png")}
        style={avatarStyles.avatar}
      />
      <TouchableOpacity>
        <Text style={avatarStyles.change}>Đổi hình đại diện</Text>
      </TouchableOpacity>
    </View>
  );
};

// INPUT ĐƠN: 1 label + 1 TextInput
type HealthInputProps = {
  label: string;
  value?: string;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
};

const HealthInput = ({
  label,
  value,
  placeholder,
  multiline,
  numberOfLines,
}: HealthInputProps) => {
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={[inputStyles.input, multiline && inputStyles.multiline]}
        defaultValue={value}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines ?? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
      />
    </View>
  );
};

// INPUT HAI CỘT: ví dụ chiều cao / cân nặng
type HealthTwoColumnProps = {
  label1: string;
  value1?: string;
  unit1?: string;
  label2: string;
  value2?: string;
  unit2?: string;
};

const HealthTwoColumn = ({
  label1,
  value1,
  unit1,
  label2,
  value2,
  unit2,
}: HealthTwoColumnProps) => {
  return (
    <View style={twoColStyles.row}>
      {/* Cột trái */}
      <View style={twoColStyles.col}>
        <Text style={twoColStyles.label}>{label1}</Text>
        <View style={twoColStyles.unitWrapper}>
          <TextInput style={twoColStyles.input} defaultValue={value1} />
          {unit1 && <Text style={twoColStyles.unit}>{unit1}</Text>}
        </View>
      </View>

      {/* Cột phải */}
      <View style={twoColStyles.col}>
        <Text style={twoColStyles.label}>{label2}</Text>
        <View style={twoColStyles.unitWrapper}>
          <TextInput style={twoColStyles.input} defaultValue={value2} />
          {unit2 && <Text style={twoColStyles.unit}>{unit2}</Text>}
        </View>
      </View>
    </View>
  );
};

// NÚT CẬP NHẬT
const HealthButton = () => {
  return (
    <TouchableOpacity style={buttonStyles.button}>
      <Text style={buttonStyles.text}>Cập Nhật</Text>
    </TouchableOpacity>
  );
};

// MÀN HÌNH CHÍNH: gộp tất cả lại
export default function HealthScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Bàn phím cuộn xuống khi nhập vào input
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
      <HealthHeader />

      <KeyboardAvoidingView
        style={screenStyles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={screenStyles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ảnh đại diện + nút đổi hình */}
          <HealthAvatar />

          {/* Các trường thông tin sức khỏe */}
          <HealthInput placeholder="Nhập họ và tên" label="Full Name" value=""  />
          <HealthInput placeholder="Nhập tuổi của bạn" label="Tuổi" value="" />

          <HealthTwoColumn
            label1="Chiều cao"
            value1=""
            unit1="cm"
            label2="Cân nặng"
            value2=""
            unit2="kg"
          />

          <HealthTwoColumn
            label1="Nhóm máu"
            value1=""
            label2="Huyết áp"
            value2=""
            unit2="mmHg"
          />

          <HealthInput
            label="Bệnh nền"
            placeholder="Nhập bệnh nền"
            multiline
          />
          <HealthInput
            label="Dị ứng"
            placeholder="Nhập dị ứng"
            multiline
          />

          {/* Nút lưu / cập nhật */}
          <HealthButton />
        </ScrollView>

        {/* Khi bàn phím mở, hiện nút để cuộn xuống cuối form */}
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

// STYLES CHO TỪNG PHẦN
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
    // Để avatar nằm hoàn toàn dưới header, không bị che
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
  multiline: {
    height: 100,
    paddingTop: 10,
  },
});

const twoColStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 15,
  },
  col: {
    width: "48%",
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
  },
  unitWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEEEEE",
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  input: {
    flex: 1,
    height: 45,
  },
  unit: {
    fontSize: 12,
    color: "#777",
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

