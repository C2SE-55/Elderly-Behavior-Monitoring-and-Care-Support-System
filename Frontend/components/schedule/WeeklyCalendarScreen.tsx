import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import dayjs from "dayjs";
import { useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
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
  subscribeActiveRoomChange,
} from "@/services/api";
import { isScheduleMarkedDone } from "@/utils/scheduleMarkedDone";
import { subscribeScheduleRefresh } from "@/services/scheduleEvents";
import { resetScheduleActivityReminderKeys } from "@/services/scheduleActivityReminders";
import ScheduleModal from "./ScheduleModal";
import ScheduleDetailModal from "./ScheduleDetailModal";
import TimeSlotCell from "./TimeSlotCell";
import WeekRangeCalendarModal from "./WeekRangeCalendarModal";

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

/** API / MySQL đôi khi trả ENUM lệch chữ hoa → tránh DAY_INDEX undefined và map sai ngày. */
function normalizeDayKey(raw: string | undefined | null): DayKey | null {
  const k = String(raw ?? "")
    .trim()
    .toLowerCase();
  return k in DAY_INDEX ? (k as DayKey) : null;
}

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

const SLOT_HEADER_WIDTH = 110;
const DAY_COLUMN_WIDTH = 185;

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
  const insets = useSafeAreaInsets();
  const gridScrollRef = useRef<ScrollView | null>(null);
  const gridScrollXRef = useRef(0);
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
  const [rangeStart, setRangeStart] = useState<dayjs.Dayjs | null>(null);
  const [rangeEnd, setRangeEnd] = useState<dayjs.Dayjs | null>(null);
  const [rangeModalVisible, setRangeModalVisible] = useState(false);
  const [detailItem, setDetailItem] = useState<DailyScheduleItem | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

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
      const canNotify = isHost || !!room.can_receive_schedule_notifications;
      setCanReadRoomData(true);
      setCanManageSchedule(isHost);
      setPermissionMessage(
        isHost
          ? ""
          : canNotify
            ? "Bạn đang ở chế độ chỉ xem lịch (CAREGIVER)."
            : "Bạn đang ở chế độ chỉ xem lịch (CAREGIVER) và đã tắt thông báo lịch sinh hoạt."
      );
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
    const unsubscribe = subscribeActiveRoomChange(() => {
      resetScheduleActivityReminderKeys();
      void loadPermissions();
      void loadSchedules();
    });
    return unsubscribe;
  }, [loadPermissions, loadSchedules]);

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

  useEffect(() => {
    // Nếu đổi tuần mà range đang lọc (không null) nhưng không nằm trong tuần mới thì tắt lọc (về cả tuần).
    if (rangeStart && rangeEnd && (!rangeStart.isSame(weekStart, "week") || !rangeEnd.isSame(weekStart, "week"))) {
      setRangeStart(null);
      setRangeEnd(null);
    }
  }, [rangeEnd, rangeStart, weekEnd, weekStart]);

  const effectiveRangeStart = rangeStart || weekStart;
  const effectiveRangeEnd = rangeEnd || weekEnd;
  const isRangeActive = !!rangeStart && !!rangeEnd;

  const visibleDays = useMemo(() => {
    const s = effectiveRangeStart.startOf("day");
    const e = effectiveRangeEnd.startOf("day");
    const startIndex = Math.max(0, Math.min(6, s.diff(weekStart.startOf("day"), "day")));
    const endIndex = Math.max(0, Math.min(6, e.diff(weekStart.startOf("day"), "day")));
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return DAYS.filter((d) => {
      const idx = DAY_INDEX[d.key];
      return idx >= from && idx <= to;
    });
  }, [effectiveRangeEnd, effectiveRangeStart, weekStart]);

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
    (dayKey: DayKey) => {
      const dk = normalizeDayKey(dayKey);
      const idx = dk !== null ? DAY_INDEX[dk] : 0;
      return weekStart.add(idx, "day");
    },
    [weekStart]
  );

  const handleApplyRange = (start: dayjs.Dayjs, end: dayjs.Dayjs) => {
    const nextWeekStart = getMonday(start, 0);
    const diffWeeks = nextWeekStart.diff(getMonday(now, 0), "week");
    setWeekOffset(diffWeeks);
    const s = start.startOf("day");
    const e = end.startOf("day");
    // Nếu chọn đúng full tuần thì coi như tắt lọc (để UI không highlight cam).
    if (s.isSame(nextWeekStart, "day") && e.isSame(nextWeekStart.add(6, "day"), "day")) {
      setRangeStart(null);
      setRangeEnd(null);
    } else {
      setRangeStart(s);
      setRangeEnd(e);
    }
    setRangeModalVisible(false);
  };

  const handleViewDetail = (item: DailyScheduleItem) => {
    setDetailItem(item);
    setDetailVisible(true);
  };

  const markScheduleDone = async (item: DailyScheduleItem) => {
    if (!canManageSchedule) {
      setScreenError("Bạn chỉ có quyền xem lịch.");
      return;
    }
    if (item.id < 0) {
      setScreenError("Đang dùng dữ liệu mẫu, không thể cập nhật.");
      return;
    }
    if (isScheduleMarkedDone(item)) {
      setDetailVisible(false);
      setDetailItem(null);
      return;
    }
    if (!canMarkScheduleDone(item)) {
      setScreenError("Chưa tới giờ bắt đầu lịch, không thể đánh dấu đã xong.");
      return;
    }
    const marker = "[ĐÃ XONG]";
    const raw = String(item.description || "").trim();
    const nextDesc = raw.includes(marker) ? raw : (raw ? `${raw}\n${marker}` : marker);
    const dk = normalizeDayKey(item.day_of_week);
    if (!dk) {
      setScreenError("Dữ liệu ngày trong tuần không hợp lệ, không thể cập nhật.");
      return;
    }
    const toApiTime = (t: string) => {
      const raw = String(t || "07:00:00").trim();
      const m = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
      if (!m) return "07:00:00";
      const hh = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      const ss = (m[3] || "00").padStart(2, "0");
      return `${hh}:${mm}:${ss}`;
    };
    try {
      const keepX = gridScrollXRef.current;
      await updateDailySchedule(item.id, {
        day_of_week: dk,
        title: item.title,
        description: nextDesc,
        start_time: toApiTime(String(item.start_time)),
        end_time: toApiTime(String(item.end_time)),
        type: item.type,
      });
      await loadSchedules();
      setTimeout(() => gridScrollRef.current?.scrollTo({ x: keepX, y: 0, animated: false }), 0);
      setDetailVisible(false);
      setDetailItem(null);
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không thể cập nhật lịch.");
    }
  };

  const cancelSchedule = (item: DailyScheduleItem) => {
    // reuse existing delete flow
    handleDelete(item);
  };

  const scrollToCurrentDayColumn = useCallback(
    (animated = true) => {
      const idx = DAY_INDEX[currentDay] ?? 0;
      const x = SLOT_HEADER_WIDTH + idx * DAY_COLUMN_WIDTH;
      gridScrollRef.current?.scrollTo({ x, y: 0, animated });
    },
    [currentDay]
  );

  const goToToday = useCallback(() => {
    setWeekOffset(0);
    // Defer scroll until layout re-renders current week.
    setTimeout(() => scrollToCurrentDayColumn(true), 50);
  }, [scrollToCurrentDayColumn]);

  /** So sánh mốc thời gian thực trên lịch (không rút gọn theo weekOffset — tránh coi nhầm thứ 5 tuần này là “đã qua” khi đang thứ 2). */
  const isPastDateTime = useCallback(
    (dayKey: DayKey, hhmm: string) => {
      const dk = normalizeDayKey(dayKey);
      if (dk === null) return false;
      const [h, m] = normalizeHHMM(hhmm).split(":").map((x) => Number(x));
      const target = getDateForDay(dk).hour(h || 0).minute(m || 0).second(0).millisecond(0);
      return target.isBefore(now);
    },
    [getDateForDay, now]
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

  /** Chỉ cho đánh dấu hoàn thành khi đã tới hoặc qua giờ bắt đầu (chặn lịch còn trong tương lai). */
  const canMarkScheduleDone = useCallback(
    (item: DailyScheduleItem) => {
      const dk = normalizeDayKey(item.day_of_week);
      if (dk === null) return false;
      const [h, m] = normalizeHHMM(String(item.start_time)).split(":").map((x) => Number(x));
      const startInstant = getDateForDay(dk).hour(h || 0).minute(m || 0).second(0).millisecond(0);
      return !now.isBefore(startInstant);
    },
    [getDateForDay, now]
  );

  const isItemOverdueIncomplete = useCallback(
    (item: DailyScheduleItem) => isPastSchedule(item) && !isScheduleMarkedDone(item),
    [isPastSchedule]
  );

  const getCellSchedules = (dayKey: DayKey, slotKey: SlotKey) =>
    filteredSchedules.filter(
      (item) => normalizeDayKey(item.day_of_week) === dayKey && getSlotByTime(item.start_time) === slotKey
    );

  useEffect(() => {
    const timer = setInterval(async () => {
      await loadPermissions();
      await syncServerNow();
      await loadSchedules();
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [loadPermissions, loadSchedules, syncServerNow]);

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
    const dk = normalizeDayKey(item.day_of_week);
    setModalDay(dk ?? item.day_of_week);
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
    const doDelete = async () => {
      try {
        setScreenError("");
        const keepX = gridScrollXRef.current;
        await deleteDailySchedule(item.id);
        await loadSchedules();
        setTimeout(() => gridScrollRef.current?.scrollTo({ x: keepX, y: 0, animated: false }), 0);
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
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View style={[styles.headerBar, { height: insets.top + 56, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Quản lý lịch sinh hoạt theo tuần</Text>
        <View style={{ width: 22 }} />
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.pageWrap}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        <View style={styles.weekNavRow}>
          <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset((w) => w - 1)}>
            <Text style={styles.weekBtnText}>Tuần trước</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeSummaryBtn, isRangeActive && styles.rangeSummaryBtnActive]}
            onPress={() => setRangeModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.rangeTopRow}>
              <Text style={[styles.rangeSummaryLabel, isRangeActive && styles.rangeSummaryLabelActive]}>Khoảng ngày</Text>
            </View>
            <Text
              style={[styles.rangeSummaryValue, isRangeActive && styles.rangeSummaryValueActive]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.9}
            >
              {effectiveRangeStart.format("DD/MM")} – {effectiveRangeEnd.format("DD/MM")}
            </Text>
          </TouchableOpacity>
          <View style={styles.weekActionsRight}>
            <TouchableOpacity style={styles.weekBtn} onPress={goToToday}>
              <Text style={styles.weekBtnText}>Ngày hiện tại</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.weekBtn} onPress={() => setWeekOffset((w) => w + 1)}>
              <Text style={styles.weekBtnText}>Tuần sau</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.weekHint}>
          Tuần: {weekStart.format("DD/MM")} - {weekEnd.format("DD/MM")}
        </Text>

        {!!screenError && <Text style={styles.errorText}>{screenError}</Text>}
        {roomInfo?.member_role === "caretaker" && <Text style={styles.readonlyBadge}>Chỉ xem</Text>}
        {!!permissionMessage && <Text style={styles.warnText}>{permissionMessage}</Text>}
        {!!roomInfo?.room_id && <Text style={styles.roomText}>Room: {roomInfo.room_id}</Text>}
        {usingMock && <Text style={styles.mockText}>Đang dùng dữ liệu mẫu fallback.</Text>}
        {permissionLoading && <Text style={styles.mockText}>Đang kiểm tra quyền trong room...</Text>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterWrap} nestedScrollEnabled>
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
          <ScrollView
            ref={gridScrollRef}
            horizontal
            showsHorizontalScrollIndicator
            nestedScrollEnabled
            scrollEventThrottle={16}
            onScroll={(e) => {
              gridScrollXRef.current = e.nativeEvent.contentOffset.x || 0;
            }}
          >
            <View style={styles.grid}>
              <View style={styles.headerRow}>
                <View style={styles.slotHeader}>
                  <Text style={styles.slotHeaderText}>Khung giờ</Text>
                </View>
                {visibleDays.map((d) => (
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
                  {visibleDays.map((d) => (
                    <TimeSlotCell
                      key={`${slot.key}-${d.key}`}
                      dayKey={d.key}
                      slotLabel={slot.label}
                      schedules={getCellSchedules(d.key, slot.key)}
                      isCurrent={weekOffset === 0 && currentDay === d.key && currentSlot === slot.key}
                      readonly={!canManageSchedule}
                      isPast={isPastSlot(d.key, slot.key)}
                      isItemOverdueIncomplete={isItemOverdueIncomplete}
                      onAdd={handleAdd}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onViewDetail={handleViewDetail}
                    />
                  ))}
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </ScrollView>

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

      <ScheduleDetailModal
        visible={detailVisible}
        item={detailItem}
        canManage={canManageSchedule}
        isPast={!!detailItem && isPastSchedule(detailItem)}
        canMarkDone={!!detailItem && canMarkScheduleDone(detailItem)}
        onDone={(it) => void markScheduleDone(it)}
        onClose={() => {
          setDetailVisible(false);
          setDetailItem(null);
        }}
      />

      <WeekRangeCalendarModal
        visible={rangeModalVisible}
        weekStart={weekStart}
        weekEnd={weekEnd}
        valueStart={effectiveRangeStart.startOf("day")}
        valueEnd={effectiveRangeEnd.startOf("day")}
        onClose={() => setRangeModalVisible(false)}
        onApply={handleApplyRange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  headerBar: {
    backgroundColor: "#FFFFFF",
    height: 56,
    paddingTop: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBarTitle: { color: "#111827", fontSize: 18, fontWeight: "700", flex: 1, textAlign: "center" },
  pageWrap: {
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#0F172A", flex: 1, textAlign: "center" },
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
  rangeSummaryBtn: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    marginHorizontal: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: "flex-start",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  rangeTopRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rangeSummaryLabel: { color: "#6B7280", fontSize: 10, fontWeight: "800" },
  rangeSummaryValue: { marginTop: 2, color: "#111827", fontSize: 14, fontWeight: "900" },
  rangeSummaryBtnActive: {
    borderColor: "#F97316",
    backgroundColor: "#FFEDD5",
  },
  rangeSummaryLabelActive: { color: "#9A3412" },
  rangeSummaryValueActive: { color: "#9A3412" },
  weekHint: { color: "#64748B", fontSize: 11, fontWeight: "700", marginHorizontal: 12, marginBottom: 6 },
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
  readonlyBadge: {
    alignSelf: "flex-start",
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
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
    paddingVertical: 8,
    backgroundColor: "#FFF",
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  filterChipActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  filterText: { color: "#4B5563", fontSize: 12, fontWeight: "600", lineHeight: 16 },
  filterTextActive: { color: "#1D4ED8", fontWeight: "800" },
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
