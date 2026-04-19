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
  formatMemberRoleLabel,
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
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [adminRoomCode, setAdminRoomCode] = useState("");
  const [hostToken, setHostToken] = useState("");
  const [joinMode, setJoinMode] = useState<"host" | "caregiver">("host");

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

  const selectedRoomSummary = useMemo(
    () => rooms.find((r) => Number(r.id) === Number(expandedRoomId)) || null,
    [rooms, expandedRoomId]
  );

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
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Quản lý room</Text>
        <View style={{ width: 38 }} />
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
          {!!error && <Text style={styles.error}>{error}</Text>}
          {!!success && <Text style={styles.success}>{success}</Text>}

          <View style={styles.card}>
            <View style={styles.sectionHeadRow}>
              <View style={styles.sectionHeadIcon}>
                <Ionicons name="albums-outline" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Danh sách phòng</Text>
            </View>
            <Text style={styles.sectionHint}>Khi bấm vào phòng, hệ thống mới hiện phần thao tác của phòng đó.</Text>
            {!rooms.length && <Text style={styles.meta}>Bạn chưa tham gia room nào.</Text>}
            {rooms.map((r) => {
              const selected = activeRoom === r.id;
              const expanded = expandedRoomId === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roomRow, selected && styles.roomRowActive]}
                  onPress={() => {
                    setExpandedRoomId((prev) => (prev === r.id ? null : r.id));
                    setActiveRoomId(r.id);
                    setActiveRoom(r.id);
                    void loadData();
                  }}
                >
                  <View style={styles.roomRowTop}>
                    <Text style={styles.userName}>{r.room_id}</Text>
                    <View style={styles.roomRowRight}>
                      {selected ? (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillTxt}>Đang dùng</Text>
                        </View>
                      ) : null}
                      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color={COLORS.sub} />
                    </View>
                  </View>
                  <Text style={styles.meta}>
                    {formatMemberRoleLabel(r.member_role) || r.member_role.toUpperCase()} · room_id_int: {r.id}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingTxt}>Đang tải...</Text>
            </View>
          ) : selectedRoomSummary ? (
            <>
              {normalizedRole !== "admin" && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Tham gia room</Text>
                  <Text style={styles.sectionHint}>Chọn đúng chế độ bên dưới để thao tác dễ hơn.</Text>
                  <View style={styles.modeSwitch}>
                    <TouchableOpacity
                      style={[styles.modeBtn, joinMode === "host" && styles.modeBtnActive]}
                      onPress={() => setJoinMode("host")}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.modeBtnTxt, joinMode === "host" && styles.modeBtnTxtActive]}>Host</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modeBtn, joinMode === "caregiver" && styles.modeBtnActive]}
                      onPress={() => setJoinMode("caregiver")}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.modeBtnTxt, joinMode === "caregiver" && styles.modeBtnTxtActive]}>Caregiver</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.scanQrBtn}
                    onPress={() => router.push("/(screens)/room-qr-scan")}
                    accessibilityRole="button"
                    accessibilityLabel="Mở camera quét mã QR"
                  >
                    <Ionicons name="qr-code-outline" size={20} color="#1D4ED8" />
                    <Text style={styles.scanQrBtnTxt}>
                      {joinMode === "host" ? "Quét mã phòng hoặc QR admin" : "Quét mã QR của Host"}
                    </Text>
                  </TouchableOpacity>
                  <TextInput
                    value={joinMode === "host" ? adminRoomCode : hostToken}
                    onChangeText={joinMode === "host" ? setAdminRoomCode : setHostToken}
                    placeholder={
                      joinMode === "host"
                        ? "Nhập room_id (ví dụ RMABC123)"
                        : "Dán host_join_token từ QR"
                    }
                    style={styles.input}
                    autoCapitalize={joinMode === "host" ? "characters" : "none"}
                  />
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={joinMode === "host" ? onJoinByAdminCode : onJoinByHostQr}
                    disabled={joining}
                  >
                    <Text style={styles.primaryTxt}>
                      {joining
                        ? "Đang join..."
                        : joinMode === "host"
                          ? "Join bằng mã phòng (Host)"
                          : "Join bằng QR Host (Caregiver)"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {room?.member_role === "host" && (
                <View style={styles.card}>
                  <Text style={styles.sectionTitle}>Chia sẻ mã tham gia cho Caregiver</Text>
                  <Text style={styles.sectionHint}>Gửi token này cho người thân/chăm sóc để họ vào đúng room.</Text>
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
          ) : null}

          <View style={{ height: 28 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 16, gap: 12, paddingBottom: 120 },
  headerBar: {
    backgroundColor: COLORS.bg,
    height: 56,
    paddingTop: 6,
    paddingHorizontal: 16,
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
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", flex: 1, textAlign: "center" },
  heroCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 14,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 3,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  heroTitle: { fontSize: 12, fontWeight: "800", color: COLORS.sub },
  heroSub: { marginTop: 2, fontSize: 16, fontWeight: "900", color: COLORS.text },
  heroStats: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FFFFFF",
  },
  heroStatCell: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, gap: 2 },
  heroStatValue: { fontSize: 13, fontWeight: "900", color: COLORS.text },
  heroStatLabel: { fontSize: 11, fontWeight: "700", color: COLORS.sub },
  heroStatDivider: { width: 1, backgroundColor: COLORS.border },
  onboardingCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 12,
    gap: 8,
  },
  onboardingHint: { fontSize: 12, color: COLORS.sub, fontWeight: "700", lineHeight: 18 },
  stepLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  stepLineTxt: { flex: 1, fontSize: 12, color: COLORS.text, fontWeight: "700" },
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 14,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  label: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
  badge: { fontSize: 15, fontWeight: "700", color: "#111827" },
  meta: { fontSize: 12, color: "#4B5563", fontWeight: "700" },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },
  sectionHint: { marginTop: -2, fontSize: 12, color: "#64748B", fontWeight: "700", lineHeight: 17 },
  sectionHeadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionHeadIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  modeSwitch: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    padding: 4,
  },
  modeBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  modeBtnActive: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  modeBtnTxt: { fontSize: 12, fontWeight: "900", color: COLORS.sub },
  modeBtnTxtActive: { color: COLORS.primary },
  roomRow: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFF",
  },
  roomRowActive: { borderColor: COLORS.primaryBorder, backgroundColor: "rgba(167,139,250,0.16)" },
  roomRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  roomRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  activePill: {
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activePillTxt: { color: "#FFFFFF", fontWeight: "900", fontSize: 10 },
  userName: { color: "#111827", fontWeight: "700", fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    fontWeight: "700",
  },
  scanQrBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  scanQrBtnTxt: { color: COLORS.primary, fontWeight: "900", fontSize: 13 },
  primaryBtn: { backgroundColor: COLORS.primary, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
  primaryTxt: { color: "#FFF", fontWeight: "900", fontSize: 13, textAlign: "center" },
  secondaryBtn: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  secondaryTxt: { color: COLORS.primary, fontWeight: "900", fontSize: 13, textAlign: "center" },
  tokenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  copyBtnTxt: { color: COLORS.primary, fontWeight: "900", fontSize: 12 },
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
