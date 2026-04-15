import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DailyScheduleItem } from "@/services/api";
import { isScheduleMarkedDone } from "@/utils/scheduleMarkedDone";

const COLORS = {
  text: "#0F172A",
  sub: "#64748B",
  border: "rgba(148,163,184,0.22)",
  chipBg: "rgba(255,255,255,0.72)",
  chipBorder: "rgba(148,163,184,0.22)",
  actionBg: "rgba(167,139,250,0.14)",
  actionBorder: "rgba(167,139,250,0.28)",
  actionText: "#56328C",
  dangerBg: "rgba(239,68,68,0.12)",
  dangerBorder: "rgba(239,68,68,0.22)",
  dangerText: "#B91C1C",
};

type Props = {
  item: DailyScheduleItem;
  onEdit: (item: DailyScheduleItem) => void;
  onDelete: (item: DailyScheduleItem) => void;
  readonly?: boolean;
  onViewDetail?: (item: DailyScheduleItem) => void;
};

const TYPE_BG: Record<DailyScheduleItem["type"], string> = {
  meal: "rgba(34,197,94,0.16)",
  exercise: "rgba(245,158,11,0.18)",
  rest: "rgba(148,163,184,0.18)",
  other: "rgba(59,130,246,0.16)",
};

const TYPE_TEXT: Record<DailyScheduleItem["type"], string> = {
  meal: "#166534",
  exercise: "#9A3412",
  rest: "#374151",
  other: "#1E40AF",
};

export default function ScheduleItem({
  item,
  onEdit,
  onDelete,
  readonly = false,
  onViewDetail,
}: Props) {
  const isDone = isScheduleMarkedDone(item);
  const normalizedDescription = String(item.description || "")
    .replace(/\[ĐÃ XONG\]/gi, "")
    .trim();
  return (
    <View style={[styles.box, { backgroundColor: TYPE_BG[item.type] }]}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.timeChip}>
            <Text style={[styles.time, { color: TYPE_TEXT[item.type] }]}>
              {String(item.start_time).slice(0, 5)} - {String(item.end_time).slice(0, 5)}
            </Text>
          </View>
          {isDone && <Text style={styles.doneBadge}>Đã xong</Text>}
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {normalizedDescription || " "}
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onViewDetail?.(item)} activeOpacity={0.9}>
          <Text style={styles.actionText}>Chi tiết</Text>
        </TouchableOpacity>
        {!readonly && (
          <>
            {!isDone && (
              <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)} activeOpacity={0.9}>
                <Text style={styles.actionText}>Sửa</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(item)} activeOpacity={0.9}>
              <Text style={[styles.actionText, styles.deleteText]}>Xóa</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 134,
    maxHeight: 134,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  content: {
    flexShrink: 1,
  },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  timeChip: {
    backgroundColor: COLORS.chipBg,
    borderWidth: 1,
    borderColor: COLORS.chipBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  time: {
    fontSize: 10,
    fontWeight: "900",
  },
  title: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.text,
    marginTop: 6,
  },
  description: {
    fontSize: 11,
    color: COLORS.sub,
    marginTop: 2,
    fontWeight: "600",
    minHeight: 30,
    lineHeight: 15,
  },
  doneBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(22,163,74,0.15)",
    color: "#166534",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 10,
    fontWeight: "800",
    overflow: "hidden",
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
    flexWrap: "nowrap",
  },
  actionBtn: {
    backgroundColor: COLORS.actionBg,
    borderWidth: 1,
    borderColor: COLORS.actionBorder,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  actionText: {
    fontSize: 10,
    fontWeight: "900",
    color: COLORS.actionText,
  },
  deleteBtn: {
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.dangerBorder,
  },
  deleteText: {
    color: COLORS.dangerText,
  },
});
