import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import type { NotificationLogEntry } from "@/services/notificationLog";
import { categoryLabelForEntry, isCareConfirmationData, statusLabelForCareConfirmation } from "./notificationTypes";
import { getCurrentUser, getMyRoom, getRoomMembers, type RoomMemberRole } from "@/services/api";
import { confirmCareNotification } from "@/services/careConfirmationNotifications";
import { getElderNameFromHealthMetrics } from "@/services/healthContext";
import { confirmNotificationLog, getGenericConfirmationFromData } from "@/services/notificationConfirmations";
import { getCachedRoomContext, mergeCachedRoomContext } from "@/services/roomContextCache";
import { useRouter } from "expo-router";

const roleLabel = (role: RoomMemberRole) => (role === "host" ? "Host" : "Caregiver");
const safeName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");
const formatConfirmedRoles = (hostConfirmed: boolean, caregiverConfirmed: boolean) => {
  const roles: string[] = [];
  if (hostConfirmed) roles.push("Host");
  if (caregiverConfirmed) roles.push("Caregiver");
  if (!roles.length) return "Chưa có";
  return `(${roles.join(", ")})`;
};

export default function NotificationDetailModal({
  visible,
  item,
  myRole,
  onClose,
  onAfterConfirm,
}: {
  visible: boolean;
  item: NotificationLogEntry | null;
  myRole: RoomMemberRole | null;
  onClose: () => void;
  onAfterConfirm?: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [roomContext, setRoomContext] = useState<{
    roomId?: string;
    roomName?: string;
    elderName?: string;
    caregiverName?: string;
    hostName?: string;
  } | null>(null);

  const whenFull = useMemo(() => {
    if (!item) return "";
    const d = dayjs(item.createdAt);
    return d.isValid() ? d.format("DD/MM/YYYY HH:mm") : "";
  }, [item]);

  const care = useMemo(() => {
    if (!item) return null;
    if (item.type !== "care-confirmation") return null;
    const data = item.data;
    if (!isCareConfirmationData(data)) return null;
    return data;
  }, [item]);

  const genericConfirmation = useMemo(() => {
    if (!item) return null;
    if (item.type === "care-confirmation") return null;
    return getGenericConfirmationFromData(item.data);
  }, [item]);

  const safety = useMemo(() => {
    const d: any = item?.data || {};
    if (!item) return null;
    if (d?.type !== "safety") return null;
    const safetyType = d?.safety_type === "left_safe_zone" ? "left_safe_zone" : "fall";
    const eventId = Number(d?.event_id || 0) || null;
    return {
      safetyType,
      eventId,
    };
  }, [item]);

  useEffect(() => {
    if (!visible) return;
    if (!item) return;
    let cancelled = false;
    const loadContext = async () => {
      setContextLoading(true);
      try {
        const [room, elderNameFromHealth, members] = await Promise.all([
          getMyRoom().catch(() => null),
          getElderNameFromHealthMetrics().catch(() => null),
          getRoomMembers().catch(() => []),
        ]);
        if (cancelled) return;
        const me = getCurrentUser() as { id?: number; fullName?: string; username?: string } | null;
        const meName = safeName(me?.fullName || me?.username);
        const hostUserId = Number(room?.host_user_id || 0) || null;

        const caretaker =
          members.find((m) => m.member_role === "caretaker") ||
          members.find((m) => (m as any).member_role === ("caregiver" as any)) ||
          (me?.id ? members.find((m) => Number(m.user_id) === Number(me.id)) : undefined);

        const host =
          members.find((m) => m.member_role === "host") ||
          (hostUserId ? members.find((m) => Number(m.user_id) === Number(hostUserId)) : undefined);

        const roomIdText = safeName(room?.room_id);
        const cached = roomIdText ? await getCachedRoomContext(roomIdText) : null;

        const next = {
          roomId: roomIdText || undefined,
          roomName: roomIdText || undefined,
          elderName: safeName(elderNameFromHealth) || undefined,
          caregiverName:
            safeName(care?.caregiver_name) ||
            safeName(caretaker?.fullName || caretaker?.username) ||
            safeName(cached?.caregiverName) ||
            meName ||
            undefined,
          hostName:
            safeName(care?.host_name) ||
            safeName(host?.fullName || host?.username) ||
            safeName(cached?.hostName) ||
            (hostUserId ? `Host #${hostUserId}` : undefined),
        };

        if (roomIdText) {
          void mergeCachedRoomContext(roomIdText, {
            hostName: safeName(next.hostName),
            caregiverName: safeName(next.caregiverName),
          });
        }

        setRoomContext((prev) => {
          const p = prev || {};
          return {
            roomId: next.roomId || p.roomId,
            roomName: next.roomName || p.roomName,
            elderName: next.elderName || p.elderName,
            caregiverName: next.caregiverName || p.caregiverName,
            hostName: next.hostName || p.hostName,
          };
        });
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    };
    void loadContext();
    return () => {
      cancelled = true;
    };
  }, [item?.id, visible]);

  const canConfirm = useMemo(() => {
    if (!care) return false;
    if (!myRole) return false;
    if (care.status === "done") return false;
    if (myRole === "host" && care.confirmations.host) return false;
    if (myRole === "caretaker" && care.confirmations.caretaker) return false;
    return true;
  }, [care, myRole]);

  const confirmedByText = useMemo(() => {
    if (!care) return "Chưa có";
    return formatConfirmedRoles(!!care.confirmations?.host, !!care.confirmations?.caretaker);
  }, [care]);

  const genericConfirmedByText = useMemo(() => {
    if (!genericConfirmation) return "Chưa có";
    return formatConfirmedRoles(!!genericConfirmation.confirmations?.host, !!genericConfirmation.confirmations?.caretaker);
  }, [genericConfirmation]);

  const genericStatusText = useMemo(() => {
    if (!genericConfirmation) return "Chưa xác nhận";
    const anyConfirmed = !!genericConfirmation.confirmations?.host || !!genericConfirmation.confirmations?.caretaker;
    return anyConfirmed ? "Đã xác nhận" : "Chưa xác nhận";
  }, [genericConfirmation]);

  const canConfirmGeneric = useMemo(() => {
    if (!item) return false;
    if (item.type === "care-confirmation") return false;
    if (!myRole) return false;
    const c = genericConfirmation;
    if (!c) return true;
    if (c.status === "done") return false;
    if (myRole === "host" && c.confirmations.host) return false;
    if (myRole === "caretaker" && c.confirmations.caretaker) return false;
    return true;
  }, [genericConfirmation, item, myRole]);

  const displayContext = useMemo(() => {
    const base = roomContext || {};
    return {
      room: safeName(care?.room_name) || safeName(care?.room_id) || safeName(base.roomName) || safeName(base.roomId) || "—",
      elder: safeName(care?.elder_name) || safeName(base.elderName) || "—",
      caregiver: safeName(care?.caregiver_name) || safeName(base.caregiverName) || "—",
      host: safeName(care?.host_name) || safeName(base.hostName) || "—",
    };
  }, [care, roomContext]);

  const statusText = useMemo(() => {
    if (!care) return "Chưa xác nhận";
    const anyConfirmed = !!care.confirmations?.host || !!care.confirmations?.caretaker;
    return anyConfirmed ? "Đã xác nhận" : "Chưa xác nhận";
  }, [care]);

  const safetyStatusText = useMemo(() => {
    if (!safety) return null;
    return safety.safetyType === "left_safe_zone" ? "Rời khỏi vùng an toàn" : "Té ngã";
  }, [safety]);

  const handleConfirm = async () => {
    if (!item || !myRole) return;
    if (!canConfirm) return;
    try {
      setSaving(true);
      await confirmCareNotification(item.id, myRole);
      onAfterConfirm?.();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmGeneric = async () => {
    if (!item || !myRole) return;
    if (!canConfirmGeneric) return;
    try {
      setSaving(true);
      await confirmNotificationLog(item.id, myRole);
      onAfterConfirm?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chi tiết thông báo</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.modalClose}>Đóng</Text>
            </TouchableOpacity>
          </View>

          {!item ? (
            <Text style={styles.modalBodyText}>Không có dữ liệu.</Text>
          ) : (
            <>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Mục</Text>
                  <Text style={styles.metaValue}>{categoryLabelForEntry(item)}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Thời gian</Text>
                  <Text style={styles.metaValue}>{whenFull || "—"}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Tiêu đề</Text>
                  <Text style={styles.metaValue}>{item.title}</Text>
                </View>

                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Room</Text>
                  <Text style={styles.metaValue}>
                    {displayContext.room}
                    {contextLoading ? " (đang tải...)" : ""}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Người cần chăm sóc</Text>
                  <Text style={styles.metaValue}>{displayContext.elder}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Người chăm sóc</Text>
                  <Text style={styles.metaValue}>{displayContext.caregiver}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Host</Text>
                  <Text style={styles.metaValue}>{displayContext.host}</Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Trạng thái</Text>
                  <Text style={styles.metaValue}>
                    {safetyStatusText || (care ? statusText : genericStatusText)}
                  </Text>
                </View>
                {/* Nội dung (body) không hiển thị theo yêu cầu mới */}
              </ScrollView>

              {safety?.eventId ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.linkBtn]}
                    activeOpacity={0.9}
                    onPress={() => {
                      onClose();
                      router.push({ pathname: "/(cameras)/camera", params: { eventId: String(safety.eventId) } });
                    }}
                  >
                    <Text style={styles.linkText}>Xem ảnh cảnh báo</Text>
                  </TouchableOpacity>
                </View>
              ) : care ? (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
                    activeOpacity={0.9}
                    disabled={!canConfirm || saving}
                    onPress={() => void handleConfirm()}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmText}>{canConfirm ? "Xác nhận" : "Đã xác nhận"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[styles.confirmBtn, !canConfirmGeneric && styles.confirmBtnDisabled]}
                    activeOpacity={0.9}
                    disabled={!canConfirmGeneric || saving}
                    onPress={() => void handleConfirmGeneric()}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.confirmText}>{canConfirmGeneric ? "Xác nhận" : "Đã xác nhận"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 16 },
  modalCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    maxHeight: "80%",
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { fontSize: 16, fontWeight: "900", color: "#111827" },
  modalClose: { fontSize: 12, fontWeight: "900", color: "#2563EB" },
  modalScroll: { flexGrow: 0 },
  modalScrollContent: { gap: 10, paddingBottom: 4 },
  metaRow: { gap: 4 },
  metaLabel: { fontSize: 12, fontWeight: "900", color: "#6B7280" },
  metaValue: { fontSize: 14, fontWeight: "800", color: "#111827", lineHeight: 20 },
  modalBodyText: { fontSize: 14, fontWeight: "600", color: "#374151", lineHeight: 20 },
  actionsRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 4 },
  confirmBtn: {
    backgroundColor: "#16A34A",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 120,
    alignItems: "center",
  },
  confirmBtnDisabled: { backgroundColor: "#9CA3AF" },
  confirmText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
  linkBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 160,
    alignItems: "center",
  },
  linkText: { color: "#FFFFFF", fontWeight: "900", fontSize: 12 },
});

