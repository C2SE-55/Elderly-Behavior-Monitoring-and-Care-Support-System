import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons } from "@expo/vector-icons";
import {
  API_BASE_URL,
  getCameraEventHistory,
  getCameraLiveAccess,
  getCameraServiceStreamUrl,
  getCameraStatus,
  getActiveRoomId,
  subscribeActiveRoomChange,
  type CameraHistoryEvent,
  type CameraLiveAccessResponse,
} from "../../services/api";
import CameraStreamView from "./CameraStreamView";
const TAB_ACTIVE = "#56328C";
const TAB_INACTIVE = "#A78BFA";
const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primarySoft: "rgba(167,139,250,0.16)",
  primaryBorder: "rgba(167,139,250,0.30)",
  dangerSoft: "rgba(239,68,68,0.12)",
};
const DEMO_ASSET_KEYS = new Set<string>(["video3", "videofall"]);

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

function isFallOrLeftSafeZoneEvent(event?: CameraHistoryEvent | null): boolean {
  if (!event) return false;
  const st = event.source_type;
  // Backward-compat: if the backend doesn't send source_type, treat it as "fall".
  return st === "left_safe_zone_event" || st === "fall_event" || !st;
}

type SafetyFilter = "all" | "fall" | "left_safe_zone";

function safetyKindOf(event?: CameraHistoryEvent | null): "fall" | "left_safe_zone" | null {
  if (!event) return null;
  const st = event.source_type;
  if (st === "left_safe_zone_event") return "left_safe_zone";
  // Backward-compat: missing source_type => treat as fall.
  if (st === "fall_event" || !st) return "fall";
  return null;
}

function toAbsoluteImageUrl(imageUrl?: string | null) {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  const normalized = imageUrl.startsWith("/") ? imageUrl : `/${imageUrl}`;
  return `${API_BASE_URL.replace(/\/$/, "")}${normalized}`;
}

