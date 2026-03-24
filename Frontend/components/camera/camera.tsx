import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  API_BASE_URL,
  CAMERA_STREAM_URL,
  getCameraEventHistory,
  getCameraStatus,
  type CameraHistoryEvent,
} from "../../services/api";

const WebView = Platform.OS === "web" ? null : require("react-native-webview").WebView;
const TAB_ACTIVE = "#56328C";
const TAB_INACTIVE = "#A78BFA";

function formatTime(date: Date) {
  return date.toTimeString().slice(0, 5);
}

function formatDate(value?: string | null) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${String(fallback.getDate()).padStart(2, "0")}/${String(
      fallback.getMonth() + 1
    ).padStart(2, "0")}/${fallback.getFullYear()}`;
  }
  return `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(
    2,
    "0"
  )}/${date.getFullYear()}`;
}

function formatEventDateTime(value?: string | null) {
  if (!value) {
    return { date: "--/--/----", time: "--:--:--" };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: "--/--/----", time: "--:--:--" };
  }

  return {
    date: date.toLocaleDateString("vi-VN"),
    time: date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
  };
}

function getEventNote(event?: CameraHistoryEvent | null) {
  if (!event) return "Cảnh báo té ngã";
  if (event.source_type === "left_safe_zone_event") return "Rời khỏi vùng an toàn";
  return "Cảnh báo té ngã";
}

function toAbsoluteImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const normalized = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${API_BASE_URL.replace(/\/$/, "")}${normalized}`;
}

function buildStreamHtml(streamUrl: string, fit: "cover" | "contain") {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
    <style>
      html, body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
      }
      img {
        width: 100%;
        height: 100%;
        object-fit: ${fit};
        display: block;
        background: #000;
      }
    </style>
  </head>
  <body>
    <img src="${streamUrl}" alt="Camera Live" />
  </body>
