import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

type Props = {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export default function ApplyMealPlanButton({ disabled, loading, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, (disabled || loading) && styles.buttonDisabled]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      <Text style={styles.text}>{loading ? "Dang ap dung..." : "Ap dung vao lich"}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 12,
    backgroundColor: "#2563EB",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});

