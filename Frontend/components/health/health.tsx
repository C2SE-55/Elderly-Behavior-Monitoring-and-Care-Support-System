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
import { api, getCurrentUser } from "../../services/api";
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

// INPUT ĐƠN: 1 label + 1 TextInput (controlled)
type HealthInputProps = {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  keyboardType?: "default" | "numeric";
  onChangeText: (text: string) => void;
};

const HealthInput = ({
  label,
  value,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType = "default",
  onChangeText,
}: HealthInputProps) => {
  return (
    <View style={inputStyles.wrapper}>
      <Text style={inputStyles.label}>{label}</Text>
      <TextInput
        style={[inputStyles.input, multiline && inputStyles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#999"
        multiline={multiline}
        numberOfLines={multiline ? numberOfLines ?? 3 : 1}
        textAlignVertical={multiline ? "top" : "center"}
        keyboardType={keyboardType}
      />
    </View>
  );
};

// INPUT HAI CỘT: ví dụ chiều cao / cân nặng
type HealthTwoColumnProps = {
  label1: string;
  value1: string;
  unit1?: string;
  label2: string;
  value2: string;
  unit2?: string;
  onChangeValue1: (text: string) => void;
  onChangeValue2: (text: string) => void;
};

const HealthTwoColumn = ({
  label1,
  value1,
  unit1,
  label2,
  value2,
  unit2,
  onChangeValue1,
  onChangeValue2,
}: HealthTwoColumnProps) => {
  return (
    <View style={twoColStyles.row}>
      {/* Cột trái */}
      <View style={twoColStyles.col}>
        <Text style={twoColStyles.label}>{label1}</Text>
        <View style={twoColStyles.unitWrapper}>
          <TextInput
            style={twoColStyles.input}
            value={value1}
            onChangeText={onChangeValue1}
            keyboardType="numeric"
          />
          {unit1 && <Text style={twoColStyles.unit}>{unit1}</Text>}
        </View>
      </View>

      {/* Cột phải */}
      <View style={twoColStyles.col}>
        <Text style={twoColStyles.label}>{label2}</Text>
        <View style={twoColStyles.unitWrapper}>
          <TextInput
            style={twoColStyles.input}
            value={value2}
            onChangeText={onChangeValue2}
            keyboardType="numeric"
          />
          {unit2 && <Text style={twoColStyles.unit}>{unit2}</Text>}
        </View>
      </View>
    </View>
  );
};

// NÚT CẬP NHẬT
type HealthButtonProps = {
  onPress: () => void;
  disabled?: boolean;
};

const HealthButton = ({ onPress, disabled }: HealthButtonProps) => (
  <TouchableOpacity
    style={[buttonStyles.button, disabled && { opacity: 0.7 }]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={buttonStyles.text}>Cập Nhật</Text>
  </TouchableOpacity>
);

// MÀN HÌNH CHÍNH: gộp tất cả lại
export default function HealthScreen() {
  const scrollRef = useRef<ScrollView | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [chronicDisease, setChronicDisease] = useState("");
  const [allergy, setAllergy] = useState("");
  const [bloodType, setBloodType] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const user = getCurrentUser();

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

  const BLOOD_TYPES = [
    "A+",
    "A-",
    "B+",
    "B-",
    "AB+",
    "AB-",
    "O+",
    "O-",
    "Rh-null",
  ];

  const handleSubmit = async () => {
    // Reset thông báo
    setError("");
    setSuccess("");

    // Validate tuổi
    const ageNum = Number(age);
    if (Number.isNaN(ageNum) || ageNum <= 10 || ageNum >= 150) {
      setError("Tuổi phải lớn hơn 10 và nhỏ hơn 150.");
      return;
    }

    // Validate huyết áp
    const bpNum = Number(bloodPressure);
    if (Number.isNaN(bpNum) || bpNum < 50 || bpNum > 250) {
      setError("Huyết áp phải từ 50 đến 250 mmHg.");
      return;
    }

    // Validate nhóm máu
    if (!bloodType || !BLOOD_TYPES.includes(bloodType)) {
      setError("Vui lòng chọn nhóm máu hợp lệ.");
      return;
    }

    // Cần có user/profile để gửi API
    const profileId = user?.id;
    if (!profileId) {
      setError("Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      return;
    }

    try {
      setSubmitting(true);

      // Gửi chỉ số huyết áp lên API health-metrics
      await api.post("/health-metrics", {
        profileId,
        metricType: "blood_pressure",
        valueNumeric: bpNum,
        unit: "mmHg",
        status: "normal",
        notes: `Tuổi: ${ageNum}, Nhóm máu: ${bloodType}, Chiều cao: ${height} cm, Cân nặng: ${weight} kg, Bệnh nền: ${chronicDisease}, Dị ứng: ${allergy}`,
      });

      setSuccess("Lưu chỉ số sức khỏe thành công.");
    } catch (err: any) {
      const backendMessage = err?.response?.data?.message;
      setError(
        backendMessage ||
          "Không thể lưu chỉ số sức khỏe. Vui lòng kiểm tra kết nối và thử lại."
      );
    } finally {
      setSubmitting(false);
    }
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
          <HealthInput
            placeholder="Nhập họ và tên"
            label="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
          />
          <HealthInput
            placeholder="Nhập tuổi của bạn"
            label="Tuổi"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
          />

          <HealthTwoColumn
            label1="Chiều cao"
            value1={height}
            unit1="cm"
            label2="Cân nặng"
            value2={weight}
            unit2="kg"
            onChangeValue1={setHeight}
            onChangeValue2={setWeight}
          />

          {/* Nhóm máu (select) + huyết áp */}
          <View style={bloodStyles.wrapper}>
            <Text style={bloodStyles.label}>Nhóm máu</Text>
            <View style={bloodStyles.chipRow}>
              {BLOOD_TYPES.map((type) => {
                const selected = bloodType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      bloodStyles.chip,
                      selected && bloodStyles.chipSelected,
                    ]}
                    onPress={() => setBloodType(type)}
                  >
                    <Text
                      style={[
                        bloodStyles.chipText,
                        selected && bloodStyles.chipTextSelected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <HealthInput
            label="Huyết áp (tâm thu)"
            placeholder="Nhập huyết áp (mmHg)"
            value={bloodPressure}
            onChangeText={setBloodPressure}
            keyboardType="numeric"
          />

          <HealthInput
            label="Bệnh nền"
            placeholder="Nhập bệnh nền"
            multiline
            value={chronicDisease}
            onChangeText={setChronicDisease}
          />
          <HealthInput
            label="Dị ứng"
            placeholder="Nhập dị ứng"
            multiline
            value={allergy}
            onChangeText={setAllergy}
          />

          {/* Thông báo lỗi / thành công */}
          {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}
          {success ? (
            <Text style={screenStyles.successText}>{success}</Text>
          ) : null}

          {/* Nút lưu / cập nhật */}
          <HealthButton onPress={handleSubmit} disabled={submitting} />
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
  errorText: {
    marginTop: 16,
    color: "red",
    fontSize: 13,
    textAlign: "center",
  },
  successText: {
    marginTop: 8,
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

const bloodStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: "#333",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
  },
  chipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontSize: 12,
    color: "#111827",
  },
  chipTextSelected: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});