export default function CameraLiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ eventId?: string }>();
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
  const [safetyFilter, setSafetyFilter] = useState<SafetyFilter>("all");
  const [previewVisible, setPreviewVisible] = useState(false);
  const [liveAccess, setLiveAccess] = useState<CameraLiveAccessResponse | null | "loading">("loading");
  const [liveAccessError, setLiveAccessError] = useState<string | null>(null);
  const [activeRoom, setActiveRoom] = useState<number | null>(() => getActiveRoomId());
  const requestedEventId = useMemo(() => {
    const raw = params?.eventId;
    const n = Number(raw || 0);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.eventId]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return subscribeActiveRoomChange((roomId) => {
      setActiveRoom(roomId);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadAccess = async () => {
      const rid = getActiveRoomId();
      setActiveRoom(rid);
      if (!rid) {
        setLiveAccess(null);
        setLiveAccessError(null);
        return;
      }
      setLiveAccess("loading");
      setLiveAccessError(null);
      try {
        const data = await getCameraLiveAccess();
        if (!cancelled) {
          setLiveAccess(data);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setLiveAccess(null);
          const msg =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            "Không tải được quyền xem camera cho room này.";
          setLiveAccessError(msg);
        }
      }
    };

    void loadAccess();
    const t = setInterval(loadAccess, 20000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [activeRoom]);

  const useMjpegFallback =
    liveAccess !== "loading" && liveAccess?.allowed && !liveAccess?.asset_key;

  /** MJPEG lỗi → xem video demo (video3/videofall) để không màn hình đen khi chưa bật Python. */
  const effectiveAssetKey = useMemo(() => {
    if (liveAccess === "loading" || !liveAccess?.allowed) return null;
    if (liveAccess.asset_key) return liveAccess.asset_key;
    if (
      useMjpegFallback &&
      streamError &&
      liveAccess.fallback_asset_key &&
      DEMO_ASSET_KEYS.has(liveAccess.fallback_asset_key)
    ) {
      return liveAccess.fallback_asset_key;
    }
    return null;
  }, [liveAccess, useMjpegFallback, streamError]);

  const showingDemoFallback =
    !!streamError &&
    useMjpegFallback &&
    !!liveAccess &&
    typeof liveAccess === "object" &&
    "allowed" in liveAccess &&
    !!liveAccess.fallback_asset_key &&
    effectiveAssetKey === liveAccess.fallback_asset_key;

  const mjpegStreamUrl = useMemo(() => {
    if (liveAccess === "loading" || !liveAccess?.allowed) {
      return getCameraServiceStreamUrl(null);
    }
    return getCameraServiceStreamUrl(liveAccess.stream_port ?? null);
  }, [liveAccess]);

  useEffect(() => {
    if (!useMjpegFallback) {
      setStreamReady(false);
      setFallCount(0);
      setFps(0);
      setStreamError(null);
      return;
    }
    if (!liveAccess || !liveAccess.allowed) return;

    const access = liveAccess;
    const port = access.stream_port ?? null;

    const loadStatus = async () => {
      try {
        const status = await getCameraStatus(port);
        setStreamReady(status.ready);
        setFallCount(status.fallcount);
        setFps(status.fps);
        setStreamError(null);
      } catch {
        const p = access.stream_port;
        setStreamError(
          p
            ? `Chưa kết nối Camera Service (cổng ${p}). Trên máy dev chạy: AI_Service\\run_camera_room1.ps1`
            : "Chưa kết nối Camera Service. Kiểm tra tiến trình Python và cổng MJPEG."
        );
      }
    };

    loadStatus();
    const interval = setInterval(loadStatus, 1500);
    return () => clearInterval(interval);
  }, [useMjpegFallback, liveAccess]);

  useEffect(() => {
    let mounted = true;

    const cameraIdForHistory =
      liveAccess !== "loading" &&
        liveAccess?.allowed &&
        liveAccess?.camera_id != null &&
        Number(liveAccess.camera_id) > 0
        ? Number(liveAccess.camera_id)
        : null;

    const loadHistory = async (firstLoad = false) => {
      if (firstLoad) setHistoryLoading(true);
      if (!cameraIdForHistory) {
        if (!mounted) return;
        setHistory([]);
        setHistoryError(null);
        if (firstLoad) setHistoryLoading(false);
        return;
      }
      try {
        const items = await getCameraEventHistory(20, cameraIdForHistory);
        if (!mounted) return;
        const safetyItems = items.filter(isFallOrLeftSafeZoneEvent);
        setHistory(safetyItems);
        setHistoryError(null);
        setSelectedEventId((prev) => {
          // If coming from notification with eventId, prefer that.
          if (requestedEventId && safetyItems.some((x) => x.id === requestedEventId)) return requestedEventId;
          if (prev && safetyItems.some((item) => item.id === prev)) return prev;
          return safetyItems[0]?.id ?? null;
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
  }, [activeRoom, liveAccess, requestedEventId]);

  const fallHistory = useMemo(() => history.filter((ev) => safetyKindOf(ev) === "fall"), [history]);
  const leftSafeZoneHistory = useMemo(
    () => history.filter((ev) => safetyKindOf(ev) === "left_safe_zone"),
    [history]
  );
  const flatDisplayHistory = useMemo(() => {
    if (safetyFilter === "fall") return fallHistory;
    if (safetyFilter === "left_safe_zone") return leftSafeZoneHistory;
    return history;
  }, [fallHistory, history, leftSafeZoneHistory, safetyFilter]);

  // Keep selected event visible when user changes filter.
  useEffect(() => {
    setSelectedEventId((prev) => {
      if (prev != null && flatDisplayHistory.some((x) => x.id === prev)) return prev;
      return flatDisplayHistory[0]?.id ?? null;
    });
  }, [flatDisplayHistory]);

  useEffect(() => {
    if (!requestedEventId) return;
    if (!history.length) return;
    if (!history.some((x) => x.id === requestedEventId)) return;
    const ev = history.find((x) => x.id === requestedEventId) ?? null;
    const kind = safetyKindOf(ev);
    if (kind === "fall") setSafetyFilter("fall");
    else if (kind === "left_safe_zone") setSafetyFilter("left_safe_zone");
    setSelectedEventId(requestedEventId);
    setPreviewVisible(true);
  }, [history, requestedEventId]);

  const selectedEvent = useMemo(
    () => history.find((item) => item.id === selectedEventId) ?? history[0] ?? null,
    [history, selectedEventId]
  );

  const selectedEventImage = useMemo(
    () => toAbsoluteImageUrl(selectedEvent?.image_full_url || selectedEvent?.image_url),
    [selectedEvent]
  );

  const goToHome = () => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"));
  const goToStats = () => router.replace("/(tabs)/stats");
  const goToNotifications = () => router.replace("/(tabs)/notifications");
  const goToSettings = () => router.replace("/(tabs)/settings");

  const openFullscreen = () => {
    router.push("/(cameras)/camera-fullscreen");
  };

  const showStreamBlock =
    liveAccess !== "loading" &&
    liveAccess?.allowed &&
    (liveAccess?.asset_key || useMjpegFallback);
  const blockNoRoom = !activeRoom && liveAccess !== "loading";
  const blockDenied = liveAccess !== "loading" && liveAccess && !liveAccess.allowed;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: 15 + insets.top }]}>
        <TouchableOpacity onPress={() => goToHome()} hitSlop={8}>
          <View style={styles.headerIconBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </View>
        </TouchableOpacity>
        <Text style={styles.title}>Camera Live</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cameraBox}>
          <View style={styles.cameraFrame}>
            {liveAccess === "loading" ? (
              <View style={[styles.camera, styles.placeholderCamera]}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={[styles.loadingText, { marginTop: 8 }]}>Đang kiểm tra quyền camera...</Text>
              </View>
            ) : blockNoRoom ? (
              <View style={[styles.camera, styles.placeholderCamera]}>
                <Ionicons name="home-outline" size={40} color="#999" />
                <Text style={styles.placeholderText}>Chọn room hoạt động (tab truy cập room) để xem camera.</Text>
              </View>
            ) : liveAccessError ? (
              <View style={[styles.camera, styles.placeholderCamera]}>
                <Ionicons name="warning-outline" size={40} color="#c2410c" />
                <Text style={styles.placeholderText}>{liveAccessError}</Text>
              </View>
            ) : blockDenied ? (
              <View style={[styles.camera, styles.placeholderCamera]}>
                <Ionicons name="eye-off-outline" size={40} color="#6b7280" />
                <Text style={styles.placeholderText}>
                  {liveAccess?.reason === "host_disabled"
                    ? "Host đã tắt quyền xem camera trực tiếp cho tài khoản của bạn."
                    : "Bạn không có quyền trong room đang chọn. Vào Phân quyền trong Room và chọn đúng phòng (room_id_int)."}
                </Text>
              </View>
            ) : showStreamBlock ? (
              <View style={styles.cameraInner}>
                {showingDemoFallback ? (
                  <View style={styles.demoFallbackBanner} pointerEvents="none">
                    <Text style={styles.demoFallbackText}>
                      Đang xem video demo — bật Camera Service (cổng {liveAccess?.stream_port ?? "?"}) để có luồng
                      AI thật.
                    </Text>
                  </View>
                ) : null}
                <CameraStreamView
                  style={styles.camera}
                  fit="cover"
                  assetKey={effectiveAssetKey}
                  mjpegUrl={mjpegStreamUrl}
                />
              </View>
            ) : (
              <View style={[styles.camera, styles.placeholderCamera]}>
                <Ionicons name="videocam-off-outline" size={40} color="#999" />
                <Text style={styles.placeholderText}>Chưa cấu hình nguồn video cho room này.</Text>
              </View>
            )}

            {useMjpegFallback && (streamReady || fallCount > 0) && (
              <View style={styles.overlayBadge}>
                <Text style={styles.overlayText}>FPS: {fps.toFixed(1)}</Text>
                <Text style={[styles.overlayText, fallCount > 0 && styles.fallText]}>
                  Té: {fallCount}
                </Text>
              </View>
            )}

            {useMjpegFallback && !streamReady && !streamError ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.loadingText}>Đang tải camera...</Text>
              </View>
            ) : null}
          </View>

          {useMjpegFallback && streamError && !showingDemoFallback ? (
            <Text style={styles.streamErrorText}>{streamError}</Text>
          ) : null}
          {useMjpegFallback && streamError && showingDemoFallback ? (
            <Text style={styles.streamHintText}>{streamError}</Text>
          ) : null}
        </View>

        <View style={styles.controlRow}>
          <TouchableOpacity onPress={openFullscreen} hitSlop={12} activeOpacity={0.9} style={styles.controlPill}>
            <Ionicons name="expand-outline" size={18} color={COLORS.primary} />
            <Text style={styles.controlPillText}>Toàn màn hình</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{formatDate(selectedEvent?.created_at)}</Text>
          <Ionicons name="chevron-down" size={16} color={COLORS.sub} />
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

          {!historyLoading && history.length > 0 ? (
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterBtn, safetyFilter === "all" && styles.filterBtnActive]}
                onPress={() => setSafetyFilter("all")}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterBtnText, safetyFilter === "all" && styles.filterBtnTextActive]}>Tất cả</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, safetyFilter === "fall" && styles.filterBtnActive]}
                onPress={() => setSafetyFilter("fall")}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterBtnText, safetyFilter === "fall" && styles.filterBtnTextActive]}>Té ngã</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, safetyFilter === "left_safe_zone" && styles.filterBtnActive]}
                onPress={() => setSafetyFilter("left_safe_zone")}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterBtnText, safetyFilter === "left_safe_zone" && styles.filterBtnTextActive]}>
                  Rời vùng an toàn
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!historyLoading && flatDisplayHistory.length === 0 && history.length > 0 ? (
            <View style={styles.emptyHistoryBox}>
              <Ionicons name="filter-outline" size={22} color="#9CA3AF" />
              <Text style={styles.emptyHistoryText}>Không có dữ liệu phù hợp bộ lọc.</Text>
            </View>
          ) : null}

          {!historyLoading && safetyFilter === "all" ? (
            <>
              <Text style={styles.filterSectionTitle}>Té ngã</Text>
              {fallHistory.map((item, index) => {
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
                      {index !== fallHistory.length - 1 ? <View style={styles.historyLine} /> : null}
                    </View>

                    <View style={styles.historyTextBox}>
                      <Text style={[styles.historyTitle, isActive && styles.historyTitleActive]}>
                        {item.title || getEventNote(item)}
                      </Text>
                      <Text style={styles.historySubText}>{eventTime.time}</Text>
                      <Text style={styles.historyNoteText}>{getEventNote(item)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <Text style={[styles.filterSectionTitle, { marginTop: 10 }]}>Rời khỏi vùng an toàn</Text>
              {leftSafeZoneHistory.map((item, index) => {
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
                      {index !== leftSafeZoneHistory.length - 1 ? <View style={styles.historyLine} /> : null}
                    </View>

                    <View style={styles.historyTextBox}>
                      <Text style={[styles.historyTitle, isActive && styles.historyTitleActive]}>
                        {item.title || getEventNote(item)}
                      </Text>
                      <Text style={styles.historySubText}>{eventTime.time}</Text>
                      <Text style={styles.historyNoteText}>{getEventNote(item)}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </>
          ) : null}

          {!historyLoading && safetyFilter !== "all"
            ? flatDisplayHistory.map((item, index) => {
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
                    {index !== flatDisplayHistory.length - 1 ? <View style={styles.historyLine} /> : null}
                  </View>

                  <View style={styles.historyTextBox}>
                    <Text style={[styles.historyTitle, isActive && styles.historyTitleActive]}>
                      {item.title || getEventNote(item)}
                    </Text>
                    <Text style={styles.historySubText}>{eventTime.time}</Text>
                    <Text style={styles.historyNoteText}>{getEventNote(item)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })
            : null}
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
    backgroundColor: COLORS.bg,
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
    backgroundColor: COLORS.bg,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "900",
    color: COLORS.text,
  },
  cameraBox: {
    padding: 12,
    marginHorizontal: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 4,
  },
  cameraFrame: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#000",
  },
  cameraInner: {
    position: "relative",
  },
  demoFallbackBanner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    backgroundColor: "rgba(180, 83, 9, 0.92)",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  demoFallbackText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  streamHintText: {
    marginTop: 8,
    color: "#92400e",
    fontSize: 11,
    paddingHorizontal: 4,
  },
  camera: {
    width: "100%",
    height: 400,
    backgroundColor: "#000",
  },
  placeholderCamera: {
    backgroundColor: "#0B1220",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 8,
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "700",
    textAlign: "center",
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
    borderRadius: 999,
    fontWeight: "900",
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
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  controlPill: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryBorder,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  controlPillText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
  },
  dateText: {
    fontSize: 14,
    marginRight: 5,
    color: COLORS.text,
    fontWeight: "900",
  },
  historyContainer: {
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingTop: 12,
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
  filterRow: {
    flexDirection: "row",
    paddingVertical: 5,
    paddingHorizontal: 2,
    gap: 8,
  },
  filterBtn: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: "rgba(167,139,250,0.18)",
    borderColor: "rgba(167,139,250,0.55)",
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#475569",
  },
  filterBtnTextActive: {
    color: COLORS.primary,
  },
  filterSectionTitle: {
    marginTop: 7,
    fontSize: 13,
    fontWeight: "900",
    color: "#111827",
    marginBottom: 6,
  },
  historyErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    marginBottom: 8,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    marginBottom: 10,
  },
  historyTimeLabel: {
    width: 52,
    fontSize: 15,
    color: COLORS.text,
    paddingTop: 1,
    fontWeight: "900",
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
    color: COLORS.primary,
    fontWeight: "900",
  },
  historyTitleActive: {
    color: COLORS.primary,
    fontWeight: "900",
  },
  historySubText: {
    marginTop: 2,
    fontSize: 13,
    color: COLORS.sub,
    fontWeight: "700",
  },
  historyNoteText: {
    marginTop: 2,
    fontSize: 12,
    color: "#64748B",
    fontWeight: "600",
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  previewCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  previewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
  },
  previewDate: {
    marginTop: 4,
    color: COLORS.sub,
    fontSize: 13,
    fontWeight: "700",
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
    fontWeight: "900",
    color: COLORS.primary,
    marginBottom: 4,
  },
  previewInfoText: {
    fontSize: 14,
    color: "#334155",
    fontWeight: "700",
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