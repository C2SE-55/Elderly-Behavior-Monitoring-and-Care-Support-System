import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import {
  createDailySchedule,
  DailyScheduleItem,
  DailyScheduleType,
  deleteDailySchedule,
  getDailySchedules,
  getMyRoom,
  MyRoomInfo,
  getServerTime,
  updateDailySchedule,
} from "@/services/api";
import { subscribeScheduleRefresh } from "@/services/scheduleEvents";
import ScheduleModal from "./ScheduleModal";
import TimeSlotCell from "./TimeSlotCell";
import { useMealToast } from "./NotificationService";

type DayKey = DailyScheduleItem["day_of_week"];
type SlotKey = "morning" | "noon" | "afternoon" | "evening";

const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Thứ 2" },
  { key: "tue", label: "Thứ 3" },
  { key: "wed", label: "Thứ 4" },
  { key: "thu", label: "Thứ 5" },
  { key: "fri", label: "Thứ 6" },
  { key: "sat", label: "Thứ 7" },
  { key: "sun", label: "Chủ nhật" },
];

const DAY_INDEX: Record<DayKey, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const SLOT_CONFIG: { key: SlotKey; label: string; start: string; end: string }[] = [
  { key: "morning", label: "Sáng\n06:00 - 11:00", start: "06:00", end: "11:00" },
  { key: "noon", label: "Trưa\n11:00 - 14:00", start: "11:00", end: "14:00" },
  { key: "afternoon", label: "Chiều\n14:00 - 18:00", start: "14:00", end: "18:00" },
  { key: "evening", label: "Tối\n18:00 - 22:00", start: "18:00", end: "22:00" },
];

const TYPE_FILTERS: { key: "all" | DailyScheduleType; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "meal", label: "Ăn uống" },
  { key: "exercise", label: "Vận động" },
  { key: "rest", label: "Nghỉ ngơi" },
  { key: "other", label: "Khác" },
];

const MOCK_DATA: DailyScheduleItem[] = [
  {
    id: -1,
    profile_id: 0,
    day_of_week: "mon",
    title: "Đi bộ nhẹ",
    description: "20 phút quanh sân",
    start_time: "06:30:00",
    end_time: "07:00:00",
    type: "exercise",
  },
  {
    id: -2,
    profile_id: 0,
    day_of_week: "mon",
    title: "Bữa sáng",
    description: "Cháo + sữa",
    start_time: "07:30:00",
    end_time: "08:00:00",
    type: "meal",
  },
];

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.slice(0, 5).split(":").map((x) => Number(x));
  return (h || 0) * 60 + (m || 0);
};

const normalizeHHMM = (value: string) => String(value || "").slice(0, 5);

const getSlotByTime = (startTime: string): SlotKey | null => {
  const minute = toMinutes(normalizeHHMM(startTime));
  for (const slot of SLOT_CONFIG) {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (minute >= start && minute < end) return slot.key;
  }
  return null;
};

const getCurrentDayKey = (now: dayjs.Dayjs): DayKey => {
  const d = now.day();
  if (d === 0) return "sun";
  if (d === 1) return "mon";
  if (d === 2) return "tue";
  if (d === 3) return "wed";
  if (d === 4) return "thu";
  if (d === 5) return "fri";
  return "sat";
};

const getCurrentSlotKey = (now: dayjs.Dayjs): SlotKey | null => {
  const minute = now.hour() * 60 + now.minute();
  for (const slot of SLOT_CONFIG) {
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (minute >= start && minute < end) return slot.key;
  }
  return null;
};

const getMonday = (base: dayjs.Dayjs, weekOffset = 0) => {
  const jsDay = base.day();
  const diffFromMonday = (jsDay + 6) % 7;
  return base.startOf("day").subtract(diffFromMonday, "day").add(weekOffset, "week");
};

const isSameWeekAs = (dateIso: string | undefined, weekStart: dayjs.Dayjs) => {
  if (!dateIso) return false;
  const d = dayjs(dateIso);
  if (!d.isValid()) return false;
  const start = weekStart.startOf("day");
  const end = weekStart.add(6, "day").endOf("day");
  return d.isAfter(start.subtract(1, "millisecond")) && d.isBefore(end.add(1, "millisecond"));
};

