import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { getCurrentUser } from "@/services/api";

export default function SettingsScreen() {
  const router = useRouter();
  const user = getCurrentUser() as { role?: string } | null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Cài đặt</Text>
      <Text style={styles.meta}>Role: {String(user?.role || "user").toUpperCase()}</Text>
      <TouchableOpacity style={styles.btn} onPress={() => router.push("/(screens)/room-access")}>
        <Text style={styles.btnTxt}>Quản lý room & phân quyền</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7FB",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  text: {
    fontSize: 18,
    fontWeight: "600",
  },
  meta: { fontSize: 13, color: "#6B7280" },
  btn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  btnTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 13 },
});

