import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MealKey, MealPlanMeals } from "./mealPlanTypes";

type Props = {
  date: string;
  meals: MealPlanMeals;
  disabled?: boolean;
  applying?: boolean;
  /** Có ít nhất một bữa (có nội dung) còn trong khung giờ áp dụng */
  canApplyDay?: boolean;
  /** Bữa nào đã qua giờ kết thúc (theo ngày trên thẻ) */
  mealPassed?: Record<MealKey, boolean>;
  onChangeMeal: (mealKey: keyof MealPlanMeals, value: string) => void;
  onApplyDay: () => void;
};

export default function MealPlanCard({
  date,
  meals,
  disabled,
  applying,
  canApplyDay = true,
  mealPassed,
  onChangeMeal,
  onApplyDay,
}: Props) {
  const applyBlocked = disabled || applying || !canApplyDay;

  const field = (key: MealKey, label: string, placeholder: string) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, mealPassed?.[key] && styles.inputPassedSlot]}
        value={meals[key]}
        onChangeText={(v) => onChangeMeal(key, v)}
        editable={!disabled}
        placeholder={placeholder}
      />
      {mealPassed?.[key] ? (
        <Text style={styles.passedHint}>Đã qua khung giờ bữa này — không thể áp dụng vào lịch</Text>
      ) : null}
    </View>
  );

  return (
    <View style={styles.card}>
      <Text style={styles.date}>Ngày {date}</Text>

      {field("breakfast", "Bữa sáng", "Món ăn buổi sáng")}
      {field("lunch", "Bữa trưa", "Món ăn buổi trưa")}
      {field("dinner", "Bữa tối", "Món ăn buổi tối")}

      <TouchableOpacity
        style={[styles.applyBtn, applyBlocked && styles.applyBtnDisabled]}
        onPress={onApplyDay}
        disabled={applyBlocked}
      >
        <Text style={styles.applyText}>{applying ? "Đang áp dụng..." : "Áp dụng ngày này"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  date: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 10,
  },
  field: {
    marginBottom: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6B7280",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    fontSize: 13,
    color: "#111827",
  },
  inputPassedSlot: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
    opacity: 0.92,
  },
  passedHint: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
  },
  applyBtn: {
    marginTop: 6,
    backgroundColor: "#059669",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  applyBtnDisabled: {
    opacity: 0.6,
  },
  applyText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});

