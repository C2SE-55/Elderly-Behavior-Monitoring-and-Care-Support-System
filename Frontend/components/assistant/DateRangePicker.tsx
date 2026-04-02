import React, { useMemo, useState } from "react";
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import { MealKey } from "./mealPlanTypes";

type Props = {
  disabled?: boolean;
  onGenerate: (startDate: string, endDate: string, meals: MealKey[]) => void;
};

const MAX_RANGE_DAYS = 7;

type PickerTarget = "start" | "end" | null;

const formatIsoDate = (date: Date) => dayjs(date).format("YYYY-MM-DD");
const formatDisplayDate = (date: Date) => dayjs(date).locale("vi").format("DD/MM/YYYY");
const formatWeekday = (date: Date) => dayjs(date).locale("vi").format("ddd").toUpperCase();

export default function DateRangePicker({ disabled, onGenerate }: Props) {
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [draftDate, setDraftDate] = useState<Date>(new Date());
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
      const raw = typeof window !== "undefined" ? window.prompt("Nhập ngày (YYYY-MM-DD)", formatIsoDate(current)) : "";
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
    const current = target === "start" ? startDate : endDate;
    setDraftDate(current);
    setPickerTarget(target);
  };

  const onChangeDate = (event: DateTimePickerEvent, selected?: Date) => {
    if (!pickerTarget) return;
    if (event.type === "dismissed" || !selected) return;
    if (Platform.OS === "android") {
      // Android calendar returns final selection immediately
      if (pickerTarget === "start") setStartDate(selected);
      if (pickerTarget === "end") setEndDate(selected);
      setError("");
      setPickerTarget(null);
      return;
    }
    // iOS: keep as draft until user taps "Xong"
    setDraftDate(selected);
  };

  const closePicker = () => setPickerTarget(null);
  const applyPicker = () => {
    if (!pickerTarget) return;
    if (pickerTarget === "start") setStartDate(draftDate);
    if (pickerTarget === "end") setEndDate(draftDate);
    setError("");
    setPickerTarget(null);
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
          <View style={styles.dateTopRow}>
            <Text style={styles.label}>Bắt đầu</Text>
            <Text style={styles.weekday}>{formatWeekday(startDate)}</Text>
          </View>
          <Text style={styles.value}>{formatDisplayDate(startDate)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dateBtn, disabled && styles.dateBtnDisabled]}
          onPress={() => openPicker("end")}
          disabled={disabled}
        >
          <View style={styles.dateTopRow}>
            <Text style={styles.label}>Kết thúc</Text>
            <Text style={styles.weekday}>{formatWeekday(endDate)}</Text>
          </View>
          <Text style={styles.value}>{formatDisplayDate(endDate)}</Text>
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

      {pickerTarget && Platform.OS !== "web" && Platform.OS !== "ios" && (
        <DateTimePicker
          {...({
            value: pickerTarget === "start" ? startDate : endDate,
            mode: "date",
            display: "calendar",
            onChange: onChangeDate,
            locale: "vi-VN",
          } as any)}
        />
      )}

      {pickerTarget && Platform.OS === "ios" && (
        <Modal transparent animationType="fade" onRequestClose={closePicker}>
          <View style={styles.pickerBackdrop}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{pickerTarget === "start" ? "Chọn ngày bắt đầu" : "Chọn ngày kết thúc"}</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity onPress={closePicker} hitSlop={10}>
                    <Text style={styles.pickerBtn}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={applyPicker} hitSlop={10}>
                    <Text style={[styles.pickerBtn, styles.pickerBtnPrimary]}>Xong</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <DateTimePicker
                {...({
                  value: draftDate,
                  mode: "date",
                  display: "spinner",
                  onChange: onChangeDate,
                  style: styles.iosPicker,
                  textColor: "#111827",
                  themeVariant: "light",
                  locale: "vi-VN",
                } as any)}
              />
            </View>
          </View>
        </Modal>
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
    fontWeight: "800",
  },
  dateTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekday: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4338CA",
    backgroundColor: "#EEF2FF",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  value: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "900",
  },
  range: {
    marginTop: 8,
    fontSize: 11,
    color: "#4B5563",
    fontWeight: "700",
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

  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  pickerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  pickerTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#111827",
    flex: 1,
    marginRight: 10,
  },
  pickerBtn: {
    fontSize: 13,
    fontWeight: "900",
    color: "#6B7280",
  },
  pickerBtnPrimary: {
    color: "#4F46E5",
  },
  iosPicker: {
    alignSelf: "center",
  },
});

