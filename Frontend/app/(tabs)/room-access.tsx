import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import {
  getActiveRoomId,
  getCurrentUser,
  getMyRoom,
  getMyRooms,
  joinRoomByAdminCode,
  joinRoomByHostQr,
  MyRoomInfo,
  MyRoomSummary,
  refreshCurrentUserProfile,
  setActiveRoomId,
} from "@/services/api";

export default function RoomAccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = getCurrentUser() as { role?: string } | null;
  const normalizedRole = String(user?.role || "user").trim().toLowerCase();
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [room, setRoom] = useState<MyRoomInfo | null>(null);
  const [rooms, setRooms] = useState<MyRoomSummary[]>([]);
  const [activeRoom, setActiveRoom] = useState<number | null>(getActiveRoomId());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminRoomCode, setAdminRoomCode] = useState("");
  const [hostToken, setHostToken] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [roomRows, currentRoom] = await Promise.all([getMyRooms(), getMyRoom()]);
      setRooms(roomRows);
      setRoom(currentRoom);
      if (!activeRoom && roomRows[0]?.id) {
        setActiveRoomId(roomRows[0].id);
        setActiveRoom(roomRows[0].id);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được thông tin room.");
    } finally {
      setLoading(false);
    }
  }, [activeRoom]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roleBadge = useMemo(() => {
    if (normalizedRole === "admin") return "ADMIN";
    if (normalizedRole === "family") return "HOST (family)";
    if (normalizedRole === "caregiver") return "CAREGIVER";
    return "USER";
  }, [normalizedRole]);

  const onJoinByAdminCode = async () => {
    if (!adminRoomCode.trim()) {
      setError("Vui lòng nhập room_id.");
      return;
    }
    try {
      setJoining(true);
      setError("");
      setSuccess("");
      const joined = await joinRoomByAdminCode(adminRoomCode.trim());
      await refreshCurrentUserProfile();
      await loadData();
      const matched = (await getMyRooms()).find((r) => r.room_id === joined.room_id);
      if (matched?.id) {
        setActiveRoomId(matched.id);
        setActiveRoom(matched.id);
      }
      setSuccess(
        joined.serverMessage ||
          (joined.already_in_room
            ? "Bạn đã là chủ phòng (HOST) của phòng này rồi."
            : "Join room thành công. Bạn đã trở thành HOST.")
      );
      setAdminRoomCode("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể join room bằng room_id.");
    } finally {
      setJoining(false);
    }
  };

  const onJoinByHostQr = async () => {
    if (!hostToken.trim()) {
      setError("Vui lòng nhập mã QR/token của HOST.");
      return;
    }
    try {
      setJoining(true);
      setError("");
      setSuccess("");
      const joined = await joinRoomByHostQr(hostToken.trim());
      await refreshCurrentUserProfile();
      await loadData();
      const matched = (await getMyRooms()).find((r) => r.room_id === joined.room_id);
      if (matched?.id) {
        setActiveRoomId(matched.id);
        setActiveRoom(matched.id);
      }
      setSuccess(
        joined.serverMessage ||
          (joined.already_in_room
            ? joined.already_host
              ? "Bạn là chủ phòng (HOST) của phòng này rồi — không cần quét mã người chăm sóc."
              : "Bạn đã có sẵn trong phòng này (vai trò người chăm sóc)."
            : "Join room thành công. Bạn đã trở thành CAREGIVER.")
      );
      setHostToken("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể join room bằng QR host.");
    } finally {
      setJoining(false);
    }
  };

  const copyHostJoinToken = async () => {
    const txt = String(room?.host_join_token || "").trim();
    if (!txt) {
      if (Platform.OS === "web") {
        alert("Chưa có token để copy.");
      } else {
        Alert.alert("Thông báo", "Chưa có token để copy.");
      }
      return;
    }
    try {
      await Clipboard.setStringAsync(txt);
      if (Platform.OS === "web") {
        alert("Đã copy host_join_token.");
      } else {
        Alert.alert("Đã copy", "host_join_token đã được copy vào clipboard.");
      }
    } catch {
      if (Platform.OS === "web") {
        alert("Không thể copy. Vui lòng thử lại.");
      } else {
        Alert.alert("Lỗi", "Không thể copy. Vui lòng thử lại.");
      }
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={[]}>
      <View style={[styles.headerBar, { height: insets.top + 56, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phân quyền trong Room</Text>
        <View style={{ width: 22 }} />
      </View>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.wrap}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="automatic"
        >
        <View style={styles.card}>
          <Text style={styles.label}>Vai trò hệ thống hiện tại</Text>
          <Text style={styles.badge}>{roleBadge}</Text>
          {!!room?.room_id && <Text style={styles.meta}>room_id: {room.room_id}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Danh sách phòng bạn tham gia</Text>
          {!rooms.length && <Text style={styles.meta}>Bạn chưa tham gia room nào.</Text>}
          {rooms.map((r) => {
            const selected = activeRoom === r.id;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.roomRow, selected && styles.roomRowActive]}
                onPress={() => {
                  setActiveRoomId(r.id);
                  setActiveRoom(r.id);
                  void loadData();
                }}
              >
                <Text style={styles.userName}>
                  {r.room_id} · {r.member_role.toUpperCase()}
                </Text>
                <Text style={styles.meta}>room_id_int: {r.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
        {!!success && <Text style={styles.success}>{success}</Text>}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingTxt}>Đang tải...</Text>
          </View>
        ) : (
          <>
            {normalizedRole !== "admin" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>1) Nhập room_id của Admin để thành HOST trong room đó</Text>
                <TouchableOpacity
                  style={styles.scanQrBtn}
                  onPress={() => router.push("/(screens)/room-qr-scan")}
                  accessibilityRole="button"
                  accessibilityLabel="Quét mã QR admin hoặc mã phòng"
                >
                  <Ionicons name="qr-code-outline" size={20} color="#1D4ED8" />
                  <Text style={styles.scanQrBtnTxt}>Quét mã (admin / mã phòng RM…)</Text>
                </TouchableOpacity>
                <TextInput
                  value={adminRoomCode}
                  onChangeText={setAdminRoomCode}
                  placeholder="Nhập room_id (ví dụ RMABC123)"
                  style={styles.input}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={onJoinByAdminCode} disabled={joining}>
                  <Text style={styles.primaryTxt}>{joining ? "Đang join..." : "Join bằng room_id Admin"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {normalizedRole !== "admin" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>2) Quét QR của HOST để thành CAREGIVER trong room đó</Text>
                <TouchableOpacity
                  style={styles.scanQrBtn}
                  onPress={() => router.push("/(screens)/room-qr-scan")}
                  accessibilityRole="button"
                  accessibilityLabel="Mở camera quét mã QR"
                >
                  <Ionicons name="qr-code-outline" size={20} color="#1D4ED8" />
                  <Text style={styles.scanQrBtnTxt}>Quét mã bằng camera</Text>
                </TouchableOpacity>
                <TextInput
                  value={hostToken}
                  onChangeText={setHostToken}
                  placeholder="Hoặc dán host_join_token từ QR"
                  style={styles.input}
                />
                <TouchableOpacity style={styles.primaryBtn} onPress={onJoinByHostQr} disabled={joining}>
                  <Text style={styles.primaryTxt}>{joining ? "Đang join..." : "Join bằng QR Host"}</Text>
                </TouchableOpacity>
              </View>
            )}

            {room?.member_role === "host" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>3) HOST chia sẻ QR token</Text>
                <Text style={styles.meta}>host_join_token:</Text>
                <View style={styles.tokenRow}>
                  <Text style={styles.tokenText} selectable>
                    {room.host_join_token || "Chưa có token"}
                  </Text>
                  <TouchableOpacity
                    style={styles.copyBtn}
                    onPress={() => void copyHostJoinToken()}
                    disabled={!String(room.host_join_token || "").trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Sao chép host_join_token"
                  >
                    <Ionicons name="copy-outline" size={18} color="#1D4ED8" />
                    <Text style={styles.copyBtnTxt}>Sao chép</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push("/(tabs)/room-permissions")}>
                  <Text style={styles.secondaryTxt}>Quản lý quyền thành viên trong room</Text>
                </TouchableOpacity>
              </View>
            )}

            {room?.member_role === "caretaker" && (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Bạn là CAREGIVER</Text>
                <Text style={styles.meta}>Bạn chỉ có quyền xem dữ liệu room, trừ khi HOST bật thêm quyền.</Text>
              </View>
            )}
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
  label: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  badge: { fontSize: 15, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 12, color: "#4B5563" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  roomRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFF",
  },
  roomRowActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  userName: { color: "#111827", fontWeight: "700", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#F9FAFB",
  },
  scanQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  scanQrBtnTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 13 },
  primaryBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryTxt: { color: "#FFF", fontWeight: "700", fontSize: 13, textAlign: "center" },
  secondaryBtn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 13, textAlign: "center" },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  tokenText: {
    flex: 1,
    fontSize: 12,
    color: "#0F172A",
    minWidth: 0,
  },
  copyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0E7FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  copyBtnTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 12 },
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
  loadingWrap: { alignItems: "center", gap: 8, paddingVertical: 10 },
  loadingTxt: { color: "#6B7280", fontSize: 12 },
});
