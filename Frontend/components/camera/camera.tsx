import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Dimensions,
  Platform,
  Image,
  Modal,
  useWindowDimensions
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import { CAMERA_STREAM_URL, getCameraStatus } from "../../services/api";

// WebView chỉ dùng trên iOS/Android; trên web dùng Image/iframe
const WebView = Platform.OS === "web" ? null : require("react-native-webview").WebView;

const TIMELINE_TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"];
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const TAB_ACTIVE = "#56328C";
const TAB_INACTIVE = "#A78BFA";

function formatTime(date: Date) {
  return date.toTimeString().slice(0, 5);
}

export default function CameraLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const [playPositionPercent, setPlayPositionPercent] = useState(30);
  const [streamReady, setStreamReady] = useState(false);
  const [fallCount, setFallCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const gestureStartPercent = useRef(30);
  const gestureStartX = useRef(0);
  const latestPercentRef = useRef(30);
  latestPercentRef.current = playPositionPercent;

  useEffect(() => {
    const t = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Poll trạng thái AI (fall count, FPS) từ Camera Service - quét tự động và liên tục
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await getCameraStatus();
        setStreamReady(status.ready);
        setFallCount(status.fallcount);
        setFps(status.fps);
        setStreamError(null);
      } catch {
        setStreamError("Chưa kết nối Camera Service");
      }
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (ev) => {
          gestureStartPercent.current = latestPercentRef.current;
          gestureStartX.current = ev.nativeEvent.pageX;
        },
        onPanResponderMove: (ev) => {
          const dx = ev.nativeEvent.pageX - gestureStartX.current;
          const deltaPercent = (dx / SCREEN_WIDTH) * 100;
          const next = Math.min(100, Math.max(0, gestureStartPercent.current + deltaPercent));
          setPlayPositionPercent(next);
        },
        onPanResponderRelease: () => {},
        onPanResponderTerminate: () => {}
      }),
    []
  );

  const goToHome = () => router.replace("/(tabs)");
  const goToStats = () => router.replace("/(tabs)/stats");
  const goToNotifications = () => router.replace("/(tabs)/notifications");
  const goToSettings = () => router.replace("/(tabs)/settings");

  return (
    <View style={styles.container}>
      
      {/* HEADER - không đụng phần giờ/pin */}
      <View style={[styles.header, { paddingTop: 15 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Camera Live</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* CAMERA PREVIEW - stream từ AI_Service/Camera_Service (pose + fall detection), quét tự động liên tục */}
      <View style={styles.cameraBox}>
        {Platform.OS === "web" ? (
          <Image
            source={{ uri: CAMERA_STREAM_URL }}
            style={styles.camera}
            resizeMode="cover"
          />
        ) : WebView ? (
          <WebView
            source={{
              html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#000"><img src="${CAMERA_STREAM_URL}" style="width:100%;height:100%;object-fit:contain" alt="Live"/></body></html>`
            }}
            style={styles.camera}
            scrollEnabled={false}
            originWhitelist={["*"]}
            mixedContentMode="compatibility"
          />
        ) : (
          <View style={[styles.camera, styles.placeholderCamera]}>
            <Ionicons name="videocam-outline" size={48} color="#999" />
            <Text style={styles.placeholderText}>Không hỗ trợ WebView</Text>
          </View>
        )}
        {(streamReady || fallCount > 0) && (
          <View style={styles.overlayBadge}>
            <Text style={styles.overlayText}>FPS: {fps}</Text>
            <Text style={[styles.overlayText, fallCount > 0 && styles.fallText]}>
              Té: {fallCount}
            </Text>
          </View>
        )}
        {streamError && (
          <View style={styles.overlayBadge}>
            <Text style={styles.errorText}>{streamError}</Text>
          </View>
        )}
      </View>

      {/* CONTROL BAR */}
      <View style={styles.controlRow}>
        <Ionicons name="videocam-outline" size={22} color="#444" />
        <Ionicons name="camera-outline" size={22} color="#444" />
        <TouchableOpacity onPress={() => setIsFullscreen(true)} hitSlop={12}>
          <Ionicons name="expand-outline" size={22} color="#444" />
        </TouchableOpacity>
      </View>

      {/* MODAL PHÓNG TO TOÀN MÀN HÌNH */}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsFullscreen(false)}
      >
        <View style={[styles.fullscreenOverlay, { width: winWidth, height: winHeight }]}>
          <View style={styles.fullscreenStream}>
            {Platform.OS === "web" ? (
              <Image
                source={{ uri: CAMERA_STREAM_URL }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
              />
            ) : WebView ? (
              <WebView
                source={{
                  html: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body style="margin:0;background:#000"><img src="${CAMERA_STREAM_URL}" style="width:100%;height:100%;object-fit:contain" alt="Live"/></body></html>`
                }}
                style={StyleSheet.absoluteFill}
                scrollEnabled={false}
                originWhitelist={["*"]}
                mixedContentMode="compatibility"
              />
            ) : null}
          </View>
          <TouchableOpacity
            style={[styles.fullscreenClose, { top: insets.top + 10 }]}
            onPress={() => setIsFullscreen(false)}
            hitSlop={16}
          >
            <Ionicons name="contract-outline" size={28} color="#fff" />
            <Text style={styles.fullscreenCloseText}>Thu nhỏ</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* DATE */}
      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={18} color="#444" style={{ marginRight: 6 }} />
        <Text style={styles.dateText}>02/2026</Text>
        <Ionicons name="chevron-down" size={16} color="#444" />
      </View>

      {/* TIMELINE cố định - chỉ kéo thanh dọc */}
      <View style={styles.timelineContainer}>
        <View style={styles.timelineInner}>
          <View style={styles.timeLabelsRow}>
            {TIMELINE_TIMES.map((t) => (
              <Text key={t} style={styles.timeLabel}>{t}</Text>
            ))}
          </View>
          <View style={styles.axisRow}>
            <View style={styles.axisLine} />
            <View style={styles.ticksRow}>
              {[...Array(24)].map((_, i) => (
                <View key={i} style={styles.axisTick} />
              ))}
            </View>
          </View>
          <View style={[styles.durationBar, { width: `${playPositionPercent}%` }]} />
          <View
            style={[styles.playLineHitArea, { left: `${playPositionPercent}%` }]}
            {...panResponder.panHandlers}
          >
            <View style={styles.playLine} />
          </View>
        </View>
      </View>

      {/* EMPTY AREA */}
      <View style={{ flex: 1 }} />

      {/* BOTTOM NAV - đồng bộ với tab bar chính */}
      <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity onPress={goToHome} hitSlop={8}>
          <Feather name="grid" size={26} color={TAB_INACTIVE} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToStats} hitSlop={8}>
          <Feather name="bar-chart-2" size={26} color={TAB_ACTIVE} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToNotifications} hitSlop={8}>
          <Ionicons name="notifications-outline" size={26} color={TAB_INACTIVE} />
        </TouchableOpacity>
        <TouchableOpacity onPress={goToSettings} hitSlop={8}>
          <Ionicons name="settings-outline" size={26} color={TAB_INACTIVE} />
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F2"
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee"
  },

  title: {
    fontSize: 16,
    fontWeight: "600"
  },

  cameraBox: {
    padding: 10,
    backgroundColor: "#fff"
  },

  camera: {
    width: "100%",
    height: 180,
    borderRadius: 6
  },

  placeholderCamera: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center"
  },

  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666"
  },

  overlayBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    pointerEvents: "none"
  },

  overlayText: {
    fontSize: 12,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },

  fallText: {
    color: "#fecaca",
    backgroundColor: "rgba(185,28,28,0.7)"
  },

  errorText: {
    fontSize: 11,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },

  fullscreenOverlay: {
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center"
  },

  fullscreenStream: {
    ...StyleSheet.absoluteFillObject
  },

  fullscreenClose: {
    position: "absolute",
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8
  },

  fullscreenCloseText: {
    color: "#fff",
    fontSize: 14,
    marginLeft: 6
  },

  controlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee"
  },

  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#fff"
  },

  dateText: {
    fontSize: 14,
    marginRight: 5
  },

  realtimeBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#e0e7ff"
  },

  realtimeText: {
    fontSize: 14,
    color: "#2563eb",
    fontWeight: "600",
    marginLeft: 8
  },

  timelineContainer: {
    minHeight: 78,
    paddingVertical: 10,
    backgroundColor: "#f5f5f5",
    justifyContent: "center"
  },

  timelineInner: {
    alignSelf: "center",
    width: 360,
    paddingHorizontal: 8,
    position: "relative"
  },

  timeLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingHorizontal: 2
  },

  timeLabel: {
    fontSize: 11,
    color: "#666"
  },

  axisRow: {
    position: "relative",
    height: 20,
    justifyContent: "center"
  },

  axisLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "#ddd"
  },

  ticksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    position: "absolute",
    left: 0,
    right: 0
  },

  axisTick: {
    width: 1,
    height: 8,
    backgroundColor: "#ccc"
  },

  durationBar: {
    position: "absolute",
    left: 12,
    top: 48,
    height: 6,
    backgroundColor: "#2563eb",
    borderRadius: 3
  },

  playLineHitArea: {
    position: "absolute",
    width: 32,
    marginLeft: -16,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2
  },

  playLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 1
  },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 75,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderColor: "#E5E7EB"
  }
});