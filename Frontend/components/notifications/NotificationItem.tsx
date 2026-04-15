import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import type { NotificationLogEntry } from "@/services/notificationLog";
import { Ionicons } from "@expo/vector-icons";
import {
  categoryLabelForEntry,
  categoryToneForEntry,
  isCareConfirmationData,
  notificationBodyForDisplay,
  statusLabelForCareConfirmation,
  toneForCareConfirmationStatus,
} from "./notificationTypes";

const stripDoneMarker = (v: string) =>
  v
    .replace(/\[\s*đã\s*xong\s*\]/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

const formatWhen = (iso: string) => {
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  const now = dayjs();
  if (d.isSame(now, "day")) return `Hôm nay ${d.format("HH:mm")}`;
  if (d.isSame(now.subtract(1, "day"), "day")) return `Hôm qua ${d.format("HH:mm")}`;
  return d.format("DD/MM HH:mm");
};

const iconForEntry = (entry: NotificationLogEntry): keyof typeof Ionicons.glyphMap => {
  if (entry.type === "room-message") return "chatbubbles-outline";
  if (entry.type === "support-message") return "chatbox-ellipses-outline";
  if (entry.type === "medication") return "medkit-outline";
  if (entry.type === "weekly-schedule") return "calendar-outline";
  if (entry.type === "care-confirmation") return "checkmark-done-circle-outline";
  const d: any = entry?.data;
  if (d?.type === "safety") {
    if (d?.safety_type === "left_safe_zone") return "walk-outline";
    return "warning-outline";
  }
  return "notifications-outline";
};

export default function NotificationItem({
  item,
  onPress,
  onPressIn,
}: {
  item: NotificationLogEntry;
  onPress: () => void;
  onPressIn?: () => void;
}) {
  const typeTone = useMemo(() => categoryToneForEntry(item), [item]);
  const categoryLabel = useMemo(() => categoryLabelForEntry(item), [item]);

  const careStatusChip = useMemo(() => {
    if (item.type !== "care-confirmation") return null;
    const data = item.data;
    if (!isCareConfirmationData(data)) return null;
    const chipTone = toneForCareConfirmationStatus(data.status);
    return {
      text: statusLabelForCareConfirmation(data.status),
      tone: chipTone,
    };
  }, [item.data, item.type]);

  return (
    <TouchableOpacity
      style={[styles.card, !item.read ? styles.cardUnread : styles.cardRead]}
      activeOpacity={0.85}
      onPressIn={onPressIn}
      onPress={onPress}
    >
      <View pointerEvents="none" style={[styles.sheen, { backgroundColor: typeTone.bg }]} />
      <View style={styles.rowTop}>
        <View style={[styles.iconWrap, { backgroundColor: typeTone.bg, borderColor: typeTone.border, opacity: item.read ? 0.78 : 1 }]}>
          <Ionicons name={iconForEntry(item)} size={18} color={typeTone.text} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, item.read && styles.cardTitleRead]} numberOfLines={2}>
              {item.title}
            </Text>
            {!item.read && <View style={styles.unreadDot} />}
          </View>
          {!!item.body && (
            <Text style={[styles.body, item.read && styles.bodyRead]} numberOfLines={2}>
              {stripDoneMarker(notificationBodyForDisplay(item))}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.badgePill, { backgroundColor: typeTone.bg, borderColor: typeTone.border, opacity: item.read ? 0.6 : 1 }]}>
          <Text style={[styles.badge, { color: typeTone.text }]}>{categoryLabel}</Text>
        </View>

        {!!careStatusChip && (
          <View style={[styles.statusPill, { backgroundColor: careStatusChip.tone.bg, borderColor: careStatusChip.tone.border }]}>
            <Text style={[styles.statusText, { color: careStatusChip.tone.text }]}>{careStatusChip.text}</Text>
          </View>
        )}

        <View style={{ flex: 1 }} />
        <Text style={styles.time}>{formatWhen(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    padding: 12,
    gap: 8,
  },
  sheen: {
    position: "absolute",
    top: -26,
    right: -32,
    width: 120,
    height: 120,
    borderRadius: 80,
    opacity: 0.55,
  },
  cardUnread: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(86,50,140,0.18)",
  },
  // Đã đọc chỉ mờ nhẹ, vẫn giữ rõ nội dung
  cardRead: { opacity: 0.9, backgroundColor: "#F8FAFC" },
  rowTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 99, backgroundColor: "#EF4444", marginTop: 6 },
  cardTitle: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "900" },
  cardTitleRead: { color: "#374151" },
  time: { color: "#6B7280", fontSize: 12, fontWeight: "800" },
  body: { marginTop: 4, color: "#4B5563", fontSize: 12, fontWeight: "700", lineHeight: 18 },
  bodyRead: { color: "#6B7280" },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badgePill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge: { fontSize: 11, fontWeight: "900" },
  statusPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: "900" },
});

