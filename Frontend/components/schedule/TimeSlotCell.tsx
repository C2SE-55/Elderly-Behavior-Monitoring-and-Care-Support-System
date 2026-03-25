import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DailyScheduleItem } from "@/services/api";
import ScheduleItem from "./ScheduleItem";

type Props = {
  dayKey: DailyScheduleItem["day_of_week"];
  slotLabel: string;
  schedules: DailyScheduleItem[];
  isCurrent: boolean;
  disabled?: boolean;
  onAdd: (dayKey: DailyScheduleItem["day_of_week"]) => void;
  onEdit: (item: DailyScheduleItem) => void;
  onDelete: (item: DailyScheduleItem) => void;
};

export default function TimeSlotCell({
  dayKey,
  slotLabel,
  schedules,
  isCurrent,
  disabled = false,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  return (
    <View style={[styles.cell, isCurrent && styles.currentCell, disabled && styles.disabledCell]}>
      {schedules.length === 0 ? (
        <Text style={styles.placeholder}>Chưa có lịch</Text>
      ) : (
        schedules.map((item) => (
          <ScheduleItem key={item.id} item={item} onEdit={onEdit} onDelete={onDelete} />
        ))
      )}
      {!disabled ? (
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => onAdd(dayKey)}>
          <Text style={styles.addBtnText}>+ Thêm lịch</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.disabledText}>Đã qua thời gian</Text>
      )}
      {isCurrent && (
        <View style={styles.currentBadge}>
          <Text style={styles.currentBadgeText}>Đang diễn ra ({slotLabel})</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 185,
    minHeight: 128,
    padding: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  currentCell: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  disabledCell: {
    opacity: 0.65,
  },
  placeholder: {
    color: "#9CA3AF",
    fontSize: 12,
    fontWeight: "600",
  },
  addBtn: {
    marginTop: 4,
    backgroundColor: "#EEF2FF",
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: "flex-start",
  },
  addBtnText: {
    color: "#1D4ED8",
    fontSize: 11,
    fontWeight: "700",
  },
  disabledText: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
  },
  currentBadge: {
    marginTop: 4,
    backgroundColor: "#DBEAFE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  currentBadgeText: {
    color: "#1D4ED8",
    fontSize: 10,
    fontWeight: "700",
  },
});
