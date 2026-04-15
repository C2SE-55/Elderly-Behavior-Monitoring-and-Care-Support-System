import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  createMedication,
  createSchedules,
  deleteMedication,
  deleteSchedule,
  deleteSchedulesForSlot,
  extractMedicationsFromImage,
  ExtractedMedicineItem,
  getMyRoom,
  getMedications,
  getTodaySchedules,
  markMedicationSlotSkipped,
  markMedicationSlotTaken,
  MedicationItem,
  MyRoomInfo,
  TodayScheduleItem,
  updateMedication,
  subscribeActiveRoomChange,
} from "../../services/api";
import { ensureNotificationPermission, rescheduleMedicationNotifications } from "@/services/medicationNotifications";
import { dismissMedicationReminderLogsForMedicationSlot } from "@/services/notificationLog";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

const COLORS = {
  bg: "#F5F6FF",
  card: "rgba(255,255,255,0.92)",
  cardSolid: "#FFFFFF",
  border: "rgba(148,163,184,0.22)",
  text: "#0F172A",
  sub: "#64748B",
  primary: "#56328C",
  primary2: "#7C3AED",
  blue: "#2563EB",
  success: "#16A34A",
  warn: "#B45309",
  danger: "#DC2626",
};

const pad2 = (value: number) => String(value).padStart(2, "0");
const localDateYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowHHMM = () => {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
};
const SNOOZE_MINUTE_OPTIONS = [1, 5, 10, 15] as const;
const hhmmToMinutes = (time: string): number => {
  const raw = String(time || "").slice(0, 5);
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
  if (h < 0 || h > 23 || m < 0 || m > 59) return -1;
  return h * 60 + m;
};

