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
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  api,
  getCurrentUser,
  API_BASE_URL,
  getAuthHeaders,
  getMyRoom,
  subscribeActiveRoomChange,
  type MyRoomInfo,
} from "../../services/api";
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
      <Text style={headerStyles.title}>Quản lý thông tin sức khỏe</Text>

      {/* View rỗng để canh đều 2 bên icon */}
      <View style={{ width: 22 }} />
    </View>
  );
};

// AVATAR: Ảnh đại diện + nút đổi hình (lưu DB để quét khuôn mặt nhận diện người cần giám sát)
type HealthAvatarProps = {
  faceImageUrl: string | null;
  onUpload: () => void;
  loading?: boolean;
  disabled?: boolean;
};
const HealthAvatar = ({ faceImageUrl, onUpload, loading, disabled }: HealthAvatarProps) => {
  const imageSource = faceImageUrl
    ? { uri: faceImageUrl }
    : require("../../assets/images/avatar.png");
  return (
    <View style={avatarStyles.container}>
      <Image source={imageSource} style={avatarStyles.avatar} />
      <TouchableOpacity onPress={onUpload} disabled={loading || disabled}>
        {loading ? (
          <ActivityIndicator size="small" color={PRIMARY} style={{ marginTop: 8 }} />
        ) : (
          <Text style={avatarStyles.change}>Đổi hình đại diện</Text>
        )}
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
  editable?: boolean;
};

const HealthInput = ({
  label,
  value,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType = "default",
  onChangeText,
  editable = true,
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
        editable={editable}
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
  editable?: boolean;
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
  editable = true,
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
            editable={editable}
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
            editable={editable}
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
  label?: string;
};

const HealthButton = ({ onPress, disabled, label = "Cập Nhật" }: HealthButtonProps) => (
  <TouchableOpacity
    style={[buttonStyles.button, disabled && { opacity: 0.7 }]}
    onPress={onPress}
    disabled={disabled}
  >
    <Text style={buttonStyles.text}>{label}</Text>
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
  const [faceImageUrl, setFaceImageUrl] = useState<string | null>(null);
  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState<MyRoomInfo | null>(null);
  const [targetProfileId, setTargetProfileId] = useState<number | null>(null);
  const [canReadHealth, setCanReadHealth] = useState(false);
  const [canManageHealth, setCanManageHealth] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");

  const user = getCurrentUser();

  const loadPermissions = async () => {
    try {
      setPermissionLoading(true);
      const room = await getMyRoom();
      setRoomInfo(room);
      if (!room) {
        setCanReadHealth(false);
        setCanManageHealth(false);
        setTargetProfileId(null);
        setPermissionMessage("Bạn chưa tham gia room. Không thể truy cập hồ sơ sức khỏe.");
        return;
      }

      const isHost = room.member_role === "host";
      const hostProfileId = Number(room.host_user_id || (isHost ? user?.id : 0)) || null;
      if (!hostProfileId) {
        setCanReadHealth(false);
        setCanManageHealth(false);
        setTargetProfileId(null);
        setPermissionMessage("Không xác định được hồ sơ sức khỏe của room hiện tại.");
        return;
      }

      setTargetProfileId(hostProfileId);
      setCanReadHealth(true);
      setCanManageHealth(isHost);
      setPermissionMessage(isHost ? "" : "Chỉ xem");
    } catch {
      setCanReadHealth(false);
      setCanManageHealth(false);
      setTargetProfileId(null);
      setPermissionMessage("Không tải được quyền truy cập room.");
    } finally {
      setPermissionLoading(false);
    }
  };

  // Load chỉ số sức khỏe đã lưu khi mở màn hình (hiển thị các trường cũ để chỉnh sửa)
  const loadHealthProfile = async () => {
    if (!targetProfileId || !canReadHealth) return;
    try {
      const response = await api.get(`/health-metrics/profile/${targetProfileId}`);
      const payload = response.data?.data;
      const rows = Array.isArray(payload?.data) ? payload.data : [];
      const profile = rows[0];
      if (!profile) return;

      setFullName(profile.elderly_name ?? "");
      setAge(profile.age != null ? String(profile.age) : "");
      setHeight(profile.height != null ? String(profile.height) : "");
      setWeight(profile.weight != null ? String(profile.weight) : "");
      setBloodPressure(
        profile.blood_pressure != null ? String(profile.blood_pressure) : ""
      );
      setBloodType(profile.blood_type ?? null);
      setChronicDisease(profile.chronic_diseases ?? "");
      setAllergy(profile.allergies ?? "");
      // Ảnh đại diện (khuôn mặt) — dùng cho nhận diện khi quét
      const url = profile.face_image_url;
      setFaceImageUrl(url ? `${API_BASE_URL}${url.startsWith("/") ? url : "/" + url}` : null);
    } catch (err) {
      console.warn("Không thể tải chỉ số sức khỏe:", err);
    }
  };

  const handleChangeAvatar = async () => {
    if (!targetProfileId || !canManageHealth) {
      setError("Chỉ HOST mới có quyền cập nhật ảnh đại diện.");
      return;
    }
    try {
      const permMethod = ImagePicker.requestMediaLibraryPermissionsAsync;
      if (permMethod) {
        const { status } = await permMethod();
        if (status !== "granted") {
          Alert.alert("Quyền truy cập", "Cần quyền truy cập ảnh để chọn hình đại diện.");
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setLoadingAvatar(true);
      setError("");
      const uri = result.assets[0].uri;
      const name = "face.jpg";
      const type = "image/jpeg";
      const formData = new FormData();

      if (Platform.OS === "web" || uri.startsWith("blob:")) {
        const res = await fetch(uri);
        const blob = await res.blob();
        const file = new File([blob], name, { type: "image/jpeg" });
        formData.append("image", file);
      } else {
        formData.append("image", { uri, name, type } as any);
      }

      const uploadUrl = `${API_BASE_URL}/api/health-metrics/profile/${targetProfileId}/face-image`;
      const headers: Record<string, string> = getAuthHeaders();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers,
        body: formData,
      });
      const json = await response.json();
      if (!response.ok) {
        throw Object.assign(new Error(json?.message || "Lỗi tải ảnh"), {
          response: { data: json, status: response.status },
        });
      }
      const data = json?.data;
      const path = data?.face_image_url;
      if (path) {
        const fullUrl = `${API_BASE_URL}${path.startsWith("/") ? path : "/" + path}`;
        setFaceImageUrl(`${fullUrl}?t=${Date.now()}`);
        setSuccess("Đã lưu ảnh đại diện. Ảnh sẽ được dùng để nhận diện khi quét khuôn mặt.");
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Không thể tải ảnh lên. Kiểm tra đăng nhập và thử lại.";
      setError(msg);
    } finally {
      setLoadingAvatar(false);
    }
  };

  useEffect(() => {
    loadPermissions();
    const unsubscribe = subscribeActiveRoomChange(() => {
      void loadPermissions();
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    void loadHealthProfile();
  }, [targetProfileId, canReadHealth]);

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
    const profileId = targetProfileId;
    if (!profileId) {
      setError("Không tìm thấy thông tin tài khoản. Vui lòng đăng nhập lại.");
      return;
    }
    if (!canManageHealth) {
      setError("Bạn chỉ có quyền xem thông tin sức khỏe.");
      return;
    }

    try {
      setSubmitting(true);

      const requests: Promise<unknown>[] = [];

      // Họ và tên
      if (fullName.trim()) {
        requests.push(
          api.post("/health-metrics", {
            profileId,
            metricType: "elderly_name",
            valueText: fullName.trim(),
          })
        );
      }

      // Tuổi
      requests.push(
        api.post("/health-metrics", {
          profileId,
          metricType: "age",
          age: ageNum,
        })
      );

      // Nhóm máu
      requests.push(
        api.post("/health-metrics", {
          profileId,
          metricType: "blood_type",
          bloodType,
        })
      );

      // Chiều cao
      if (height) {
        const h = Number(height);
        if (!Number.isNaN(h)) {
          requests.push(
            api.post("/health-metrics", {
              profileId,
              metricType: "height",
              valueNumeric: h,
            })
          );
        }
      }

      // Cân nặng
      if (weight) {
        const w = Number(weight);
        if (!Number.isNaN(w)) {
          requests.push(
            api.post("/health-metrics", {
              profileId,
              metricType: "weight",
              valueNumeric: w,
            })
          );
        }
      }

      // Huyết áp
      requests.push(
        api.post("/health-metrics", {
          profileId,
          metricType: "blood_pressure",
          valueNumeric: bpNum,
        })
      );

      // Bệnh nền
      requests.push(
        api.post("/health-metrics", {
          profileId,
          metricType: "chronic_diseases",
          valueText: chronicDisease || "",
          chronicDiseases: chronicDisease || "",
        })
      );

      // Dị ứng
      requests.push(
        api.post("/health-metrics", {
          profileId,
          metricType: "allergies",
          valueText: allergy || "",
          allergies: allergy || "",
        })
      );

      await Promise.all(requests);

      // Load lại form từ DB để khớp dữ liệu
      await loadHealthProfile();

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
          {/* Ảnh đại diện + nút đổi hình (lưu DB, dùng cho quét khuôn mặt nhận diện) */}
          <HealthAvatar
            faceImageUrl={faceImageUrl}
            onUpload={handleChangeAvatar}
            loading={loadingAvatar}
            disabled={!canManageHealth}
          />

          {!!permissionMessage && (
            <Text style={permissionMessage === "Chỉ xem" ? screenStyles.readonlyBadge : screenStyles.warnText}>
              {permissionMessage}
            </Text>
          )}
          {permissionLoading ? (
            <Text style={screenStyles.infoText}>Đang kiểm tra quyền trong room...</Text>
          ) : null}
          {!!roomInfo?.room_id && (
            <Text style={screenStyles.infoText}>Room: {roomInfo.room_id}</Text>
          )}

          {/* Các trường thông tin sức khỏe */}
          <HealthInput
            placeholder="Nhập họ và tên"
            label="Họ và tên"
            value={fullName}
            onChangeText={setFullName}
            editable={canManageHealth}
          />
          <HealthInput
            placeholder="Nhập tuổi của bạn"
            label="Tuổi"
            value={age}
            onChangeText={setAge}
            keyboardType="numeric"
            editable={canManageHealth}
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
            editable={canManageHealth}
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
                      !canManageHealth && bloodStyles.chipDisabled,
                    ]}
                    onPress={() => setBloodType(type)}
                    disabled={!canManageHealth}
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
            editable={canManageHealth}
          />

          <HealthInput
            label="Bệnh nền"
            placeholder="Nhập bệnh nền"
            multiline
            value={chronicDisease}
            onChangeText={setChronicDisease}
            editable={canManageHealth}
          />
          <HealthInput
            label="Dị ứng"
            placeholder="Nhập dị ứng"
            multiline
            value={allergy}
            onChangeText={setAllergy}
            editable={canManageHealth}
          />

          {/* Thông báo lỗi / thành công */}
          {error ? <Text style={screenStyles.errorText}>{error}</Text> : null}
          {success ? (
            <Text style={screenStyles.successText}>{success}</Text>
          ) : null}

          {/* Nút lưu / cập nhật */}
          <HealthButton
            onPress={handleSubmit}
            disabled={submitting || !canManageHealth}
            label={canManageHealth ? "Cập Nhật" : "Chỉ xem"}
          />
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
  warnText: {
    marginBottom: 10,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  readonlyBadge: {
    alignSelf: "flex-start",
    marginBottom: 10,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  infoText: {
    marginBottom: 8,
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
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
  chipDisabled: {
    opacity: 0.65,
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

