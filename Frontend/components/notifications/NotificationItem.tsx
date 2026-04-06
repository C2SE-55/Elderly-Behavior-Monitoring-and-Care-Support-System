import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import type { NotificationLogEntry } from "@/services/notificationLog";
import {
  categoryLabelForEntry,
  categoryToneForEntry,
  isCareConfirmationData,
  statusLabelForCareConfirmation,
  toneForCareConfirmationStatus,
} from "./notificationTypes";

const formatWhen = (iso: string) => {
  const d = dayjs(iso);
  if (!d.isValid()) return "";
  const now = dayjs();
  if (d.isSame(now, "day")) return `Hôm nay ${d.format("HH:mm")}`;
  if (d.isSame(now.subtract(1, "day"), "day")) return `Hôm qua ${d.format("HH:mm")}`;
  return d.format("DD/MM HH:mm");
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
      style={[styles.card, item.read && styles.cardRead]}
      activeOpacity={0.85}
      onPressIn={onPressIn}
      onPress={onPress}
    >
      <View style={[styles.typeBar, { backgroundColor: typeTone.text, opacity: item.read ? 0.35 : 1 }]} />
      <View style={styles.cardTop}>
        <Text style={[styles.cardTitle, item.read && styles.cardTitleRead]} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.time}>{formatWhen(item.createdAt)}</Text>
      </View>

      {!!item.body && (
        <Text style={[styles.body, item.read && styles.bodyRead]} numberOfLines={3}>
          {item.body}
        </Text>
      )}

      <View style={styles.bottomRow}>
        <View style={[styles.badgePill, { backgroundColor: typeTone.bg, borderColor: typeTone.border, opacity: item.read ? 0.6 : 1 }]}>
          <Text style={[styles.badge, { color: typeTone.text }]}>{categoryLabel}</Text>
        </View>

        {!!careStatusChip && (
          <View style={[styles.statusPill, { backgroundColor: careStatusChip.tone.bg, borderColor: careStatusChip.tone.border }]}>
            <Text style={[styles.statusText, { color: careStatusChip.tone.text }]}>{careStatusChip.text}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFF",
    padding: 12,
    gap: 6,
  },
  typeBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  cardRead: { opacity: 0.7, backgroundColor: "#F8FAFC" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  cardTitle: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "900" },
  cardTitleRead: { color: "#374151" },
  time: { color: "#6B7280", fontSize: 12, fontWeight: "700" },
  body: { color: "#374151", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  bodyRead: { color: "#6B7280" },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  badgePill: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badge: { fontSize: 11, fontWeight: "900" },
  statusPill: {
    alignSelf: "flex-start",
    marginTop: 2,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: { fontSize: 11, fontWeight: "900" },
});

