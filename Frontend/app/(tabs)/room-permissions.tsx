import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import {
  getMyRoom,
  getRoomMembers,
  kickCaretaker,
  MyRoomInfo,
  RoomMember,
  updateCaretakerPermissions,
} from "@/services/api";

const TOGGLE_TRACK_W = 52;
const TOGGLE_TRACK_H = 30;
const TOGGLE_THUMB = 26;
const TOGGLE_PAD = 2;
const TOGGLE_TRAVEL = TOGGLE_TRACK_W - TOGGLE_THUMB - TOGGLE_PAD * 2;

const getHostQrImageUrl = (payload: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;

/** Toggle tự vẽ: tránh ScrollView “cướp” cử chỉ ngang của Switch RN; chạm = trượt có spring. */
function PermissionToggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: value ? 1 : 0,
      friction: 9,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const thumbX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [TOGGLE_PAD, TOGGLE_PAD + TOGGLE_TRAVEL],
  });

  return (
    <Pressable
      disabled={disabled}
      onPress={() => !disabled && onValueChange(!value)}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
    >
      <View
        style={[
          styles.permissionToggleTrack,
          {
            width: TOGGLE_TRACK_W,
            height: TOGGLE_TRACK_H,
            backgroundColor: value ? "#93C5FD" : "#E5E7EB",
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.permissionToggleThumb,
            {
              width: TOGGLE_THUMB,
              height: TOGGLE_THUMB,
              top: (TOGGLE_TRACK_H - TOGGLE_THUMB) / 2,
              transform: [{ translateX: thumbX }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

export default function RoomPermissionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [room, setRoom] = useState<MyRoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const togglePendingRef = useRef<Set<number>>(new Set());
  const pollingRef = useRef(false);

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent) {
        setLoading(true);
        setError("");
      }
      const roomData = await getMyRoom();
      setRoom(roomData);
      if (roomData?.member_role === "host") {
        const memberRows = await getRoomMembers();
        setMembers(memberRows);
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      if (!silent) {
        setError(e?.response?.data?.message || "Không tải được danh sách thành viên.");
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAll({ silent: true });
    setRefreshing(false);
  }, [loadAll]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime-like refresh: tự động đồng bộ số thành viên/quyền mỗi 5s (không cần reload trang).
  useEffect(() => {
    const t = setInterval(() => {
      if (pollingRef.current) return;
      pollingRef.current = true;
      void loadAll({ silent: true }).finally(() => {
        pollingRef.current = false;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [loadAll]);

  const onToggle = async (
    member: RoomMember,
    field:
      | "can_receive_schedule_notifications"
      | "can_receive_medication_notifications"
      | "can_view_live",
    nextValue: boolean
  ) => {
    if (togglePendingRef.current.has(member.user_id)) return;
    const prevValue = member[field];
    if (nextValue === prevValue) return;

    togglePendingRef.current.add(member.user_id);
    setMembers((prev) =>
      prev.map((m) => (m.user_id === member.user_id ? { ...m, [field]: nextValue } : m))
    );
    setError("");
    setSuccess("");

    try {
      setUpdatingId(member.user_id);
      await updateCaretakerPermissions(member.user_id, { [field]: nextValue });
      setSuccess("Cập nhật quyền thành công.");
      await loadAll({ silent: true });
    } catch (e: any) {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === member.user_id ? { ...m, [field]: prevValue } : m))
      );
      setError(e?.response?.data?.message || "Không thể cập nhật quyền.");
    } finally {
      togglePendingRef.current.delete(member.user_id);
      setUpdatingId(null);
    }
  };

  const hostQrPayload =
    room?.member_role === "host" && String(room?.host_join_token || "").trim()
      ? `HOST_JOIN:${String(room.host_join_token).trim()}`
      : "";

  const copyQrPayload = async () => {
    const txt = hostQrPayload;
    if (!txt) return;
    try {
      await Clipboard.setStringAsync(txt);
      if (Platform.OS === "web") {
        alert("Đã copy nội dung mã QR.");
      } else {
        Alert.alert("Đã copy", "Người chăm sóc có thể dán vào app hoặc dùng mã quét trong app.");
      }
    } catch {
      if (Platform.OS === "web") {
        alert("Không thể copy.");
      } else {
        Alert.alert("Lỗi", "Không thể copy.");
      }
    }
  };

  const onKick = (userId: number) => {
    Alert.alert("Kick thành viên", "Bạn có chắc muốn kick caregiver này khỏi room?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Kick",
        style: "destructive",
        onPress: async () => {
          try {
            setUpdatingId(userId);
            setError("");
            setSuccess("");
            await kickCaretaker(userId);
            setSuccess("Kick thành viên thành công.");
            await loadAll({ silent: true });
          } catch (e: any) {
            setError(e?.response?.data?.message || "Không thể kick thành viên.");
          } finally {
            setUpdatingId(null);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingTxt}>Đang tải quyền trong room...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.headerBar, { height: insets.top + 56, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.navigate("/(tabs)")} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý quyền trong room</Text>
        <View style={{ width: 22 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="always"
          contentInsetAdjustmentBehavior="automatic"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
        >
        {room?.member_role !== "host" ? (
          <View style={styles.card}>
            <Text style={styles.warn}>Chỉ HOST (family) mới được quản lý quyền thành viên.</Text>
          </View>
        ) : (
          <>
            {!!error && <Text style={styles.error}>{error}</Text>}
            {!!success && <Text style={styles.success}>{success}</Text>}
            <View style={styles.card}>
              <Text style={styles.roomText}>room_id: {room?.room_id || "-"}</Text>
              <Text style={styles.roomMeta}>Tổng thành viên: {members.length}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mã QR mời người chăm sóc (CAREGIVER)</Text>
              <Text style={styles.qrIntro}>
                Người dùng chỉ cần quét mã này trong app để vào phòng — không cần mã QR từ admin. Chỉ dùng cho
                người chăm sóc, không dùng thay mã admin để lên HOST.
              </Text>
              {hostQrPayload ? (
                <>
                  <Text style={styles.roomMeta}>Nội dung mã (HOST_JOIN):</Text>
                  <View style={styles.copyRow}>
                    <Text style={styles.tokenText} selectable numberOfLines={3}>
                      {hostQrPayload}
                    </Text>
                    <TouchableOpacity style={styles.copyBtn} onPress={() => void copyQrPayload()}>
                      <Text style={styles.copyTxt}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.qrWrap}>
                    <Image source={{ uri: getHostQrImageUrl(hostQrPayload) }} style={styles.qrImage} />
                  </View>
                  <Text style={styles.qrHint}>
                    Khi tự tạo QR ở app khác, chỉ nhập đúng chuỗi «HOST_JOIN:…» ở trên — không dán link ảnh
                    https://api.qrserver.com/…
                  </Text>
                </>
              ) : (
                <Text style={styles.warn}>
                  Chưa có mã mời. Kéo xuống để làm mới trang, hoặc mở mục Phân quyền trong room từ Cài đặt.
                </Text>
              )}
            </View>

            {members.map((member) => {
              const isHost = member.member_role === "host";
              return (
                <View key={member.user_id} style={styles.card}>
                  <Text style={styles.name}>
                    {member.fullName || member.username || `User #${member.user_id}`}{" "}
                    {isHost ? "(HOST)" : "(CAREGIVER)"}
                  </Text>
                  {!!member.email && <Text style={styles.roomMeta}>{member.email}</Text>}

                  {!isHost && (
                    <>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Nhận thông báo lịch sinh hoạt</Text>
                        <PermissionToggle
                          value={member.can_receive_schedule_notifications}
                          disabled={updatingId === member.user_id}
                          onValueChange={(v) => void onToggle(member, "can_receive_schedule_notifications", v)}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Nhận thông báo nhắc thuốc</Text>
                        <PermissionToggle
                          value={member.can_receive_medication_notifications}
                          disabled={updatingId === member.user_id}
                          onValueChange={(v) => void onToggle(member, "can_receive_medication_notifications", v)}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Xem camera trực tiếp trong room</Text>
                        <PermissionToggle
                          value={member.can_view_live}
                          disabled={updatingId === member.user_id}
                          onValueChange={(v) => void onToggle(member, "can_view_live", v)}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.kickBtn, updatingId === member.user_id && { opacity: 0.6 }]}
                        onPress={() => onKick(member.user_id)}
                        disabled={updatingId === member.user_id}
                      >
                        <Text style={styles.kickTxt}>Kick khỏi room</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}
          </>
        )}

          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  wrap: { padding: 16, gap: 12, paddingBottom: 120 },
  headerBar: {
    backgroundColor: "#FFFFFF",
    height: 56,
    paddingTop: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: { color: "#111827", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
  card: { backgroundColor: "#FFF", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, gap: 8 },
  warn: { color: "#92400E", fontWeight: "600", fontSize: 13 },
  roomText: { color: "#111827", fontWeight: "700", fontSize: 14 },
  roomMeta: { color: "#6B7280", fontSize: 12 },
  sectionTitle: { color: "#111827", fontWeight: "700", fontSize: 14 },
  qrIntro: { color: "#4B5563", fontSize: 12, lineHeight: 18 },
  copyRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  tokenText: {
    flex: 1,
    color: "#0F172A",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 11,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  copyBtn: {
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  copyTxt: { color: "#1D4ED8", fontWeight: "800", fontSize: 12 },
  qrWrap: { alignItems: "center", marginTop: 4 },
  qrImage: { width: 220, height: 220, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFF" },
  qrHint: { color: "#64748B", fontSize: 11, lineHeight: 16 },
  name: { color: "#111827", fontWeight: "700", fontSize: 14 },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  toggleLabel: { flex: 1, color: "#374151", fontSize: 12, fontWeight: "600", paddingRight: 8 },
  kickBtn: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  kickTxt: { color: "#991B1B", textAlign: "center", fontWeight: "700", fontSize: 13 },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  success: {
    color: "#166534",
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  loadingWrap: { flex: 1, justifyContent: "center", alignItems: "center", gap: 8 },
  loadingTxt: { color: "#6B7280", fontSize: 12 },
  permissionToggleTrack: {
    borderRadius: 999,
    justifyContent: "center",
    overflow: "hidden",
  },
  permissionToggleThumb: {
    position: "absolute",
    left: 0,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 3,
  },
});
