import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import {
  adminCreateRoom,
  adminDeleteRoom,
  AdminRoomRow,
  AdminUserAccount,
  getAdminRooms,
  getAdminUsers,
} from "@/services/api";

export default function AdminRoomManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<AdminRoomRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const data = await getAdminUsers();
        setUsers(data.filter((u) => String(u.role || "").toLowerCase() === "user"));
      } catch {
        // ignore user list load error in this screen
      }
    })();
  }, []);

  const loadRooms = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent;
    try {
      if (!silent) {
        setRoomsLoading(true);
        setError("");
      }
      const data = await getAdminRooms();
      setRooms((prev) => {
        const prevJson = JSON.stringify(prev || []);
        const nextJson = JSON.stringify(data || []);
        return prevJson === nextJson ? prev : data;
      });
    } catch (e: any) {
      if (!silent) {
        setError(e?.response?.data?.message || "Không tải được danh sách room.");
      }
    } finally {
      if (!silent) {
        setRoomsLoading(false);
      }
    }
  };

  useEffect(() => {
    loadRooms();
  }, []);

  // Tự làm mới danh sách room để số thành viên cập nhật realtime hơn.
  useEffect(() => {
    const t = setInterval(() => {
      void loadRooms({ silent: true });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  const filteredUsers = useMemo(() => {
    const k = search.trim().toLowerCase();
    if (!k) return users;
    return users.filter((u) => {
      const full = String(u.fullName || "").toLowerCase();
      return full.includes(k) || u.username.toLowerCase().includes(k) || u.email.toLowerCase().includes(k);
    });
  }, [search, users]);

  const onCreateRoom = async () => {
    try {
      setLoading(true);
      setError("");
      await adminCreateRoom();
      await loadRooms();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể tạo room.");
    } finally {
      setLoading(false);
    }
  };

  const getQrImageUrl = (payload: string) =>
    `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`;

  const copyToClipboard = async (label: string, value?: string | null) => {
    const txt = String(value || "").trim();
    if (!txt || txt === "-") return;
    try {
      await Clipboard.setStringAsync(txt);
      if (Platform.OS === "web") {
        alert(`Đã copy ${label}`);
      } else {
        Alert.alert("Đã copy", `${label} đã được copy vào clipboard.`);
      }
    } catch {
      if (Platform.OS === "web") {
        alert("Không thể copy. Vui lòng thử lại.");
      } else {
        Alert.alert("Lỗi", "Không thể copy. Vui lòng thử lại.");
      }
    }
  };

  const copyAssignedRoomId = async (roomId?: string | null) => {
    const value = String(roomId || "").trim();
    if (!value) return;
    await copyToClipboard("room_id", value);
  };

  const onDeleteRoom = (room: AdminRoomRow) => {
    const doDelete = async () => {
      try {
        setError("");
        await adminDeleteRoom(room.id);
        await loadRooms();
      } catch (e: any) {
        setError(e?.response?.data?.message || "Không thể xóa room.");
      }
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(`Bạn có chắc muốn xóa room ${room.room_id}?`) : false;
      if (ok) {
        void doDelete();
      }
      return;
    }

    Alert.alert("Xóa room", `Bạn có chắc muốn xóa room ${room.room_id}?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => void doDelete(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Admin - Tạo Room & QR</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>Quay lại</Text>
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tạo room mới</Text>
          <TouchableOpacity style={[styles.primaryBtn, loading && { opacity: 0.6 }]} onPress={onCreateRoom} disabled={loading}>
            <Text style={styles.primaryTxt}>{loading ? "Đang tạo..." : "Tạo room + mã QR payload"}</Text>
          </TouchableOpacity>
          <Text style={styles.meta}>Mỗi room có 1 HOST duy nhất và nhiều CARETAKER.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Gán room_id cho user (workflow admin)</Text>
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm user theo tên/username/email"
          />
          {filteredUsers.slice(0, 6).map((u) => {
            const selected = selectedUserId === u.id;
            return (
              <TouchableOpacity
                key={u.id}
                style={[styles.userRow, selected && styles.userRowActive]}
                onPress={() => setSelectedUserId(u.id)}
              >
                <Text style={styles.userName}>{u.fullName || u.username}</Text>
                <Text style={styles.meta}>@{u.username}</Text>
              </TouchableOpacity>
            );
          })}
          {!!selectedUserId && !!rooms[0]?.room_id && (
            <View style={styles.assignBox}>
              <Text style={styles.meta}>User đã chọn: #{selectedUserId}</Text>
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => void copyAssignedRoomId(rooms[0].room_id)}
              >
                <View style={styles.assignRow}>
                  <Text style={styles.meta}>Room gán: </Text>
                  <Text selectable style={styles.assignValue}>
                    {rooms[0].room_id}
                  </Text>
                </View>
                <Text style={styles.assignHint}>Nhấn giữ để copy</Text>
              </TouchableOpacity>
              <Text style={styles.assignNote}>
                Hướng dẫn: gửi room_id này cho user để họ nhập ở màn hình &quot;Room Access&quot;, sau đó user sẽ lên FAMILY (HOST).
              </Text>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Toàn bộ room trong hệ thống</Text>
            <TouchableOpacity style={styles.refreshBtn} onPress={loadRooms}>
              <Text style={styles.refreshTxt}>Làm mới</Text>
            </TouchableOpacity>
          </View>
          {roomsLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.meta}>Đang tải danh sách room...</Text>
            </View>
          )}
          {!roomsLoading && !rooms.length && <Text style={styles.meta}>Chưa có room nào.</Text>}
        </View>

        {rooms.map((room) => (
          <View key={room.id} style={styles.card}>
            <Text style={styles.roomText}>room_id: {room.room_id}</Text>
            <Text style={styles.meta}>Thành viên hiện tại: {Number(room.total_members || 0)}</Text>
            <Text style={styles.meta}>admin_join_token:</Text>
            <View style={styles.copyRow}>
              <Text style={[styles.token, styles.copyValue]}>{room.admin_join_token || "-"}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => void copyToClipboard("admin_join_token", room.admin_join_token)}
              >
                <Text style={styles.copyTxt}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.meta}>QR payload:</Text>
            <View style={styles.copyRow}>
              <Text style={[styles.token, styles.copyValue]}>{room.admin_qr_payload || "-"}</Text>
              <TouchableOpacity
                style={styles.copyBtn}
                onPress={() => void copyToClipboard("QR payload", room.admin_qr_payload)}
              >
                <Text style={styles.copyTxt}>Copy</Text>
              </TouchableOpacity>
            </View>
            {!!room.admin_qr_payload && (
              <View style={styles.qrWrap}>
                <Text style={styles.meta}>QR Admin (scan để join FAMILY / HOST):</Text>
                <Image source={{ uri: getQrImageUrl(room.admin_qr_payload) }} style={styles.qrImage} />
                <Text style={styles.qrHint}>
                  Nội dung mã chỉ là chuỗi «QR payload» phía trên (dạng ADMIN_JOIN:…). Nếu bạn tự tạo QR bằng app
                  khác, hãy nhập đúng chuỗi đó — không dán link ảnh https://api.qrserver.com/…
                </Text>
              </View>
            )}
            {!!room.host_qr_payload && (
              <View style={styles.qrWrap}>
                <Text style={styles.meta}>QR Host (scan để join CAREGIVER):</Text>
                <Image source={{ uri: getQrImageUrl(room.host_qr_payload) }} style={styles.qrImage} />
                <Text style={styles.qrHint}>
                  Tương tự: chỉ mã HOST_JOIN:… trong «QR payload» host — không dùng URL trang tạo ảnh QR.
                </Text>
              </View>
            )}
            <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeleteRoom(room)}>
              <Text style={styles.deleteTxt}>Xóa room</Text>
            </TouchableOpacity>
          </View>
        ))}
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
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#111827" },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#F9FAFB",
  },
  userRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFF",
  },
  userRowActive: { borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  userName: { color: "#111827", fontWeight: "700", fontSize: 13 },
  assignBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  assignNote: { color: "#334155", fontSize: 12, lineHeight: 18 },
  assignValue: { color: "#0F172A", fontWeight: "600" },
  assignHint: { color: "#64748B", fontSize: 11, fontWeight: "500" },
  assignRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  primaryBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  primaryTxt: { color: "#FFF", textAlign: "center", fontWeight: "700", fontSize: 13 },
  refreshBtn: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  refreshTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 12 },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  roomText: { color: "#111827", fontWeight: "700", fontSize: 14 },
  meta: { color: "#6B7280", fontSize: 12 },
  token: { color: "#0F172A", backgroundColor: "#F1F5F9", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, fontSize: 12 },
  copyRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  copyValue: { flex: 1 },
  copyBtn: {
    alignSelf: "stretch",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  copyTxt: { color: "#1D4ED8", fontWeight: "800", fontSize: 12 },
  qrWrap: { marginTop: 4, gap: 6 },
  qrHint: { color: "#64748B", fontSize: 11, lineHeight: 16 },
  qrImage: { width: 220, height: 220, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFF" },
  deleteBtn: { backgroundColor: "#FEE2E2", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 4 },
  deleteTxt: { color: "#991B1B", textAlign: "center", fontWeight: "700", fontSize: 13 },
  error: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
