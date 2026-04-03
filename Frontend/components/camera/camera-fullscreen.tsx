import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import CameraStreamView from "./CameraStreamView";
import {
  CAMERA_STREAM_URL,
  getActiveRoomId,
  getCameraLiveAccess,
  type CameraLiveAccessResponse,
} from "../../services/api";

export default function CameraFullscreenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [access, setAccess] = useState<CameraLiveAccessResponse | null | "loading">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== "web") {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {});
    }

    return () => {
      if (Platform.OS !== "web") {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!getActiveRoomId()) {
        setAccess(null);
        setMessage("Chưa chọn room.");
        return;
      }
      setAccess("loading");
      setMessage(null);
      try {
        const data = await getCameraLiveAccess();
        if (cancelled) return;
        setAccess(data);
        if (data && !data.allowed) {
          setMessage("Bạn không có quyền xem camera trong room này.");
        }
      } catch {
        if (!cancelled) {
          setAccess(null);
          setMessage("Không tải được quyền xem camera.");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeScreen = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.streamFrame}>
        {access === "loading" ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.hint}>Đang tải...</Text>
          </View>
        ) : message ? (
          <View style={styles.centerBox}>
            <Ionicons name="eye-off-outline" size={48} color="#9ca3af" />
            <Text style={styles.hint}>{message}</Text>
          </View>
        ) : access?.allowed ? (
          <CameraStreamView
            style={styles.stream}
            fit="contain"
            assetKey={access.asset_key}
            mjpegUrl={CAMERA_STREAM_URL}
          />
        ) : (
          <View style={styles.centerBox}>
            <Ionicons name="videocam-off-outline" size={48} color="#9ca3af" />
            <Text style={styles.hint}>Không có luồng video cho room này.</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 10 }]}
        onPress={closeScreen}
        hitSlop={16}
      >
        <Ionicons name="contract-outline" size={22} color="#fff" />
        <Text style={styles.closeText}>Thu nhỏ</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  streamFrame: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
  },
  stream: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  centerBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 12,
  },
  hint: {
    color: "#d1d5db",
    textAlign: "center",
    fontSize: 14,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  closeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },
});