export default function WeeklyCalendarScreen() {
  const router = useRouter();
  const { showMealToast, toast } = useMealToast();

  const [loading, setLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [screenError, setScreenError] = useState("");
  const [permissionMessage, setPermissionMessage] = useState("");
  const [roomInfo, setRoomInfo] = useState<MyRoomInfo | null>(null);
  const [canReadRoomData, setCanReadRoomData] = useState(false);
  const [canManageSchedule, setCanManageSchedule] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [schedules, setSchedules] = useState<DailyScheduleItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | DailyScheduleType>("all");
  const [modalVisible, setModalVisible] = useState(false);
  const [modalDay, setModalDay] = useState<DayKey>("mon");
  const [editingItem, setEditingItem] = useState<DailyScheduleItem | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(dayjs());
  const notifiedRef = useRef<Record<string, true>>({});

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      if (Platform.OS === "web") return;
      try {
        const perms = await Notifications.getPermissionsAsync();
        let status = perms.status;
        if (status !== "granted") {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== "granted") {
          setScreenError("Chưa cấp quyền thông báo nên không thể push notification.");
          return;
        }
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("weekly-schedule", {
            name: "Weekly Schedule",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
          });
        }
      } catch {
        // keep silent; toast in-app still works
      }
    };
    setupNotifications();
  }, []);

  const loadPermissions = useCallback(async () => {
    try {
      setPermissionLoading(true);
      const room = await getMyRoom();
      setRoomInfo(room);
      if (!room) {
        setCanReadRoomData(false);
        setCanManageSchedule(false);
        setPermissionMessage("Bạn chưa tham gia room. Hãy join room trước khi dùng lịch sinh hoạt.");
        return;
      }
      const isHost = room.member_role === "host";
      setCanReadRoomData(true);
      setCanManageSchedule(isHost);
      setPermissionMessage(isHost ? "" : "Bạn đang ở chế độ chỉ xem lịch (CAREGIVER).");
    } catch {
      setCanReadRoomData(false);
      setCanManageSchedule(false);
      setPermissionMessage("Không tải được quyền truy cập room.");
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  const syncServerNow = useCallback(async () => {
    try {
      const serverIso = await getServerTime();
      setNow(dayjs(serverIso));
    } catch {
      setNow(dayjs());
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    if (!canReadRoomData) {
      setSchedules([]);
      setUsingMock(false);
      return;
    }
    try {
      setLoading(true);
      setScreenError("");
      const rows = await getDailySchedules();
      setSchedules(rows);
      setUsingMock(false);
    } catch (error) {
      const statusCode = (error as any)?.response?.status;
      const backendMessage = (error as any)?.response?.data?.message;
      if (statusCode === 404) {
        setScreenError("Backend chưa nạp route daily-schedules (404). Hãy restart backend rồi thử lại.");
      } else if (statusCode === 401) {
        setScreenError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
      } else {
        setScreenError(backendMessage || "Không tải được lịch sinh hoạt, đang dùng dữ liệu mẫu.");
      }
      setSchedules(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [canReadRoomData]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    loadSchedules();
    syncServerNow();
  }, [loadSchedules, syncServerNow]);

  useEffect(() => {
    const unsubscribe = subscribeScheduleRefresh(() => {
      void loadSchedules();
    });
    return unsubscribe;
  }, [loadSchedules]);

  useEffect(() => {
    if (!screenError) return;
    const t = setTimeout(() => setScreenError(""), 5000);
    return () => clearTimeout(t);
  }, [screenError]);

  const weekStart = useMemo(() => getMonday(now, weekOffset), [now, weekOffset]);
  const weekEnd = useMemo(() => weekStart.add(6, "day"), [weekStart]);

  const schedulesInSelectedWeek = useMemo(
    () =>
      schedules.filter((item) => {
        // Không có created_at thì chỉ hiển thị ở tuần hiện tại để tránh "dính" qua tuần khác.
        if (!item.created_at) return weekOffset === 0;
        return isSameWeekAs(item.created_at, weekStart);
      }),
    [schedules, weekOffset, weekStart]
  );

  const filteredSchedules = useMemo(() => {
    if (filterType === "all") return schedulesInSelectedWeek;
    return schedulesInSelectedWeek.filter((item) => item.type === filterType);
  }, [filterType, schedulesInSelectedWeek]);

  const profileId = useMemo(() => schedules[0]?.profile_id, [schedules]);
  const currentDay = getCurrentDayKey(now);
  const currentSlot = getCurrentSlotKey(now);

  const getDateForDay = useCallback(
    (dayKey: DayKey) => weekStart.add(DAY_INDEX[dayKey], "day"),
    [weekStart]
  );

  const isPastDateTime = useCallback(
    (dayKey: DayKey, hhmm: string) => {
      if (weekOffset < 0) return true;
      if (weekOffset > 0) return false;
      const [h, m] = normalizeHHMM(hhmm).split(":").map((x) => Number(x));
      const target = getDateForDay(dayKey).hour(h || 0).minute(m || 0).second(0);
      return target.isBefore(now);
    },
    [getDateForDay, now, weekOffset]
  );

  const isPastSlot = useCallback(
    (dayKey: DayKey, slotKey: SlotKey) => {
      const slot = SLOT_CONFIG.find((s) => s.key === slotKey);
      if (!slot) return false;
      return isPastDateTime(dayKey, slot.end);
    },
    [isPastDateTime]
  );

  const isPastSchedule = useCallback(
    (item: DailyScheduleItem) => isPastDateTime(item.day_of_week, String(item.end_time)),
    [isPastDateTime]
  );

  const getCellSchedules = (dayKey: DayKey, slotKey: SlotKey) =>
    filteredSchedules.filter((item) => item.day_of_week === dayKey && getSlotByTime(item.start_time) === slotKey);

  const checkStartNotifications = useCallback(
    (refNow: dayjs.Dayjs, source: DailyScheduleItem[]) => {
      const currentDayKey = getCurrentDayKey(refNow);
      const hhmm = refNow.format("HH:mm");
      const dateKey = refNow.format("YYYY-MM-DD");

      source.forEach((item) => {
        if (item.day_of_week !== currentDayKey) return;
        if (normalizeHHMM(item.start_time) !== hhmm) return;
        const key = `${dateKey}-${item.id}`;
        if (notifiedRef.current[key]) return;
        notifiedRef.current[key] = true;
        const heading = item.type === "meal" ? "Đã tới giờ ăn!" : "Đến giờ sinh hoạt";
        showMealToast({
          heading,
          title: item.title,
          description: item.description,
        });
        if (Platform.OS !== "web") {
          Notifications.scheduleNotificationAsync({
            content: {
              title: heading,
              body: item.description ? `${item.title} - ${item.description}` : item.title,
              sound: true,
            },
            trigger: null,
          }).catch(() => {});
        }
      });
    },
    [showMealToast]
  );

  useEffect(() => {
    const timer = setInterval(async () => {
      await syncServerNow();
      await loadSchedules();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [loadSchedules, syncServerNow]);

  useEffect(() => {
    checkStartNotifications(now, schedules);
  }, [checkStartNotifications, now, schedules]);

  const handleAdd = (dayKey: DayKey) => {
    if (!canManageSchedule) {
      setScreenError("Bạn chỉ có quyền xem lịch.");
      return;
    }
    setModalDay(dayKey);
    setEditingItem(null);
    setModalVisible(true);
  };

  const handleEdit = (item: DailyScheduleItem) => {
    if (!canManageSchedule) {
      setScreenError("Bạn chỉ có quyền xem lịch.");
      return;
    }
    if (isPastSchedule(item)) {
      setScreenError("Lịch đã qua thời gian, không thể chỉnh sửa.");
      return;
    }
    setModalDay(item.day_of_week);
    setEditingItem(item);
    setModalVisible(true);
  };

  const handleDelete = (item: DailyScheduleItem) => {
    if (!canManageSchedule) {
      setScreenError("Bạn chỉ có quyền xem lịch.");
      return;
    }
    if (item.id < 0) {
      setScreenError("Đang dùng dữ liệu mẫu, không thể xóa.");
      return;
    }
    if (isPastSchedule(item)) {
      setScreenError("Lịch đã qua thời gian, không thể xóa.");
      return;
    }
    const doDelete = async () => {
      try {
        setScreenError("");
        await deleteDailySchedule(item.id);
        await loadSchedules();
      } catch (error) {
        const backendMessage = (error as any)?.response?.data?.message;
        setScreenError(backendMessage || "Không thể xóa lịch.");
      }
    };

    if (Platform.OS === "web") {
      const ok = typeof window !== "undefined" ? window.confirm(`Xóa "${item.title}"?`) : false;
      if (ok) {
        void doDelete();
      }
      return;
    }

    Alert.alert("Xóa lịch", `Xóa "${item.title}"?`, [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: () => void doDelete() },
    ]);
  };

  const handleSubmitModal = async (payload: {
    day_of_week: DayKey;
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    type: DailyScheduleType;
  }) => {
    try {
      if (!canManageSchedule) {
        setScreenError("Bạn chỉ có quyền xem lịch.");
        return;
      }
      if (isPastDateTime(payload.day_of_week, payload.end_time)) {
        setScreenError("Không thể thêm/sửa lịch ở thời gian quá khứ.");
        return;
      }

      setScreenError("");
      if (editingItem) {
        await updateDailySchedule(editingItem.id, payload);
      } else {
        await createDailySchedule({
          ...payload,
          profile_id: profileId,
        });
      }
      setModalVisible(false);
      setEditingItem(null);
      await loadSchedules();
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không thể lưu lịch sinh hoạt.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {toast}
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý lịch sinh hoạt theo tuần</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Quay lại</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekNavRow}>
        <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset((w) => w - 1)}>
          <Text style={styles.weekBtnText}>Tuần trước</Text>
        </TouchableOpacity>
        <Text style={styles.weekText}>
          {weekStart.format("DD/MM")} - {weekEnd.format("DD/MM")}
        </Text>
        <View style={styles.weekActionsRight}>
          <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset(0)}>
            <Text style={styles.weekBtnText}>Hôm nay</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset((w) => w + 1)}>
            <Text style={styles.weekBtnText}>Tuần sau</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!screenError && <Text style={styles.errorText}>{screenError}</Text>}
      {!!permissionMessage && <Text style={styles.warnText}>{permissionMessage}</Text>}
      {!!roomInfo?.room_id && <Text style={styles.roomText}>Room: {roomInfo.room_id}</Text>}
      {usingMock && <Text style={styles.mockText}>Đang dùng dữ liệu mẫu fallback.</Text>}
      {permissionLoading && <Text style={styles.mockText}>Đang kiểm tra quyền trong room...</Text>}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap}>
        {TYPE_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filterType === f.key && styles.filterChipActive]}
            onPress={() => setFilterType(f.key)}
          >
            <Text style={[styles.filterText, filterType === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#2563EB" />
          <Text style={styles.loadingText}>Đang tải lịch...</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.grid}>
            <View style={styles.headerRow}>
              <View style={styles.slotHeader}>
                <Text style={styles.slotHeaderText}>Khung giờ</Text>
              </View>
              {DAYS.map((d) => (
                <View key={d.key} style={styles.dayHeader}>
                  <Text style={styles.dayHeaderText}>{d.label}</Text>
                  <Text style={styles.dayDateText}>{getDateForDay(d.key).format("DD/MM")}</Text>
                </View>
              ))}
            </View>

            {SLOT_CONFIG.map((slot) => (
              <View key={slot.key} style={styles.bodyRow}>
                <View style={styles.slotLabelCell}>
                  <Text style={styles.slotLabel}>{slot.label}</Text>
                </View>
                {DAYS.map((d) => (
                  <TimeSlotCell
                    key={`${slot.key}-${d.key}`}
                    dayKey={d.key}
                    slotLabel={slot.label}
                    schedules={getCellSchedules(d.key, slot.key)}
                    isCurrent={weekOffset === 0 && currentDay === d.key && currentSlot === slot.key}
                    disabled={!canManageSchedule || isPastSlot(d.key, slot.key)}
                    onAdd={handleAdd}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      <ScheduleModal
        visible={modalVisible}
        initialDay={modalDay}
        editingItem={editingItem}
        onClose={() => {
          setModalVisible(false);
          setEditingItem(null);
        }}
        onSubmit={handleSubmitModal}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A", flex: 1, paddingRight: 8 },
  backBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  backText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  weekNavRow: {
    marginHorizontal: 12,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  weekBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weekActionsRight: {
    flexDirection: "row",
    gap: 6,
  },
  weekBtnText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  weekText: { color: "#1F2937", fontSize: 12, fontWeight: "700" },
  errorText: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    marginHorizontal: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  mockText: {
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  warnText: {
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
  },
  roomText: {
    color: "#475569",
    marginHorizontal: 12,
    marginTop: 6,
    fontSize: 12,
    fontWeight: "600",
  },
  filterWrap: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFF",
  },
  filterChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  filterText: { color: "#4B5563", fontSize: 12, fontWeight: "600" },
  filterTextActive: { color: "#1D4ED8", fontWeight: "700" },
  loadingWrap: { paddingVertical: 30, alignItems: "center", gap: 8 },
  loadingText: { color: "#6B7280", fontSize: 12 },
  grid: {
    paddingHorizontal: 12,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginBottom: 8,
  },
  slotHeader: {
    width: 110,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  slotHeaderText: { fontWeight: "700", fontSize: 12, color: "#0F172A" },
  dayHeader: {
    width: 185,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
    padding: 8,
  },
  dayHeaderText: { fontWeight: "700", fontSize: 12, color: "#0F172A" },
  dayDateText: { marginTop: 2, fontSize: 10, color: "#64748B", fontWeight: "600" },
  bodyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
    alignItems: "stretch",
  },
  slotLabelCell: {
    width: 110,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  slotLabel: {
    textAlign: "center",
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 16,
  },
});
