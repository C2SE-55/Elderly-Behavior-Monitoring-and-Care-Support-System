import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { DailyScheduleItem } from "@/services/api";
import ScheduleItem from "./ScheduleItem";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.30)",
};

type Props = {
  dayKey: DailyScheduleItem["day_of_week"];
  slotLabel: string;
  schedules: DailyScheduleItem[];
  isCurrent: boolean;
  readonly?: boolean;
  isPast?: boolean;
  onAdd: (dayKey: DailyScheduleItem["day_of_week"]) => void;
  onEdit: (item: DailyScheduleItem) => void;
  onDelete: (item: DailyScheduleItem) => void;
  onViewDetail?: (item: DailyScheduleItem) => void;
};

export default function TimeSlotCell({
  dayKey,
  slotLabel,
  schedules,
  isCurrent,
  readonly = false,
  isPast = false,
  onAdd,
  onEdit,
  onDelete,
  onViewDetail,
}: Props) {
  const hasSchedules = schedules.length > 0;
  const primarySchedules = hasSchedules ? schedules.slice(0, 1) : [];
  const extraCount = hasSchedules ? Math.max(0, schedules.length - primarySchedules.length) : 0;
  return (
    <View
      style={[
        styles.cell,
        isCurrent && styles.currentCell,
        isPast && styles.disabledCell,
      ]}
    >
      <View style={styles.cellBody}>
        {hasSchedules ? (
          primarySchedules.map((item) => (
            <ScheduleItem
              key={item.id}
              item={item}
              onEdit={onEdit}
              onDelete={onDelete}
              readonly={readonly}
              onViewDetail={onViewDetail}
            />
          ))
        ) : (
          <Text style={styles.placeholder}>Chưa có lịch</Text>
        )}
        {extraCount > 0 ? <Text style={styles.moreText}>+{extraCount} hoạt động khác</Text> : null}
      </View>
      <View style={styles.cellFooter}>
        {!readonly && !isPast && !hasSchedules ? (
          <TouchableOpacity style={styles.addBtn} activeOpacity={0.85} onPress={() => onAdd(dayKey)}>
            <Text style={styles.addBtnText}>+ Thêm lịch</Text>
          </TouchableOpacity>
        ) : !readonly && isPast && !hasSchedules ? (
          <Text style={styles.disabledText}>Đã qua thời gian</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: 185,
    minHeight: 168,
    maxHeight: 168,
    padding: 10,
    borderRadius: 18,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  cellBody: {
    flex: 1,
  },
  cellFooter: {
    minHeight: 24,
    justifyContent: "flex-end",
  },
  currentCell: {
    borderColor: COLORS.primaryBorder,
    borderWidth: 1.5,
    backgroundColor: "rgba(167,139,250,0.24)",
    shadowColor: "#56328C",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  disabledCell: {
    opacity: 0.65,
  },
  placeholder: {
    color: COLORS.sub,
    fontSize: 12,
    fontWeight: "700",
  },
  moreText: {
    marginTop: 4,
    color: COLORS.sub,
    fontSize: 10,
    fontWeight: "700",
  },
  addBtn: {
    marginTop: 8,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  addBtnText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "900",
  },
  disabledText: {
    marginTop: 6,
    color: "#9CA3AF",
    fontSize: 10,
    fontWeight: "600",
  },
});
