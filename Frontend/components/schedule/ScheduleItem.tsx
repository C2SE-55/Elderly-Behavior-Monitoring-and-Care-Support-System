import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DailyScheduleItem } from "@/services/api";

type Props = {
  item: DailyScheduleItem;
  onEdit: (item: DailyScheduleItem) => void;
  onDelete: (item: DailyScheduleItem) => void;
};

const TYPE_BG: Record<DailyScheduleItem["type"], string> = {
  meal: "#DCFCE7",
  exercise: "#FFEDD5",
  rest: "#E5E7EB",
  other: "#DBEAFE",
};

const TYPE_TEXT: Record<DailyScheduleItem["type"], string> = {
  meal: "#166534",
  exercise: "#9A3412",
  rest: "#374151",
  other: "#1E40AF",
};

export default function ScheduleItem({ item, onEdit, onDelete }: Props) {
  return (
    <View style={[styles.box, { backgroundColor: TYPE_BG[item.type] }]}>
      <Text style={[styles.time, { color: TYPE_TEXT[item.type] }]}>
        {String(item.start_time).slice(0, 5)} - {String(item.end_time).slice(0, 5)}
      </Text>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {!!item.description && (
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
      )}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onEdit(item)}>
          <Text style={styles.actionText}>Sửa</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => onDelete(item)}>
          <Text style={[styles.actionText, styles.deleteText]}>Xóa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  time: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  description: {
    fontSize: 11,
    color: "#4B5563",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  actionBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1D4ED8",
  },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
  },
  deleteText: {
    color: "#991B1B",
  },
});
