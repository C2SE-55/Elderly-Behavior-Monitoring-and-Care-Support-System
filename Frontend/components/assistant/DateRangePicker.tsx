import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import { MealKey } from "./mealPlanTypes";

type Props = {
  disabled?: boolean;
  onGenerate: (startDate: string, endDate: string, meals: MealKey[]) => void;
};

const MAX_RANGE_DAYS = 7;

type PickerTarget = "start" | "end" | null;

const formatDate = (date: Date) => dayjs(date).format("YYYY-MM-DD");

export default function DateRangePicker({ disabled, onGenerate }: Props) {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [error, setError] = useState("");
  const [selectedMeals, setSelectedMeals] = useState<Record<MealKey, boolean>>({
    breakfast: true,
    lunch: true,
    dinner: true,
  });

  const rangeDays = useMemo(() => {
    const diff = dayjs(endDate).startOf("day").diff(dayjs(startDate).startOf("day"), "day");
    return diff + 1;
  }, [endDate, startDate]);

  const openPicker = (target: PickerTarget) => {
    if (disabled) return;
    if (Platform.OS === "web") {
      const current = target === "start" ? startDate : endDate;
      const raw = typeof window !== "undefined" ? window.prompt("Nhập ngày (YYYY-MM-DD)", formatDate(current)) : "";
      if (!raw) return;
      const normalized = raw.trim();
      const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(normalized);
      const next = dayjs(normalized);
      if (!isIsoDate || !next.isValid()) {
        setError("Ngày không hợp lệ. Dùng định dạng YYYY-MM-DD.");
        return;
      }
      if (target === "start") setStartDate(next.toDate());
      if (target === "end") setEndDate(next.toDate());
      setError("");
      return;
    }
    setPickerTarget(target);
  };

  const onChangeDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setPickerTarget(null);
    }
    if (event.type === "dismissed" || !selected || !pickerTarget) return;
    if (pickerTarget === "start") setStartDate(selected);
    if (pickerTarget === "end") setEndDate(selected);
    setError("");
  };

  const handleGenerate = () => {
    const s = dayjs(startDate).startOf("day");
    const e = dayjs(endDate).startOf("day");
    if (e.isBefore(s)) {
      setError("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
      return;
    }
    const days = e.diff(s, "day") + 1;
    if (days > MAX_RANGE_DAYS) {
      setError("Chỉ cho phép tối đa 7 ngày.");
      return;
    }
    const mealKeys = (Object.keys(selectedMeals) as MealKey[]).filter((k) => selectedMeals[k]);
    if (!mealKeys.length) {
      setError("Bạn cần chọn ít nhất 1 buổi ăn.");
      return;
    }
    setError("");
    onGenerate(s.format("YYYY-MM-DD"), e.format("YYYY-MM-DD"), mealKeys);
  };

  const toggleMeal = (mealKey: MealKey) => {
    if (disabled) return;
    setSelectedMeals((prev) => ({ ...prev, [mealKey]: !prev[mealKey] }));
    setError("");
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Bạn muốn tạo thực đơn từ ngày nào đến ngày nào?</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.dateBtn, disabled && styles.dateBtnDisabled]}
          onPress={() => openPicker("start")}
          disabled={disabled}
        >
          <Text style={styles.label}>Bắt đầu</Text>
          <Text style={styles.value}>{formatDate(startDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateBtn, disabled && styles.dateBtnDisabled]}
          onPress={() => openPicker("end")}
          disabled={disabled}
        >
          <Text style={styles.label}>Kết thúc</Text>
          <Text style={styles.value}>{formatDate(endDate)}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.range}>Số ngày: {Math.max(0, rangeDays)} / 7</Text>
      <Text style={styles.mealTitle}>Chọn buổi ăn</Text>
      <View style={styles.mealRow}>
        <TouchableOpacity
          style={[styles.mealChip, selectedMeals.breakfast && styles.mealChipActive]}
          onPress={() => toggleMeal("breakfast")}
          disabled={disabled}
        >
          <Text style={[styles.mealChipText, selectedMeals.breakfast && styles.mealChipTextActive]}>Sáng</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mealChip, selectedMeals.lunch && styles.mealChipActive]}
          onPress={() => toggleMeal("lunch")}
          disabled={disabled}
        >
          <Text style={[styles.mealChipText, selectedMeals.lunch && styles.mealChipTextActive]}>Trưa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mealChip, selectedMeals.dinner && styles.mealChipActive]}
          onPress={() => toggleMeal("dinner")}
          disabled={disabled}
        >
          <Text style={[styles.mealChipText, selectedMeals.dinner && styles.mealChipTextActive]}>Tối</Text>
        </TouchableOpacity>
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity
        style={[styles.generateBtn, disabled && styles.dateBtnDisabled]}
        onPress={handleGenerate}
        disabled={disabled}
      >
        <Text style={styles.generateText}>Tạo thực đơn</Text>
      </TouchableOpacity>

      {pickerTarget && Platform.OS !== "web" && (
        <DateTimePicker
          value={pickerTarget === "start" ? startDate : endDate}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onChangeDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#EEF2FF",
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  title: {
    color: "#1E1B4B",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  dateBtnDisabled: {
    opacity: 0.6,
  },
  label: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  value: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "700",
  },
  range: {
    marginTop: 8,
    fontSize: 11,
    color: "#4B5563",
  },
  mealTitle: {
    marginTop: 8,
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "700",
  },
  mealRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  mealChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#C7D2FE",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    paddingVertical: 7,
  },
  mealChipActive: {
    backgroundColor: "#4338CA",
    borderColor: "#4338CA",
  },
  mealChipText: {
    fontSize: 12,
    color: "#3730A3",
    fontWeight: "700",
  },
  mealChipTextActive: {
    color: "#FFFFFF",
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    color: "#991B1B",
  },
  generateBtn: {
    marginTop: 10,
    backgroundColor: "#4F46E5",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  generateText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