export default function MedicineReminderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [screenError, setScreenError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState<MyRoomInfo | null>(null);
  const [canReadRoomData, setCanReadRoomData] = useState(false);
  const [canManageMedication, setCanManageMedication] = useState(false);
  const [canReceiveMedicationNotifications, setCanReceiveMedicationNotifications] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [savingMedication, setSavingMedication] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [todaySchedules, setTodaySchedules] = useState<TodayScheduleItem[]>([]);

  const [medicineName, setMedicineName] = useState("");
  const [medicineDosage, setMedicineDosage] = useState("");
  const [medicineNote, setMedicineNote] = useState("");
  const [extractedMedicines, setExtractedMedicines] = useState<ExtractedMedicineItem[]>([]);
  const [extractMessage, setExtractMessage] = useState("");
  const [extractingImage, setExtractingImage] = useState(false);
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null);

  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [iosPickerOpen, setIosPickerOpen] = useState(false);
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<number[]>([]);
  const [doseOverrides, setDoseOverrides] = useState<Record<number, string>>({});
  const [scheduleRepeatType, setScheduleRepeatType] = useState<"once" | "daily">("once");
  const [allowMissedReminder, setAllowMissedReminder] = useState(true);
  const [missedReminderMinutes, setMissedReminderMinutes] = useState<number>(5);
  const missReminderShownRef = useRef<Record<string, true>>({});
  const scrollRef = useRef<ScrollView | null>(null);
  const lastScrollYRef = useRef(0);
  const sectionYRef = useRef<{ today?: number; meds?: number; schedule?: number }>({});

  const notifiedKeysRef = useRef<Record<string, true>>({});
  const noticeAnim = useRef(new Animated.Value(0)).current;
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimeRef = useRef("");
  const noticeItemsRef = useRef<TodayScheduleItem[]>([]);
  const [noticeVisible, setNoticeVisible] = useState(false);
  const [noticeItems, setNoticeItems] = useState<TodayScheduleItem[]>([]);
  const [noticeTime, setNoticeTime] = useState("");
  const selectedTime = useMemo(() => `${pad2(hour)}:${pad2(minute)}`, [hour, minute]);
  const selectedDate = useMemo(() => {
    const d = new Date();
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [hour, minute]);

  const onChangeTime = useCallback(
    (_event: any, date?: Date) => {
      if (Platform.OS === "android") {
        setAndroidPickerOpen(false);
      }
      if (!date) return;
      setHour(date.getHours());
      setMinute(date.getMinutes());
    },
    []
  );

  const groupedSchedules = useMemo(() => {
    const groups: Record<string, TodayScheduleItem[]> = {};
    for (const item of todaySchedules) {
      const key = item.alarm_time;
      groups[key] = groups[key] || [];
      groups[key].push(item);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [todaySchedules]);

  const canMarkMedicationIntake = useMemo(() => {
    if (!roomInfo) return false;
    return roomInfo.member_role === "host" || !!roomInfo.can_receive_medication_notifications;
  }, [roomInfo]);

  const loadPermissions = useCallback(async () => {
    try {
      setPermissionLoading(true);
      const room = await getMyRoom();
      setRoomInfo(room);
      if (!room) {
        setCanReadRoomData(false);
        setCanManageMedication(false);
        setCanReceiveMedicationNotifications(false);
        setPermissionMessage("Bạn chưa tham gia room. Hãy vào mục Kết nối người thân để join room.");
        return;
      }
      const isHost = room.member_role === "host";
      const canManage = isHost;
      const canNotify = isHost || !!room.can_receive_medication_notifications;
      setCanReadRoomData(true);
      setCanManageMedication(canManage);
      setCanReceiveMedicationNotifications(canNotify);
      setPermissionMessage(
        canManage
          ? ""
          : canNotify
            ? "Bạn đang ở chế độ chỉ xem. CAREGIVER không được hẹn giờ/chỉnh sửa nhắc thuốc."
            : "Bạn đang ở chế độ chỉ xem và đã tắt thông báo nhắc thuốc."
      );
    } catch {
      setCanReadRoomData(false);
      setCanManageMedication(false);
      setCanReceiveMedicationNotifications(false);
      setPermissionMessage("Không tải được thông tin quyền trong room.");
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  const loadAll = useCallback(async (showLoading = true) => {
    if (!canReadRoomData) {
      setMedications([]);
      setTodaySchedules([]);
      return;
    }
    try {
      if (showLoading) setLoading(true);
      setScreenError("");
      const [meds, schedules] = await Promise.all([getMedications(), getTodaySchedules()]);
      setMedications(meds);
      setTodaySchedules(schedules);
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không tải được dữ liệu nhắc thuốc.");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [canReadRoomData]);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  useEffect(() => {
    // Ask notification permission early (only on native)
    if (!canReceiveMedicationNotifications) return;
    void ensureNotificationPermission();
  }, [canReceiveMedicationNotifications]);

  useEffect(() => {
    const unsubscribe = subscribeActiveRoomChange(() => {
      notifiedKeysRef.current = {};
      void loadPermissions();
      void loadAll();
    });
    return unsubscribe;
  }, [loadAll, loadPermissions]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    // Keep OS-level notifications in sync with today's schedules
    if (!canReceiveMedicationNotifications) return;
    void (async () => {
      const ok = await ensureNotificationPermission();
      if (!ok) return;
      const allowDaily =
        roomInfo?.medication_daily_reminders_enabled !== false &&
        roomInfo?.medication_daily_reminders_enabled !== 0;
      await rescheduleMedicationNotifications(todaySchedules, {
        allowDaily,
        allowSnooze: allowMissedReminder,
        snoozeMinutes: missedReminderMinutes,
      });
    })();
  }, [
    todaySchedules,
    canReceiveMedicationNotifications,
    roomInfo?.medication_daily_reminders_enabled,
    allowMissedReminder,
    missedReminderMinutes,
  ]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const closeDueNotice = useCallback(() => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
    setNoticeVisible(false);
  }, []);

  const showDueNotice = useCallback((items: TodayScheduleItem[], time: string) => {
    setNoticeItems(items);
    setNoticeTime(time);
    noticeTimeRef.current = time;
    noticeItemsRef.current = items;
    setNoticeVisible(true);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => {
      setNoticeVisible(false);
    }, 12000);
  }, []);

  useEffect(() => {
    Animated.spring(noticeAnim, {
      toValue: noticeVisible ? 1 : 0,
      useNativeDriver: true,
      friction: 8,
      tension: 70,
    }).start();
  }, [noticeAnim, noticeVisible]);

  useEffect(() => {
    const timer = setInterval(async () => {
      if (!canReadRoomData || !canReceiveMedicationNotifications) return;
      try {
        const schedules = await getTodaySchedules();
        setTodaySchedules(schedules);

        const now = nowHHMM();
        const dueItems = schedules.filter(
          (item) => item.alarm_time === now && item.status !== "taken" && item.status !== "skipped"
        );
        if (dueItems.length) {
          const idsKey = dueItems.map((item) => item.id).sort((a, b) => a - b).join("-");
          const key = `${new Date().toISOString().slice(0, 10)}-${now}-${idsKey}`;
          if (!notifiedKeysRef.current[key]) {
            notifiedKeysRef.current[key] = true;
            showDueNotice(dueItems, now);
          }
        }

        // Nhắc lại mỗi 5 phút cho lịch đã quá giờ nhưng chưa Taken/Skip.
        const nowMin = hhmmToMinutes(now);
        if (allowMissedReminder && nowMin >= 0) {
          const retryGroups: Record<string, TodayScheduleItem[]> = {};
          for (const item of schedules) {
            if (item.status === "taken" || item.status === "skipped") continue;
            const t = String(item.alarm_time || "").slice(0, 5);
            const tMin = hhmmToMinutes(t);
            if (tMin < 0) continue;
            // Chỉ nhắc lại 1 lần khi đã trễ ít nhất N phút từ giờ ban đầu.
            if (nowMin < tMin + missedReminderMinutes) continue;
            retryGroups[t] = retryGroups[t] || [];
            retryGroups[t].push(item);
          }
          for (const [t, items] of Object.entries(retryGroups)) {
            const idsKey = items.map((x) => Number(x.id)).sort((a, b) => a - b).join("-");
            const key = `${localDateYmd()}-${t}-${idsKey}`;
            if (missReminderShownRef.current[key]) continue;
            missReminderShownRef.current[key] = true;
            showDueNotice(items, t);
          }
        }
      } catch {
        // Polling silently; lỗi đã hiển thị ở lần tải chính.
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [canReadRoomData, canReceiveMedicationNotifications, showDueNotice, allowMissedReminder, missedReminderMinutes]);

  useEffect(() => {
    if (!canReceiveMedicationNotifications) {
      closeDueNotice();
      setNoticeItems([]);
    }
  }, [canReceiveMedicationNotifications, closeDueNotice]);

  useEffect(() => {
    noticeTimeRef.current = noticeTime;
  }, [noticeTime]);

  useEffect(() => {
    noticeItemsRef.current = noticeItems;
  }, [noticeItems]);

  useEffect(() => {
    if (!roomInfo?.id || !canReadRoomData) return;
    const socket = connectRoomChatSocket();
    if (!socket) return;
    const rid = Number(roomInfo.id);
    socket.emit("room:join", { roomId: rid });

    const onIntake = (payload: any) => {
      if (Number(payload?.roomId || 0) !== rid) return;
      const rawIds = Array.isArray(payload?.schedule_ids) ? payload.schedule_ids : [];
      const ids = rawIds.map((x: unknown) => Number(x)).filter((x: number) => x > 0);
      if (!ids.length && payload?.schedule_id) ids.push(Number(payload.schedule_id));
      const dateStr = String(payload?.date || localDateYmd()).slice(0, 10);
      const al = String(payload?.alarm_time || "").slice(0, 5);
      void dismissMedicationReminderLogsForMedicationSlot(dateStr, ids, al || undefined);
      void loadAll();
      const nt = String(noticeTimeRef.current || "").slice(0, 5);
      const slotMatches =
        (al && nt && al === nt) ||
        (ids.length > 0 && noticeItemsRef.current.some((x) => ids.includes(x.id)));
      if (slotMatches) {
        closeDueNotice();
        setNoticeItems([]);
        noticeItemsRef.current = [];
      }
    };

    socket.on("medication:intake", onIntake);
    return () => {
      getRoomChatSocket()?.off("medication:intake", onIntake);
    };
  }, [roomInfo?.id, canReadRoomData, loadAll, closeDueNotice]);

  const resetMedicationForm = () => {
    setMedicineName("");
    setMedicineDosage("");
    setMedicineNote("");
    setEditingMedicationId(null);
  };

  const onSaveMedication = async () => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền chỉnh sửa nhắc thuốc.");
      return;
    }
    if (!medicineName.trim()) {
      setScreenError("Tên thuốc là bắt buộc.");
      return;
    }
    try {
      setSavingMedication(true);
      setScreenError("");
      setSuccessMessage("");
      if (editingMedicationId) {
        await updateMedication(editingMedicationId, {
          name: medicineName.trim(),
          dosage: medicineDosage.trim(),
          note: medicineNote.trim(),
        });
        setSuccessMessage("Cập nhật thuốc thành công.");
      } else {
        await createMedication({
          name: medicineName.trim(),
          dosage: medicineDosage.trim(),
          note: medicineNote.trim(),
        });
        setSuccessMessage("Thêm thuốc thành công.");
      }
      resetMedicationForm();
      await loadAll();
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không lưu được thuốc.");
    } finally {
      setSavingMedication(false);
    }
  };

  const onEditMedication = (item: MedicationItem) => {
    setEditingMedicationId(item.id);
    setMedicineName(item.name || "");
    setMedicineDosage(item.dosage || "");
    setMedicineNote(item.note || "");
  };

  const onDeleteMedication = async (id: number) => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền chỉnh sửa nhắc thuốc.");
      return;
    }
    try {
      setScreenError("");
      await deleteMedication(id);
      setSelectedMedicationIds((prev) => prev.filter((x) => x !== id));
      setSuccessMessage("Xóa thuốc thành công.");
      await loadAll();
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không xóa được thuốc.");
    }
  };

  const onExtractFromImage = async () => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền chỉnh sửa nhắc thuốc.");
      return;
    }
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Quyền truy cập ảnh", "Cần cấp quyền truy cập thư viện để chọn ảnh toa thuốc.");
        return;
      }

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
      });
      if (picked.canceled || !picked.assets?.[0]?.uri) return;

      setExtractingImage(true);
      setScreenError("");
      setSuccessMessage("");
      setExtractMessage("");
      const result = await extractMedicationsFromImage(picked.assets[0].uri);
      setExtractedMedicines(Array.isArray(result.medicines) ? result.medicines : []);
      setExtractMessage(result.message || "");
      if (!result.medicines?.length) {
        setScreenError(result.message || "Không đọc được thuốc từ ảnh.");
      } else {
        setSuccessMessage("Đã trích xuất thuốc từ ảnh. Bấm 'Dùng dòng này' để điền vào form.");
      }
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không thể trích xuất thuốc từ ảnh.");
    } finally {
      setExtractingImage(false);
    }
  };

  const onUseExtractedMedicine = (item: ExtractedMedicineItem) => {
    setMedicineName(item.ten_thuoc || "");
    setMedicineDosage(item.lieu_luong || "");
    setMedicineNote(item.ghi_chu || "");
    setEditingMedicationId(null);
  };

  const toggleSelectMedication = (id: number) => {
    setSelectedMedicationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const onCreateSchedule = async () => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền chỉnh sửa nhắc thuốc.");
      return;
    }
    if (!selectedMedicationIds.length) {
      setScreenError("Vui lòng chọn ít nhất 1 thuốc để đặt lịch.");
      return;
    }
    if (scheduleRepeatType === "once" && hhmmToMinutes(selectedTime) < hhmmToMinutes(nowHHMM())) {
      setScreenError("Không thể đặt lịch trong quá khứ. Vui lòng chọn giờ hiện tại hoặc muộn hơn.");
      return;
    }
    try {
      setSavingSchedule(true);
      setScreenError("");
      setSuccessMessage("");

      await createSchedules({
        alarm_time: selectedTime,
        repeat_type: scheduleRepeatType,
        medications: selectedMedicationIds.map((id) => ({
          medication_id: id,
          dosage: doseOverrides[id] ? doseOverrides[id].trim() : undefined,
        })),
      });

      setSelectedMedicationIds([]);
      setDoseOverrides({});
      setSuccessMessage("Tạo lịch uống thuốc thành công.");
      await loadAll();
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không tạo được lịch uống thuốc.");
    } finally {
      setSavingSchedule(false);
    }
  };

  const onMarkSlotTaken = async (alarmTime: string, scheduleIdsFallback: number[]): Promise<boolean> => {
    if (!canMarkMedicationIntake) {
      setScreenError("Bạn không có quyền xác nhận uống thuốc.");
      return false;
    }
    const t = String(alarmTime || "").slice(0, 5);
    if (!t) return false;
    const snapshot = [...todaySchedules];
    try {
      setScreenError("");
      setTodaySchedules((prev) =>
        prev.map((item) =>
          String(item.alarm_time || "").slice(0, 5) === t ? { ...item, status: "taken" } : item
        )
      );
      const data = await markMedicationSlotTaken(t);
      const ymd = String(data?.intake_date || localDateYmd()).slice(0, 10);
      const ids =
        Array.isArray(data?.schedule_ids) && data.schedule_ids.length
          ? data.schedule_ids.map(Number)
          : scheduleIdsFallback;
      await dismissMedicationReminderLogsForMedicationSlot(ymd, ids, t);
      setSuccessMessage(`Đã xác nhận uống thuốc cho khung giờ ${t}.`);
      await loadAll();
      return true;
    } catch (error) {
      setTodaySchedules(snapshot);
      const backendMessage = (error as any)?.response?.data?.message;
      if (backendMessage === "Không tìm thấy lịch cho khung giờ này") {
        // Tránh báo lỗi giả khi slot vừa bị xóa/cập nhật từ thiết bị khác.
        setScreenError("");
        await loadAll();
        return false;
      }
      setScreenError(backendMessage || "Không thể đánh dấu đã uống.");
      return false;
    }
  };

  const onMarkSlotSkipped = async (alarmTime: string, scheduleIdsFallback: number[]): Promise<boolean> => {
    if (!canMarkMedicationIntake) {
      setScreenError("Bạn không có quyền xác nhận uống thuốc.");
      return false;
    }
    const t = String(alarmTime || "").slice(0, 5);
    if (!t) return false;
    const snapshot = [...todaySchedules];
    try {
      setScreenError("");
      setTodaySchedules((prev) =>
        prev.map((item) =>
          String(item.alarm_time || "").slice(0, 5) === t ? { ...item, status: "skipped" } : item
        )
      );
      const data = await markMedicationSlotSkipped(t);
      const ymd = String(data?.intake_date || localDateYmd()).slice(0, 10);
      const ids =
        Array.isArray(data?.schedule_ids) && data.schedule_ids.length
          ? data.schedule_ids.map(Number)
          : scheduleIdsFallback;
      await dismissMedicationReminderLogsForMedicationSlot(ymd, ids, t);
      setSuccessMessage(`Đã đánh dấu bỏ qua cho khung giờ ${t}.`);
      await loadAll();
      return true;
    } catch (error) {
      setTodaySchedules(snapshot);
      const backendMessage = (error as any)?.response?.data?.message;
      if (backendMessage === "Không tìm thấy lịch cho khung giờ này") {
        // Tránh báo lỗi giả khi slot vừa bị xóa/cập nhật từ thiết bị khác.
        setScreenError("");
        await loadAll();
        return false;
      }
      setScreenError(backendMessage || "Không thể đánh dấu bỏ qua.");
      return false;
    }
  };

  const onDeleteSlot = async (alarmTime: string, scheduleIds: number[] = []) => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền xóa lịch thuốc.");
      return;
    }
    const t = String(alarmTime || "").slice(0, 5);
    if (!t) return;
    const snapshot = [...todaySchedules];
    try {
      setScreenError("");
      // Optimistic remove so the slot disappears immediately in UI.
      setTodaySchedules((prev) => prev.filter((item) => String(item.alarm_time || "").slice(0, 5) !== t));
      const result = await deleteSchedulesForSlot(t);
      // Fallback: some environments may reject DELETE body, then endpoint returns deleted=0.
      // In that case, delete by schedule IDs to guarantee the slot is removed.
      if ((result?.deleted || 0) === 0 && scheduleIds.length) {
        const settled = await Promise.allSettled(
          scheduleIds
            .map((id) => Number(id))
            .filter((id) => id > 0)
            .map((id) => deleteSchedule(id))
        );
        const hasHardError = settled.some((s) => {
          if (s.status === "fulfilled") return false;
          const backendMessage = (s.reason as any)?.response?.data?.message;
          return backendMessage !== "Không tìm thấy lịch uống";
        });
        if (hasHardError) {
          throw new Error("DELETE_SLOT_FALLBACK_FAILED");
        }
      }
      setSuccessMessage("Đã xóa toàn bộ lịch trong khung giờ này.");
      await loadAll(false);
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      if (
        backendMessage === "Không tìm thấy lịch cho khung giờ này" ||
        backendMessage === "Không tìm thấy lịch uống"
      ) {
        setScreenError("");
        await loadAll(false);
        return;
      }
      setTodaySchedules(snapshot);
      setScreenError(backendMessage || "Không thể xóa lịch.");
    }
  };

  const handleNoticeSlotAction = async (action: "taken" | "skipped") => {
    const t = String(noticeTime || "").slice(0, 5);
    const ids = noticeItems.map((x) => x.id);
    const ok =
      action === "taken" ? await onMarkSlotTaken(t, ids) : await onMarkSlotSkipped(t, ids);
    if (!ok) return;
    closeDueNotice();
    setNoticeItems([]);
    noticeItemsRef.current = [];
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <View style={[styles.headerBar, { height: insets.top + 56, paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)"))} hitSlop={8}>
          <View style={styles.headerIconBtn}>
            <Ionicons name="arrow-back" size={20} color={COLORS.text} />
          </View>
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Nhắc uống thuốc</Text>
        <View style={{ width: 22 }} />
      </View>
      <Animated.View
        style={[
          styles.noticeContainer,
          {
            top: insets.top + 34,
            opacity: noticeAnim,
            transform: [
              {
                translateY: noticeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-30, 0],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.noticeCard}>
          <View style={styles.noticeHeader}>
            <Text style={styles.noticeTitle}>Đến giờ uống thuốc - {noticeTime}</Text>
            <TouchableOpacity onPress={closeDueNotice}>
              <Text style={styles.noticeClose}>x</Text>
            </TouchableOpacity>
          </View>
          {noticeItems.map((item) => (
            <View key={`notice-${item.id}`} style={styles.noticeItemRow}>
              <Text style={styles.noticeItemName}>
                {item.name} {item.dosage ? `(${item.dosage})` : ""}
              </Text>
            </View>
          ))}
          {canMarkMedicationIntake ? (
            <View style={styles.noticeActionsRow}>
              <TouchableOpacity style={styles.noticeTakenBtn} onPress={() => void handleNoticeSlotAction("taken")}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                <Text style={styles.noticeTakenText}>Đã uống</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noticeSkipBtn} onPress={() => void handleNoticeSlotAction("skipped")}>
                <Ionicons name="close-circle-outline" size={16} color="#92400E" />
                <Text style={styles.noticeSkipText}>Bỏ qua</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noticeReadonly}>Chỉ xem</Text>
          )}
        </View>
      </Animated.View>

      <ScrollView
        ref={(r) => {
          scrollRef.current = r;
        }}
        style={styles.container}
        contentContainerStyle={styles.contentWrap}
        scrollEventThrottle={16}
        onScroll={(e) => {
          lastScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        {!!screenError && <Text style={styles.errorText}>{screenError}</Text>}
        {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}
        {roomInfo?.member_role === "caretaker" && <Text style={styles.readonlyBadge}>Chỉ xem</Text>}
        {!!permissionMessage && <Text style={styles.warnText}>{permissionMessage}</Text>}
        {permissionLoading && <Text style={styles.loadingText}>Đang kiểm tra quyền trong room...</Text>}
        {!!roomInfo?.room_id && <Text style={styles.loadingText}>Room: {roomInfo.room_id}</Text>}

        <View
          onLayout={(e) => {
            sectionYRef.current.today = e.nativeEvent.layout.y;
          }}
          style={styles.todayHero}
        >
          <View style={styles.todayHeroTop}>
            <View style={styles.todayHeroIcon}>
              <Ionicons name="time-outline" size={18} color="#56328C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.todayHeroTitle}>Hôm nay</Text>
              <Text style={styles.todayHeroSub}>Theo dõi các mốc giờ uống thuốc và đánh dấu nhanh.</Text>
            </View>
          </View>
          <View style={styles.todayHeroStatsRow}>
            <View style={styles.todayStat}>
              <Text style={styles.todayStatValue}>{todaySchedules.length}</Text>
              <Text style={styles.todayStatLabel}>Lượt nhắc</Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStat}>
              <Text style={styles.todayStatValue}>{medications.length}</Text>
              <Text style={styles.todayStatLabel}>Thuốc</Text>
            </View>
            <View style={styles.todayStatDivider} />
            <View style={styles.todayStat}>
              <Text style={styles.todayStatValue}>{localDateYmd()}</Text>
              <Text style={styles.todayStatLabel}>Ngày</Text>
            </View>
          </View>
        </View>

        <View style={styles.quickNav}>
          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.9}
            onPress={() => scrollRef.current?.scrollTo({ y: sectionYRef.current.today ?? 0, animated: true })}
          >
            <Ionicons name="today-outline" size={16} color="#56328C" />
            <Text style={styles.quickNavText}>Hôm nay</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.9}
            onPress={() => scrollRef.current?.scrollTo({ y: sectionYRef.current.meds ?? 0, animated: true })}
          >
            <Ionicons name="medkit-outline" size={16} color="#56328C" />
            <Text style={styles.quickNavText}>Thuốc</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickNavChip}
            activeOpacity={0.9}
            onPress={() => scrollRef.current?.scrollTo({ y: sectionYRef.current.schedule ?? 0, animated: true })}
          >
            <Ionicons name="alarm-outline" size={16} color="#56328C" />
            <Text style={styles.quickNavText}>Đặt lịch</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View
            onLayout={(e) => {
              sectionYRef.current.meds = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.cardTitle}>Thuốc</Text>
            <Text style={styles.cardHint}>Tạo danh sách thuốc trước, sau đó đặt lịch uống theo giờ.</Text>
          </View>
          <TextInput
            value={medicineName}
            onChangeText={setMedicineName}
            placeholder="Tên thuốc"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            editable={canManageMedication}
          />
          <TextInput
            value={medicineDosage}
            onChangeText={setMedicineDosage}
            placeholder="Liều lượng (vd: 1 viên)"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            editable={canManageMedication}
          />
          <TextInput
            value={medicineNote}
            onChangeText={setMedicineNote}
            placeholder="Ghi chú (tuỳ chọn)"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, styles.textArea]}
            multiline
            editable={canManageMedication}
          />
          <View style={styles.rowActions}>
            <TouchableOpacity
              style={[styles.primaryBtn, !canManageMedication && { opacity: 0.6 }]}
              onPress={onSaveMedication}
              disabled={savingMedication || !canManageMedication}
            >
              <Text style={styles.primaryBtnText}>{savingMedication ? "Đang lưu..." : editingMedicationId ? "Cập nhật thuốc" : "Thêm thuốc"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.lightBtn, !canManageMedication && { opacity: 0.6 }]}
              onPress={() => void onExtractFromImage()}
              disabled={extractingImage || !canManageMedication}
            >
              <Text style={styles.lightBtnText}>{extractingImage ? "Đang đọc ảnh..." : "Trích xuất từ ảnh"}</Text>
            </TouchableOpacity>
            {editingMedicationId && (
              <TouchableOpacity
                style={[styles.lightBtn, !canManageMedication && { opacity: 0.6 }]}
                onPress={resetMedicationForm}
                disabled={!canManageMedication}
              >
                <Text style={styles.lightBtnText}>Hủy sửa</Text>
              </TouchableOpacity>
            )}
          </View>
          {!!extractMessage && <Text style={styles.cardHint}>{extractMessage}</Text>}

          {extractedMedicines.map((item) => (
            <View key={`extract-${item.id}`} style={styles.medicationRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{item.ten_thuoc || "(chưa rõ tên thuốc)"}</Text>
                {!!item.lieu_luong && <Text style={styles.medMeta}>Liều: {item.lieu_luong}</Text>}
                {!!item.ghi_chu && <Text style={styles.medMeta}>Ghi chú: {item.ghi_chu}</Text>}
                <Text style={styles.medMeta}>
                  Confidence: {Math.round((item.confidence || 0) * 100)}% {item.needs_review ? "• cần kiểm tra" : ""}
                </Text>
                {!!item.note_item && <Text style={styles.medMeta}>{item.note_item}</Text>}
              </View>
              <TouchableOpacity
                style={[styles.lightBtn, !canManageMedication && { opacity: 0.6 }]}
                onPress={() => onUseExtractedMedicine(item)}
                disabled={!canManageMedication}
              >
                <Text style={styles.lightBtnText}>Dùng đơn thuốc này</Text>
              </TouchableOpacity>
            </View>
          ))}

          {medications.map((item) => (
            <View key={item.id} style={styles.medicationRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.medName}>{item.name}</Text>
                {!!item.dosage && <Text style={styles.medMeta}>Liều: {item.dosage}</Text>}
                {!!item.note && <Text style={styles.medMeta}>Ghi chú: {item.note}</Text>}
              </View>
              <TouchableOpacity
                style={[styles.lightBtn, !canManageMedication && { opacity: 0.6 }]}
                onPress={() => onEditMedication(item)}
                disabled={!canManageMedication}
              >
                <Text style={styles.lightBtnText}>Sửa</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.deleteBtn, !canManageMedication && { opacity: 0.6 }]}
                onPress={() => onDeleteMedication(item.id)}
                disabled={!canManageMedication}
              >
                <Text style={styles.deleteBtnText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

      <View
        style={styles.card}
        onLayout={(e) => {
          sectionYRef.current.schedule = e.nativeEvent.layout.y;
        }}
      >
          <Text style={styles.cardTitle}>Đặt lịch uống thuốc</Text>
          <Text style={styles.cardHint}>Chọn giờ, chọn thuốc, rồi bấm tạo lịch.</Text>
          <TouchableOpacity
            style={[styles.timeTrigger, !canManageMedication && { opacity: 0.6 }]}
            activeOpacity={0.8}
            disabled={!canManageMedication}
            onPress={() => {
              if (Platform.OS === "android") {
                setAndroidPickerOpen(true);
                return;
              }
              setIosPickerOpen((prev) => !prev);
            }}
          >
            <Text style={styles.timeText}>{selectedTime}</Text>
            <Text style={styles.timeHint}>Chạm để chọn giờ</Text>
          </TouchableOpacity>
          {Platform.OS === "ios" ? (
            iosPickerOpen ? (
              <View style={[styles.iosPickerWrap, !canManageMedication && { opacity: 0.6 }]}>
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="spinner"
                  onChange={onChangeTime}
                  minuteInterval={1}
                  disabled={!canManageMedication}
                  textColor="#111827"
                  themeVariant="light"
                  style={styles.iosPicker}
                />
              </View>
            ) : null
          ) : (
            <>
              {androidPickerOpen && (
                <DateTimePicker
                  value={selectedDate}
                  mode="time"
                  display="default"
                  onChange={onChangeTime}
                />
              )}
            </>
          )}

          <View style={styles.repeatRow}>
            <TouchableOpacity
              style={[styles.repeatPill, scheduleRepeatType === "once" && styles.repeatPillActive]}
              onPress={() => setScheduleRepeatType("once")}
            >
              <Text style={[styles.repeatText, scheduleRepeatType === "once" && styles.repeatTextActive]}>
                Nhắc 1 lần
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.repeatPill, scheduleRepeatType === "daily" && styles.repeatPillActive]}
              onPress={() => setScheduleRepeatType("daily")}
            >
              <Text style={[styles.repeatText, scheduleRepeatType === "daily" && styles.repeatTextActive]}>
                Nhắc hằng ngày
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Báo lại</Text>
            <Switch
              value={allowMissedReminder}
              onValueChange={setAllowMissedReminder}
              disabled={!canManageMedication}
              trackColor={{ false: "#9CA3AF", true: "#22C55E" }}
              thumbColor={allowMissedReminder ? "#FFFFFF" : "#FFFFFF"}
            />
          </View>
          {allowMissedReminder && (
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Thời lượng báo lại</Text>
              <Text style={styles.settingValue}>{missedReminderMinutes} phút</Text>
            </View>
          )}
          {allowMissedReminder && (
            <View style={styles.repeatRow}>
              {SNOOZE_MINUTE_OPTIONS.map((m) => (
                <TouchableOpacity
                  key={`snooze-${m}`}
                  style={[styles.repeatPill, missedReminderMinutes === m && styles.repeatPillActive]}
                  onPress={() => setMissedReminderMinutes(m)}
                >
                  <Text style={[styles.repeatText, missedReminderMinutes === m && styles.repeatTextActive]}>
                    {m} phút
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.cardHint}>Chọn nhiều thuốc cho cùng 1 thời điểm và chỉnh liều riêng nếu cần.</Text>
          {medications.map((item) => {
            const selected = selectedMedicationIds.includes(item.id);
            return (
              <View key={`select-${item.id}`} style={styles.selectRow}>
                <TouchableOpacity
                  style={[styles.checkbox, selected && styles.checkboxActive]}
                  onPress={() => toggleSelectMedication(item.id)}
                  disabled={!canManageMedication}
                >
                  <Text style={styles.checkboxText}>{selected ? "✓" : ""}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{item.name}</Text>
                  <TextInput
                    value={doseOverrides[item.id] ?? (item.dosage || "")}
                    onChangeText={(value) =>
                      setDoseOverrides((prev) => ({
                        ...prev,
                        [item.id]: value,
                      }))
                    }
                    placeholder="Liều cho lần uống này"
                    placeholderTextColor="#9CA3AF"
                    style={styles.input}
                    editable={canManageMedication}
                  />
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.primaryBtn, !canManageMedication && { opacity: 0.6 }]}
            onPress={onCreateSchedule}
            disabled={savingSchedule || !canManageMedication}
          >
            <Text style={styles.primaryBtnText}>{savingSchedule ? "Đang tạo..." : "Tạo lịch uống"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>5) Lịch trình hôm nay</Text>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="small" color="#2563EB" />
              <Text style={styles.loadingText}>Đang tải...</Text>
            </View>
          ) : groupedSchedules.length === 0 ? (
            <Text style={styles.emptyText}>Chưa có lịch hôm nay.</Text>
          ) : (
            groupedSchedules.map(([time, items]) => {
              const slotNeedsAction = items.some((it) => it.status !== "taken" && it.status !== "skipped");
              const slotIds = items.map((it) => it.id);
              return (
                <View key={time} style={styles.groupCard}>
                  <View style={styles.groupHeaderRow}>
                    <Text style={styles.groupTime}>{time}</Text>
                    {canManageMedication && (
                      <TouchableOpacity
                        style={styles.deleteSlotBtn}
                        onPress={() => void onDeleteSlot(time, slotIds)}
                        disabled={!canManageMedication}
                      >
                        <Text style={styles.deleteSlotBtnText}>Xóa cả khung giờ</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {items.map((item) => (
                    <View key={item.id} style={styles.scheduleRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.medName}>
                          - {item.name} {item.dosage ? `(${item.dosage})` : ""}
                        </Text>
                        <Text style={styles.medMeta}>[{String(item.status).toUpperCase()}]</Text>
                      </View>
                    </View>
                  ))}
                  {slotNeedsAction && canMarkMedicationIntake && (
                    <View style={styles.slotActionsRow}>
                      <TouchableOpacity
                        style={styles.takenBtn}
                        onPress={() => void onMarkSlotTaken(time, slotIds)}
                        disabled={!canMarkMedicationIntake}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="checkmark-circle-outline" size={16} color="#166534" />
                        <Text style={styles.takenBtnText}>Đã uống</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.skipBtn}
                        onPress={() => void onMarkSlotSkipped(time, slotIds)}
                        disabled={!canMarkMedicationIntake}
                        activeOpacity={0.9}
                      >
                        <Ionicons name="close-circle-outline" size={16} color="#92400E" />
                        <Text style={styles.skipBtnText}>Bỏ qua</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  noticeContainer: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  noticeCard: {
    backgroundColor: "#0B1220",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  noticeTitle: { color: "#F9FAFB", fontWeight: "900", fontSize: 14 },
  noticeClose: { color: "#D1D5DB", fontSize: 18, fontWeight: "700", paddingHorizontal: 4 },
  noticeItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  noticeItemName: { color: "#E5E7EB", fontSize: 13, fontWeight: "600" },
  noticeTakenBtn: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noticeTakenText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  noticeSkipBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  noticeSkipText: { color: "#92400E", fontSize: 12, fontWeight: "700" },
  noticeReadonly: { color: "#FDE68A", fontSize: 12, fontWeight: "700", marginTop: 8 },
  noticeActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  container: { flex: 1, backgroundColor: COLORS.bg },
  contentWrap: { padding: 16, paddingBottom: 28, gap: 12 },
  headerBar: {
    backgroundColor: COLORS.bg,
    height: 56,
    paddingTop: 6,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
  },
  headerBarTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", flex: 1, textAlign: "center" },

  quickNav: { flexDirection: "row", gap: 8, marginTop: 4, marginBottom: 2 },
  quickNavChip: {
    flex: 1,
    backgroundColor: "rgba(167,139,250,0.14)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  quickNavText: { fontSize: 12, fontWeight: "900", color: COLORS.primary },

  todayHero: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    borderRadius: 22,
    padding: 16,
    gap: 12,
    shadowColor: "#0F172A",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  todayHeroTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  todayHeroIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167,139,250,0.16)",
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
  },
  todayHeroTitle: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  todayHeroSub: { marginTop: 2, fontSize: 12, fontWeight: "600", color: COLORS.sub, lineHeight: 18 },
  todayHeroStatsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#FFFFFF",
  },
  todayStat: { flex: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 2 },
  todayStatValue: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  todayStatLabel: { fontSize: 11, fontWeight: "700", color: COLORS.sub },
  todayStatDivider: { width: 1, backgroundColor: "rgba(148,163,184,0.22)" },
  card: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    padding: 14,
    gap: 10,
    shadowColor: "#0F172A",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  cardTitle: { fontSize: 16, color: COLORS.text, fontWeight: "900" },
  cardHint: { fontSize: 12, color: COLORS.sub, fontWeight: "600", lineHeight: 18 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.28)",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "700",
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },
  rowActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "900", fontSize: 13 },
  lightBtn: {
    backgroundColor: "rgba(167,139,250,0.14)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(167,139,250,0.28)",
  },
  lightBtnText: { color: COLORS.primary, fontSize: 12, fontWeight: "900" },
  deleteBtn: {
    backgroundColor: "rgba(239,68,68,0.12)",
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
  },
  deleteBtnText: { color: "#B91C1C", fontSize: 12, fontWeight: "900" },
  medicationRow: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  medName: { color: COLORS.text, fontSize: 14, fontWeight: "900" },
  medMeta: { color: COLORS.sub, fontSize: 12, fontWeight: "600" },
  timeText: { fontSize: 34, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  timeTrigger: { alignItems: "center", gap: 2 },
  timeHint: { color: COLORS.sub, fontSize: 12, fontWeight: "700" },
  timePickerWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  iosPickerWrap: {
    alignSelf: "stretch",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    height: 190,
    paddingVertical: 0,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  iosPicker: {
    width: "92%",
    maxWidth: 320,
    height: 180,
  },
  stepBtn: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  stepText: { color: "#3730A3", fontSize: 12, fontWeight: "700" },
  repeatRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  repeatPill: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFF",
  },
  repeatPillActive: { borderColor: "rgba(167,139,250,0.55)", backgroundColor: "rgba(167,139,250,0.16)" },
  repeatText: { color: "#4B5563", fontSize: 12 },
  repeatTextActive: { color: COLORS.primary, fontWeight: "900" },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F8FAFC",
  },
  settingLabel: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  settingValue: { color: COLORS.warn, fontSize: 14, fontWeight: "900" },
  repeatHintPill: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#F8FAFC",
  },
  repeatHintText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
  },
  selectRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 1,
    borderColor: "#9CA3AF",
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 3,
  },
  checkboxActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  checkboxText: { color: "#FFF", fontWeight: "700" },
  groupCard: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 10,
    gap: 6,
    marginBottom: 10,
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  groupTime: { fontSize: 20, fontWeight: "900", color: COLORS.text, flexShrink: 1 },
  deleteSlotBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "rgba(239,68,68,0.12)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.22)",
  },
  deleteSlotBtnText: { color: "#B91C1C", fontWeight: "800", fontSize: 11 },
  slotActionsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
    flexWrap: "wrap",
    alignItems: "center",
  },
  scheduleRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  takenBtn: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  takenBtnText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  skipBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  skipBtnText: { color: "#92400E", fontSize: 12, fontWeight: "700" },
  loadingWrap: { paddingVertical: 14, alignItems: "center", gap: 8 },
  loadingText: { color: "#6B7280", fontSize: 12 },
  warnText: {
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  readonlyBadge: {
    alignSelf: "flex-start",
    color: "#92400E",
    backgroundColor: "#FEF3C7",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  emptyText: { color: "#6B7280", fontSize: 13 },
  errorText: {
    color: "#991B1B",
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
  successText: {
    color: "#166534",
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
