import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const PRIMARY = "#4B2E83";

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Thông tin cá nhân</Text>
      </View>

      {/* AVATAR */}
      <View style={styles.avatarWrapper}>
        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39",
          }}
          style={styles.avatar}
        />
      </View>

      {/* FORM */}
      <View style={styles.form}>
        {renderInput("Full Name", "Nguyen Van A")}
        {renderInput("Username", "nguyenvana123")}
        {renderInput("Email", "vana@gmail.com")}
        {renderInput("Phone Number", "0392223332")}
        {renderInput("Password", "*************", true)}
        {renderInput("Confirm Password", "*************", true)}

        <Text style={styles.label}>Role</Text>
        <View style={styles.roleBox}>
          <Text style={styles.roleText}>Người chăm sóc</Text>
        </View>

        <TouchableOpacity style={styles.updateBtn}>
          <Text style={styles.updateText}>Cập Nhật</Text>
        </TouchableOpacity>
      </View>

      {/* BOTTOM TAB */}
      <View style={styles.bottomTab}>
        <MaterialIcons name="dashboard" size={24} color="#8E8EFF" />
        <Feather name="bar-chart-2" size={24} color="#8E8EFF" />
        <Ionicons name="notifications-outline" size={24} color="#8E8EFF" />
        <Ionicons name="settings-outline" size={24} color="#8E8EFF" />
      </View>
    </SafeAreaView>
  );
}

/* ========= HELPER RENDER INPUT ========= */

const renderInput = (
  label: string,
  value: string,
  secure: boolean = false
) => (
  <>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      secureTextEntry={secure}
      editable={false}
    />
  </>
);

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2",
  },

  header: {
    backgroundColor: PRIMARY,
    height: 110,
    justifyContent: "center",
    alignItems: "center",
  },

  backBtn: {
    position: "absolute",
    left: 15,
    top: 50,
  },

  headerTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
    marginTop: 40,
  },

  avatarWrapper: {
    alignItems: "center",
    marginTop: -40,
    marginBottom: 10,
  },

  avatar: {
    width: 90,
    height: 90,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: "white",
  },

  form: {
    paddingHorizontal: 20,
  },

  label: {
    fontSize: 13,
    marginTop: 12,
    marginBottom: 6,
    color: "#333",
  },

  input: {
    backgroundColor: "#EDEDED",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 45,
    fontSize: 14,
    color: "#555",
  },

  roleBox: {
    backgroundColor: "#CFCFCF",
    borderRadius: 8,
    height: 45,
    justifyContent: "center",
    paddingHorizontal: 12,
  },

  roleText: {
    color: "#444",
    fontSize: 14,
  },

  updateBtn: {
    backgroundColor: PRIMARY,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
  },

  updateText: {
    color: "white",
    fontSize: 15,
    fontWeight: "600",
  },

  bottomTab: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    height: 65,
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#eee",
  },
});