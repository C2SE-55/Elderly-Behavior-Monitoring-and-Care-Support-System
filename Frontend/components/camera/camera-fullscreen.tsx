import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ScreenOrientation from "expo-screen-orientation";
import { CAMERA_STREAM_URL } from "../../services/api";

const WebView = Platform.OS === "web" ? null : require("react-native-webview").WebView;

export default function CameraFullscreenScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

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

  const closeScreen = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.streamFrame}>
        {Platform.OS === "web" ? (
          <Image source={{ uri: CAMERA_STREAM_URL }} style={styles.stream} resizeMode="contain" />
        ) : WebView ? (
          <WebView
            source={{ uri: CAMERA_STREAM_URL }}
            style={styles.stream}
            scrollEnabled={false}
            originWhitelist={["*"]}
            mixedContentMode="compatibility"
          />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="videocam-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>Không hỗ trợ WebView</Text>
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
  },
  stream: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000",
  },
  placeholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#ccc",
  },
  closeButton: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 6,
  },
});
