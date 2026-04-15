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
import { Feather } from "@expo/vector-icons";
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

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.94)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.34)",
  blueSoft: "rgba(37,99,235,0.10)",
  blueBorder: "rgba(37,99,235,0.24)",
  greenSoft: "rgba(16,185,129,0.12)",
  greenBorder: "rgba(16,185,129,0.26)",
  dangerBg: "#FEE2E2",
  dangerBorder: "rgba(239,68,68,0.35)",
  dangerText: "#991B1B",
};

export default function AdminRoomManagementScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<AdminRoomRow[]>([]);
  const [expandedRoomId, setExpandedRoomId] = useState<number | null>(null);

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

  const roomWithHost = useMemo(
    () => rooms.filter((r) => Number(r.host_user_id || 0) > 0).length,
    [rooms]
  );

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
      <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.9}>
            <Feather name="arrow-left" size={20} color={COLORS.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Quản lý phòng</Text>
            <Text style={styles.headerSub}>Tạo phòng, QR và quản lý trạng thái host/caregiver</Text>
          </View>
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.summaryRow}>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{rooms.length}</Text>
            <Text style={styles.summaryLabel}>Tổng room</Text>
          </View>
          <View style={styles.summaryPill}>
            <Text style={styles.summaryValue}>{roomWithHost}</Text>
            <Text style={styles.summaryLabel}>Room đã có host</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Feather name="plus-square" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Tạo room mới</Text>
              <Text style={styles.meta}>Room mới tạo sẽ hiển thị QR host cho tới khi có host tham gia.</Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
            onPress={onCreateRoom}
            disabled={loading}
            activeOpacity={0.9}
          >
            <Feather name="plus-circle" size={18} color="#FFF" />
            <Text style={styles.primaryTxt}>{loading ? "Đang tạo..." : "Tạo room + sinh mã QR"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHead}>
            <View style={styles.sectionIcon}>
              <Feather name="users" size={16} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Gán room_id cho user</Text>
              <Text style={styles.meta}>Tìm user và gửi room_id để họ join FAMILY (HOST).</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm user theo tên/username/email"
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.userListWrap}>
            {filteredUsers.slice(0, 6).map((u) => {
              const selected = selectedUserId === u.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  style={[styles.userRow, selected && styles.userRowActive]}
                  onPress={() => setSelectedUserId(u.id)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.userName}>{u.fullName || u.username}</Text>
                  <Text style={styles.meta}>@{u.username}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
            <TouchableOpacity style={styles.refreshBtn} onPress={() => void loadRooms()} activeOpacity={0.9}>
              <Feather name="refresh-cw" size={14} color="#1D4ED8" />
              <Text style={styles.refreshTxt}>Làm mới</Text>
            </TouchableOpacity>
          </View>
          {roomsLoading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.meta}>Đang tải danh sách room...</Text>
            </View>
          )}
          {!roomsLoading && !rooms.length && <Text style={styles.meta}>Chưa có room nào.</Text>}
        </View>

        {rooms.map((room) => {
          const hasHost = Number(room.host_user_id || 0) > 0;
          const expanded = expandedRoomId === room.id;
          return (
            <View key={room.id} style={styles.card}>
              <TouchableOpacity
                style={styles.roomHeaderPress}
                onPress={() => setExpandedRoomId((prev) => (prev === room.id ? null : room.id))}
                activeOpacity={0.9}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomText}>{room.room_id}</Text>
                    <Text style={styles.meta}>Số lượng thành viên: {Number(room.total_members || 0)}</Text>
                    <Text style={styles.meta}>ID phòng: {room.id}</Text>
                  </View>
                  <View style={styles.roomHeaderRight}>
                    <View style={[styles.statePill, hasHost ? styles.statePillHost : styles.statePillPending]}>
                      <Text style={[styles.statePillTxt, hasHost ? styles.statePillTxtHost : styles.statePillTxtPending]}>
                        {hasHost ? "Đã có HOST" : "Chưa có HOST"}
                      </Text>
                    </View>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={18} color={COLORS.sub} />
                  </View>
                </View>
              </TouchableOpacity>

              {expanded && (
                <>
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

                  {!hasHost && !!room.admin_qr_payload && (
                    <View style={styles.qrWrap}>
                      <Text style={styles.meta}>QR Host (chỉ hiện khi phòng chưa có host):</Text>
                      <View style={styles.copyRow}>
                        <Text style={[styles.token, styles.copyValue]}>{room.admin_qr_payload || "-"}</Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => void copyToClipboard("QR host payload", room.admin_qr_payload)}
                        >
                          <Text style={styles.copyTxt}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <Image source={{ uri: getQrImageUrl(room.admin_qr_payload) }} style={styles.qrImage} />
                      <Text style={styles.qrHint}>
                        Khi phòng chưa có host, người dùng quét mã này để join FAMILY (HOST).
                      </Text>
                    </View>
                  )}

                  {!!room.host_qr_payload && (
                    <View style={styles.qrWrap}>
                      <Text style={styles.meta}>QR Caregiver:</Text>
                      <View style={styles.copyRow}>
                        <Text style={[styles.token, styles.copyValue]}>{room.host_qr_payload || "-"}</Text>
                        <TouchableOpacity
                          style={styles.copyBtn}
                          onPress={() => void copyToClipboard("QR caregiver payload", room.host_qr_payload)}
                        >
                          <Text style={styles.copyTxt}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                      <Image source={{ uri: getQrImageUrl(room.host_qr_payload) }} style={styles.qrImage} />
                      <Text style={styles.qrHint}>
                        Mã này dành cho caregiver join vào room. Khi phòng đã có host thì chỉ dùng mã này.
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.deleteBtn} onPress={() => onDeleteRoom(room)} activeOpacity={0.9}>
                    <Feather name="trash-2" size={15} color={COLORS.dangerText} />
                    <Text style={styles.deleteTxt}>Xóa room</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  wrap: { padding: 18, gap: 12, paddingBottom: 28 },

  header: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  title: { fontSize: 19, fontWeight: "900", color: COLORS.text },
  headerSub: { marginTop: 2, color: COLORS.sub, fontSize: 12, fontWeight: "700" },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryRow: { flexDirection: "row", gap: 8 },
  summaryPill: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryValue: { fontSize: 18, fontWeight: "900", color: COLORS.primary, lineHeight: 20 },
  summaryLabel: { marginTop: 2, fontSize: 11, color: COLORS.sub, fontWeight: "800" },

  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
  },
  sectionTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },

  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.30)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
    color: COLORS.text,
    fontWeight: "700",
  },

  userListWrap: { gap: 8 },
  userRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#FFF",
  },
  userRowActive: { borderColor: COLORS.primaryBorder, backgroundColor: COLORS.primarySoft },
  userName: { color: COLORS.text, fontWeight: "800", fontSize: 13 },

  assignBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 10,
    gap: 4,
  },
  assignNote: { color: "#334155", fontSize: 12, lineHeight: 18 },
  assignValue: { color: "#0F172A", fontWeight: "700" },
  assignHint: { color: "#64748B", fontSize: 11, fontWeight: "500" },
  assignRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryTxt: { color: "#FFF", textAlign: "center", fontWeight: "900", fontSize: 13 },

  refreshBtn: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: COLORS.blueBorder,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshTxt: { color: "#1D4ED8", fontWeight: "900", fontSize: 12 },
  loadingWrap: { flexDirection: "row", alignItems: "center", gap: 8 },

  roomText: { color: COLORS.text, fontWeight: "900", fontSize: 14 },
  roomHeaderPress: { borderRadius: 10 },
  roomHeaderRight: { alignItems: "flex-end", gap: 8 },
  meta: { color: COLORS.sub, fontSize: 12, fontWeight: "600" },
  statePill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderWidth: 1,
  },
  statePillHost: { backgroundColor: COLORS.greenSoft, borderColor: COLORS.greenBorder },
  statePillPending: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primaryBorder },
  statePillTxt: { fontSize: 10, fontWeight: "900" },
  statePillTxtHost: { color: "#065F46" },
  statePillTxtPending: { color: COLORS.primary },

  token: {
    color: "#0F172A",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  copyRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
  copyValue: { flex: 1 },
  copyBtn: {
    alignSelf: "stretch",
    justifyContent: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  copyTxt: { color: "#1D4ED8", fontWeight: "800", fontSize: 12 },

  qrWrap: { marginTop: 4, gap: 6 },
  qrHint: { color: "#64748B", fontSize: 11, lineHeight: 16 },
  qrImage: { width: 220, height: 220, borderRadius: 8, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#FFF" },

  deleteBtn: {
    backgroundColor: COLORS.dangerBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.dangerBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  deleteTxt: { color: COLORS.dangerText, textAlign: "center", fontWeight: "900", fontSize: 13 },

  error: {
    color: COLORS.dangerText,
    backgroundColor: COLORS.dangerBg,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
