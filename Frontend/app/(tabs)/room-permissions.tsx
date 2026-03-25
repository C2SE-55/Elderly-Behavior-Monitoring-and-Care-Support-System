import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  getMyRoom,
  getRoomMembers,
  kickCaretaker,
  MyRoomInfo,
  RoomMember,
  updateCaretakerPermissions,
} from "@/services/api";

export default function RoomPermissionsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [room, setRoom] = useState<MyRoomInfo | null>(null);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const roomData = await getMyRoom();
      setRoom(roomData);
      if (roomData?.member_role === "host") {
        const memberRows = await getRoomMembers();
        setMembers(memberRows);
      } else {
        setMembers([]);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không tải được danh sách thành viên.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const onToggle = async (
    member: RoomMember,
    field: "can_manage_medication" | "can_receive_schedule_notifications" | "can_receive_medication_notifications"
  ) => {
    try {
      setUpdatingId(member.user_id);
      setError("");
      setSuccess("");
      await updateCaretakerPermissions(member.user_id, { [field]: !member[field] });
      setSuccess("Cập nhật quyền thành công.");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Không thể cập nhật quyền.");
    } finally {
      setUpdatingId(null);
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
            await loadAll();
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
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.wrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Quản lý quyền trong room</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backTxt}>Quay lại</Text>
          </TouchableOpacity>
        </View>

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
                        <Text style={styles.toggleLabel}>Cho phép quản lý nhắc thuốc</Text>
                        <Switch
                          value={member.can_manage_medication}
                          onValueChange={() => onToggle(member, "can_manage_medication")}
                          disabled={updatingId === member.user_id}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Nhận thông báo lịch sinh hoạt</Text>
                        <Switch
                          value={member.can_receive_schedule_notifications}
                          onValueChange={() => onToggle(member, "can_receive_schedule_notifications")}
                          disabled={updatingId === member.user_id}
                        />
                      </View>
                      <View style={styles.toggleRow}>
                        <Text style={styles.toggleLabel}>Nhận thông báo nhắc thuốc</Text>
                        <Switch
                          value={member.can_receive_medication_notifications}
                          onValueChange={() => onToggle(member, "can_receive_medication_notifications")}
                          disabled={updatingId === member.user_id}
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
  warn: { color: "#92400E", fontWeight: "600", fontSize: 13 },
  roomText: { color: "#111827", fontWeight: "700", fontSize: 14 },
  roomMeta: { color: "#6B7280", fontSize: 12 },
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
});