</html>`;
}

function renderCameraMedia(style: any, fit: "cover" | "contain") {
  if (Platform.OS === "web") {
    return <Image source={{ uri: CAMERA_STREAM_URL }} style={style} resizeMode={fit} />;
  }

  if (!WebView) {
    return (
      <View style={[style, styles.placeholderCamera]}>
        <Ionicons name="videocam-outline" size={48} color="#999" />
        <Text style={styles.placeholderText}>Không hỗ trợ WebView</Text>
      </View>
    );
  }

  return (
    <WebView
      source={{ html: buildStreamHtml(CAMERA_STREAM_URL, fit) }}
      style={style}
      scrollEnabled={false}
      originWhitelist={["*"]}
      mixedContentMode="compatibility"
    />
  );
}

export default function CameraLiveScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [currentTime, setCurrentTime] = useState(formatTime(new Date()));
  const [streamReady, setStreamReady] = useState(false);
  const [fallCount, setFallCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [streamError, setStreamError] = useState<string | null>(null);

  const [history, setHistory] = useState<CameraHistoryEvent[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadStatus = async () => {
      try {
        const status = await getCameraStatus();
        setStreamReady(status.ready);
        setFallCount(status.fallcount);
        setFps(status.fps);
        setStreamError(null);
      } catch {
        setStreamError("Chưa kết nối Camera Service");
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 1500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadHistory = async (firstLoad = false) => {
      if (firstLoad) setHistoryLoading(true);
      try {
        const items = await getCameraEventHistory(20);
        if (!mounted) return;
        setHistory(items);
        setHistoryError(null);
        setSelectedEventId((prev) => {
          if (prev && items.some((item) => item.id === prev)) return prev;
          return items[0]?.id ?? null;
        });
      } catch {
        if (!mounted) return;
        setHistoryError("Chưa tải được lịch sử cảnh báo");
      } finally {
        if (mounted && firstLoad) setHistoryLoading(false);
      }
    };

    loadHistory(true);
    const interval = setInterval(() => loadHistory(false), 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const selectedEvent = useMemo(
    () => history.find((item) => item.id === selectedEventId) ?? history[0] ?? null,
    [history, selectedEventId]
  );

  const selectedEventImage = useMemo(
    () => toAbsoluteImageUrl(selectedEvent?.image_full_url || selectedEvent?.image_url),
    [selectedEvent]
  );

  const goToHome = () => router.replace("/(tabs)");
  const goToStats = () => router.replace("/(tabs)/stats");
  const goToNotifications = () => router.replace("/(tabs)/notifications");
  const goToSettings = () => router.replace("/(tabs)/settings");

  const openFullscreen = () => {
    router.push("/(cameras)/camera-fullscreen");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 15 + insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} />
        </TouchableOpacity>
        <Text style={styles.title}>Camera Live</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cameraBox}>
          <View style={styles.cameraFrame}>
            {renderCameraMedia(styles.camera, "cover")}

            {(streamReady || fallCount > 0) && (
              <View style={styles.overlayBadge}>
                <Text style={styles.overlayText}>FPS: {fps.toFixed(1)}</Text>
                <Text style={[styles.overlayText, fallCount > 0 && styles.fallText]}>
                  Té: {fallCount}
                </Text>
              </View>
            )}

            {!streamReady && !streamError ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Đang tải camera...</Text>
              </View>
            ) : null}
          </View>

          {streamError ? <Text style={styles.streamErrorText}>{streamError}</Text> : null}
        </View>

        <View style={styles.controlRow}>
          <Ionicons name="videocam-outline" size={22} color="#444" />
          <Ionicons name="camera-outline" size={22} color="#444" />
          <TouchableOpacity onPress={openFullscreen} hitSlop={12}>
            <Ionicons name="expand-outline" size={22} color="#444" />
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={18} color="#444" style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{formatDate(selectedEvent?.created_at)}</Text>
          <Ionicons name="chevron-down" size={16} color="#444" />
        </View>

        <View style={styles.historyContainer}>
          {historyLoading ? (
            <View style={styles.emptyHistoryBox}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.emptyHistoryText}>Đang tải lịch sử cảnh báo...</Text>
            </View>
          ) : null}

          {!historyLoading && history.length === 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Ionicons name="images-outline" size={24} color="#9CA3AF" />
              <Text style={styles.emptyHistoryText}>Chưa có lịch sử cảnh báo.</Text>
            </View>
          ) : null}

          {historyError ? <Text style={styles.historyErrorText}>{historyError}</Text> : null}

          {!historyLoading &&
            history.map((item, index) => {
              const isActive = item.id === selectedEvent?.id;
              const eventTime = formatEventDateTime(item.created_at);
              return (
                <TouchableOpacity
                  key={item.id}
                  style={styles.historyItem}
                  activeOpacity={0.85}
                  onPress={() => {
                    setSelectedEventId(item.id);
                    setPreviewVisible(true);
                  }}
                >
                  <Text style={styles.historyTimeLabel}>{eventTime.time.slice(0, 5)}</Text>

                  <View style={styles.historyTimelineColumn}>
                    <View style={[styles.historyDot, isActive && styles.historyDotActive]}>
                      <Ionicons name="person-outline" size={12} color="#6D5EF7" />
                    </View>
                    {index !== history.length - 1 ? <View style={styles.historyLine} /> : null}
                  </View>

                  <View style={styles.historyTextBox}>
                    <Text style={[styles.historyTitle, isActive && styles.historyTitleActive]}>
                      {item.title || "Phát hiện chuyển động!"}
                    </Text>
                    <Text style={styles.historySubText}>{eventTime.time}</Text>
                    <Text style={styles.historyNoteText}>{getEventNote(item)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
        </View>
      </ScrollView>

      <Modal
        visible={previewVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPreviewVisible(false)}
      >
        <View style={styles.previewOverlay}>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <View>
                <Text style={styles.previewTitle}>Chi tiết cảnh báo</Text>
                <Text style={styles.previewDate}>
                  {formatEventDateTime(selectedEvent?.created_at).date}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPreviewVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#374151" />
              </TouchableOpacity>
            </View>

            {selectedEventImage ? (
              <View style={styles.previewImageFrame}>
                <Image
                  source={{ uri: selectedEventImage }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <View style={styles.previewEmptyImage}>
                <Ionicons name="image-outline" size={28} color="#9CA3AF" />
                <Text style={styles.previewEmptyText}>Không có ảnh cho cảnh báo này</Text>
              </View>
            )}

            <View style={styles.previewInfoBox}>
              <Text style={styles.previewNoteText}>Ghi chú: {getEventNote(selectedEvent)}</Text>
              <Text style={styles.previewInfoText}>
                Ngày: {formatEventDateTime(selectedEvent?.created_at).date}
              </Text>
              <Text style={styles.previewInfoText}>
                Thời gian: {formatEventDateTime(selectedEvent?.created_at).time}
              </Text>
            </View>
          </View>
        </View>
      </Modal>

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
    backgroundColor: "#F2F2F2",
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  cameraBox: {
    padding: 10,
    backgroundColor: "#fff",
  },
  cameraFrame: {
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  camera: {
    width: "100%",
    height: 400,
    backgroundColor: "#000",
  },
  placeholderCamera: {
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#666",
  },
  overlayBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    pointerEvents: "none",
  },
  overlayText: {
    fontSize: 12,
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  fallText: {
    color: "#fecaca",
    backgroundColor: "rgba(185,28,28,0.7)",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  loadingText: {
    marginTop: 8,
    color: "#fff",
    fontSize: 12,
  },
  streamErrorText: {
    marginTop: 8,
    color: "#B91C1C",
    fontSize: 12,
  },
  controlRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  dateText: {
    fontSize: 14,
    marginRight: 5,
  },
  historyContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 20,
    minHeight: 260,
  },
  emptyHistoryBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 20,
    gap: 8,
  },
  emptyHistoryText: {
    fontSize: 13,
    color: "#6B7280",
  },
  historyErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 5,
  },
  historyTimeLabel: {
    width: 52,
    fontSize: 15,
    color: "#111827",
    paddingTop: 1,
    fontWeight: "500",
  },
  historyTimelineColumn: {
    width: 24,
    alignItems: "center",
  },
  historyDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#C4B5FD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  historyDotActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#8B5CF6",
  },
  historyLine: {
    width: 1,
    minHeight: 30,
    backgroundColor: "#C4B5FD",
    marginTop: 4,
    flex: 1,
  },
  historyTextBox: {
    flex: 1,
    paddingLeft: 10,
  },
  historyTitle: {
    fontSize: 15,
    color: "#6366F1",
    fontWeight: "500",
  },
  historyTitleActive: {
    color: "#4F46E5",
    fontWeight: "700",
  },
  historySubText: {
    marginTop: 2,
    fontSize: 13,
    color: "#9CA3AF",
  },
  historyNoteText: {
    marginTop: 2,
    fontSize: 12,
    color: "#6B7280",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  previewCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#4F46E5",
  },
  previewDate: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
  },
  previewImage: {
    width: "100%",
    height: 280,
    backgroundColor: "#000",
  },
  previewImageFrame: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  previewEmptyImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  previewEmptyText: {
    marginTop: 8,
    fontSize: 13,
    color: "#6B7280",
  },
  previewInfoBox: {
    marginTop: 12,
    gap: 4,
  },
  previewNoteText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4F46E5",
    marginBottom: 4,
  },
  previewInfoText: {
    fontSize: 14,
    color: "#374151",
  },
  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    height: 75,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderColor: "#E5E7EB",
  },
});