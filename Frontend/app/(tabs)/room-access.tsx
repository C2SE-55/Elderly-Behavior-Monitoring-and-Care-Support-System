import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getActiveRoomId,
  getCurrentUser,
  getMyRoom,
  getMyRooms,
  joinRoomByAdminCode,
  joinRoomByHostQr,
  logoutUser,
  MyRoomInfo,
  MyRoomSummary,
  refreshCurrentUserProfile,
  setActiveRoomId,
} from "@/services/api";

export default function RoomAccessScreen() {
  const router = useRouter();
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
      setSuccess("Join room thành công. Bạn đã trở thành HOST.");
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
      setSuccess("Join room thành công. Bạn đã trở thành CAREGIVER.");
      setHostToken("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể join room bằng QR host.");
    } finally {
      setJoining(false);
    }
  };

  const onLogout = () => {
    logoutUser();
    router.replace("/(auths)/login");
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Phân quyền trong Room</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>Quay lại</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Vai trò hệ thống hiện tại</Text>
          <Text style={styles.badge}>{roleBadge}</Text>
          <Text style={styles.meta}>
            Room role: {room?.member_role ? room.member_role.toUpperCase() : "CHƯA THAM GIA ROOM"}
          </Text>
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
                <TextInput
                  value={hostToken}
                  onChangeText={setHostToken}
                  placeholder="Dán host_join_token từ QR"
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
                <Text style={styles.token}>{room.host_join_token || "Chưa có token"}</Text>
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

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutTxt}>Đăng xuất</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  wrap: { padding: 16, gap: 12, paddingBottom: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "700", color: "#111827" },
  backBtn: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  backTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 12 },
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
  primaryBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryTxt: { color: "#FFF", fontWeight: "700", fontSize: 13, textAlign: "center" },
  secondaryBtn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 13, textAlign: "center" },
  token: {
    fontSize: 12,
    color: "#0F172A",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
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
  logoutBtn: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  logoutTxt: { color: "#991B1B", textAlign: "center", fontWeight: "700", fontSize: 13 },
});
