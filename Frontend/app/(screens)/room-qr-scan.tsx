import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import {
  getMyRooms,
  refreshCurrentUserProfile,
  setActiveRoomId,
} from "@/services/api";
import { joinRoomFromParsedQr, parseRoomQrData } from "@/utils/roomQrPayload";

export default function RoomQrScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const processingRef = useRef(false);
  const [torch, setTorch] = useState(false);

  const finishSuccess = useCallback(
    async (
      joinedRoomIdStr: string,
      options?: { serverMessage?: string; alreadyInRoom?: boolean }
    ) => {
      await refreshCurrentUserProfile();
      const rooms = await getMyRooms();
      const matched = rooms.find((r) => r.room_id === joinedRoomIdStr);
      if (matched?.id) {
        setActiveRoomId(matched.id);
      }
      const already = options?.alreadyInRoom === true;
      const title = already ? "Thông báo" : "Thành công";
      const body =
        options?.serverMessage ||
        (already ? "Bạn đã có trong phòng này rồi." : "Bạn đã vào phòng.");
      Alert.alert(title, body, [
        {
          text: "OK",
          onPress: () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/room-access")),
        },
      ]);
    },
    [router]
  );

  const handleBarcode = useCallback(
    async (data: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      try {
        const parsed = parseRoomQrData(data);
        if (parsed.kind === "unknown") {
          Alert.alert(
            "Không nhận diện được mã",
            "Hãy quét QR từ admin (ADMIN_JOIN) hoặc người thân (HOST_JOIN), hoặc mã phòng RM…",
            [{ text: "Đóng", onPress: () => (processingRef.current = false) }]
          );
          return;
        }
        const joined = await joinRoomFromParsedQr(parsed);
        const roomIdStr = joined?.room_id;
        if (!roomIdStr) {
          throw new Error("NO_ROOM");
        }
        const alreadyInRoom =
          (joined as { already_in_room?: boolean }).already_in_room === true;
        await finishSuccess(roomIdStr, {
          serverMessage: (joined as { serverMessage?: string }).serverMessage,
          alreadyInRoom,
        });
      } catch (e: any) {
        const msg =
          e?.response?.data?.message ||
          (e?.code === "INVALID_QR" ? "Mã QR không hợp lệ." : null) ||
          "Không thể tham gia phòng. Vui lòng thử lại.";
        Alert.alert("Lỗi", String(msg), [{ text: "Đóng", onPress: () => (processingRef.current = false) }]);
      } finally {
        setTimeout(() => {
          processingRef.current = false;
        }, 1500);
      }
    },
    [finishSuccess]
  );

  if (Platform.OS === "web") {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.webHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10} accessibilityRole="button">
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.webTitle}>Quét mã vào phòng</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.webBody}>
          <Text style={styles.webText}>
            Trình duyệt không dùng được camera quét QR. Vui lòng dùng app trên điện thoại, hoặc nhập mã tại màn hình
            phân quyền phòng.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/(tabs)/room-access")}>
            <Text style={styles.primaryTxt}>Mở nhập mã thủ công</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={[styles.webHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.webTitle}>Quét mã vào phòng</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.webBody}>
          <Text style={styles.webText}>Cần quyền truy cập camera để quét mã QR.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => void requestPermission()}>
            <Text style={styles.primaryTxt}>Cấp quyền camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => void Linking.openSettings()}>
            <Text style={styles.secondaryTxt}>Mở cài đặt</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={({ data }) => void handleBarcode(data)}
      />
      <SafeAreaView style={styles.overlaySafe} edges={["top"]} pointerEvents="box-none">
        <View style={[styles.topBar, { marginTop: 8 }]}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
          >
            <Ionicons name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.overlayTitle}>Đưa mã QR vào khung</Text>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setTorch((t) => !t)} accessibilityLabel="Đèn flash">
            <Ionicons name={torch ? "flash" : "flash-off"} size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
      </View>
      <View style={[styles.hintBar, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.hint}>QR của admin hoặc người thân (HOST)</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: "#000" },
  camera: { ...StyleSheet.absoluteFillObject },
  safe: { flex: 1, backgroundColor: "#F8FAFC" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  overlaySafe: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTitle: {
    flex: 1,
    textAlign: "center",
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  frameWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  frame: {
    width: 260,
    height: 260,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.85)",
    backgroundColor: "transparent",
  },
  hintBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  hint: {
    color: "#E5E7EB",
    fontSize: 13,
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    overflow: "hidden",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  webHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFF",
  },
  webTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  webBody: { padding: 24, gap: 16 },
  webText: { fontSize: 15, color: "#4B5563", lineHeight: 22 },
  primaryBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryTxt: { color: "#FFF", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryTxt: { color: "#1D4ED8", fontWeight: "700", fontSize: 15 },
});
