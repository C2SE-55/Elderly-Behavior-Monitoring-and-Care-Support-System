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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.30)",
};
const PRIMARY = COLORS.primary;

// HEADER: Thanh tiêu đề trên cùng
const HealthHeader = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[headerStyles.container, { paddingTop: Math.max(10, insets.top) }]}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={headerStyles.backBtn}>
        <Ionicons name="arrow-back" size={20} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={headerStyles.title} numberOfLines={1}>
        Quản lý sức khỏe
      </Text>
      <View style={{ width: 36 }} />
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
    <View style={avatarStyles.wrap}>
      <View style={avatarStyles.avatarOuter}>
        <Image source={imageSource} style={avatarStyles.avatar} />
      </View>
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
      <View style={[inputStyles.inputShell, !editable && inputStyles.inputShellDisabled]}>
        <TextInput
          style={[inputStyles.input, multiline && inputStyles.multiline, !editable && inputStyles.inputDisabled]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          multiline={multiline}
          numberOfLines={multiline ? numberOfLines ?? 3 : 1}
          textAlignVertical={multiline ? "top" : "center"}
          keyboardType={keyboardType}
          editable={editable}
        />
        {!editable && <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" />}
      </View>
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
        <View style={[twoColStyles.unitWrapper, !editable && twoColStyles.unitWrapperDisabled]}>
          <TextInput
            style={twoColStyles.input}
            value={value1}
            onChangeText={onChangeValue1}
            keyboardType="numeric"
            editable={editable}
            placeholder="0"
            placeholderTextColor="#94A3B8"
          />
          {unit1 && <Text style={twoColStyles.unit}>{unit1}</Text>}
          {!editable && <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" />}
        </View>
      </View>

      {/* Cột phải */}
      <View style={twoColStyles.col}>
        <Text style={twoColStyles.label}>{label2}</Text>
        <View style={[twoColStyles.unitWrapper, !editable && twoColStyles.unitWrapperDisabled]}>
          <TextInput
            style={twoColStyles.input}
            value={value2}
            onChangeText={onChangeValue2}
            keyboardType="numeric"
            editable={editable}
            placeholder="0"
            placeholderTextColor="#94A3B8"
          />
          {unit2 && <Text style={twoColStyles.unit}>{unit2}</Text>}
          {!editable && <Ionicons name="lock-closed-outline" size={16} color="#94A3B8" />}
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
    <SafeAreaView style={screenStyles.safe} edges={["bottom"]}>
      <HealthHeader />

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
          {/* Ảnh đại diện + nút đổi hình (lưu DB, dùng cho quét khuôn mặt nhận diện) */}
          <View style={screenStyles.sectionCard}>
            <Text style={screenStyles.sectionTitle}>Hồ sơ</Text>
            <HealthAvatar
              faceImageUrl={faceImageUrl}
              onUpload={handleChangeAvatar}
              loading={loadingAvatar}
              disabled={!canManageHealth}
            />
            <Text style={screenStyles.sectionHint}>
              Ảnh khuôn mặt sẽ dùng cho tính năng nhận diện khi quét.
            </Text>
          </View>

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

          <View style={screenStyles.sectionCard}>
            <Text style={screenStyles.sectionTitle}>Chỉ số cơ bản</Text>
            <HealthInput
              placeholder="Nhập họ và tên"
              label="Họ và tên"
              value={fullName}
              onChangeText={setFullName}
              editable={canManageHealth}
            />
            <HealthInput
              placeholder="Nhập tuổi"
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
          </View>

          <View style={screenStyles.sectionCard}>
            <Text style={screenStyles.sectionTitle}>Tim mạch & nhóm máu</Text>
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
                      activeOpacity={0.9}
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
              placeholder="mmHg (vd: 120)"
              value={bloodPressure}
              onChangeText={setBloodPressure}
              keyboardType="numeric"
              editable={canManageHealth}
            />
          </View>

          <View style={screenStyles.sectionCard}>
            <Text style={screenStyles.sectionTitle}>Tiền sử</Text>
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
          </View>

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
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
            <Text style={screenStyles.scrollDownText}>Cuộn xuống</Text>
          </TouchableOpacity>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// STYLES CHO TỪNG PHẦN
const screenStyles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  flex: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 28,
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
    fontWeight: "900",
  },
  errorText: {
    marginTop: 10,
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "800",
  },
  successText: {
    marginTop: 10,
    color: "#047857",
    fontSize: 13,
    textAlign: "center",
    fontWeight: "800",
  },
  warnText: {
    marginBottom: 10,
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.35)",
    fontWeight: "800",
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
    fontWeight: "900",
  },
  infoText: {
    marginBottom: 8,
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 14,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  sectionHint: { marginTop: 10, fontSize: 12, fontWeight: "700", color: COLORS.sub, lineHeight: 18, textAlign: "center" },
});

const headerStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    flex: 1,
    textAlign: "center",
  },
});

const avatarStyles = StyleSheet.create({
  wrap: { alignItems: "center", marginTop: 10, marginBottom: 6 },
  avatarOuter: {
    width: 112,
    height: 112,
    borderRadius: 56,
    padding: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 56 },
  change: {
    marginTop: 8,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
  },
});

const inputStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: COLORS.text,
    fontWeight: "900",
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputShellDisabled: { backgroundColor: "#F8FAFC" },
  input: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "700", paddingVertical: 0 },
  inputDisabled: { color: "#64748B" },
  multiline: {
    minHeight: 92,
    paddingTop: 0,
  },
});

const twoColStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  col: {
    width: "48%",
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: COLORS.text,
    fontWeight: "900",
  },
  unitWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  unitWrapperDisabled: { backgroundColor: "#F8FAFC" },
  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "800",
    paddingVertical: 0,
  },
  unit: {
    fontSize: 12,
    color: COLORS.sub,
    fontWeight: "800",
  },
});

const buttonStyles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.primary,
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

const bloodStyles = StyleSheet.create({
  wrapper: {
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    marginBottom: 6,
    color: COLORS.text,
    fontWeight: "900",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.90)",
  },
  chipSelected: {
    backgroundColor: "rgba(167,139,250,0.24)",
    borderColor: "rgba(167,139,250,0.65)",
  },
  chipDisabled: {
    opacity: 0.65,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: "800",
  },
  chipTextSelected: {
    color: COLORS.primary,
    fontWeight: "900",
  },
});

