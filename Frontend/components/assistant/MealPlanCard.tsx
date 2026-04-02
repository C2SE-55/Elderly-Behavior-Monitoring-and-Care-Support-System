import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { MealPlanMeals } from "./mealPlanTypes";

type Props = {
  date: string;
  meals: MealPlanMeals;
  disabled?: boolean;
  applying?: boolean;
  onChangeMeal: (mealKey: keyof MealPlanMeals, value: string) => void;
  onApplyDay: () => void;
};

export default function MealPlanCard({
  date,
  meals,
  disabled,
  applying,
  onChangeMeal,
  onApplyDay,
}: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.date}>Ngay {date}</Text>

      <View style={styles.field}>
        <Text style={styles.label}>Breakfast</Text>
        <TextInput
          style={styles.input}
          value={meals.breakfast}
          onChangeText={(v) => onChangeMeal("breakfast", v)}
          editable={!disabled}
          placeholder="Món ăn buổi sáng"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Lunch</Text>
        <TextInput
          style={styles.input}
          value={meals.lunch}
          onChangeText={(v) => onChangeMeal("lunch", v)}
          editable={!disabled}
          placeholder="Món ăn buổi trưa"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Dinner</Text>
        <TextInput
          style={styles.input}
          value={meals.dinner}
          onChangeText={(v) => onChangeMeal("dinner", v)}
          editable={!disabled}
          placeholder="Món ăn buổi tối"
        />
      </View>

      <TouchableOpacity
        style={[styles.applyBtn, (disabled || applying) && styles.applyBtnDisabled]}
        onPress={onApplyDay}
        disabled={disabled || applying}
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

