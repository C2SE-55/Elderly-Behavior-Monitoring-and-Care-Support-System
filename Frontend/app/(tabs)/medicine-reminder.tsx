import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
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
import {
  createMedication,
  createSchedules,
  deleteMedication,
  deleteSchedulesForSlot,
  getMyRoom,
  getMedications,
  getTodaySchedules,
  markMedicationSlotSkipped,
  markMedicationSlotTaken,
  MedicationItem,
  MyRoomInfo,
  TodayScheduleItem,
  updateMedication,
  updateMedicationDailyReminders,
  subscribeActiveRoomChange,
} from "../../services/api";
import { ensureNotificationPermission, rescheduleMedicationNotifications } from "@/services/medicationNotifications";
import { dismissMedicationReminderLogsForMedicationSlot } from "@/services/notificationLog";
import { connectRoomChatSocket, getRoomChatSocket } from "@/services/roomChatSocket";

type RepeatType = "once" | "daily";

const pad2 = (value: number) => String(value).padStart(2, "0");
const localDateYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};
const nowHHMM = () => {
  const now = new Date();
  return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
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
  const [editingMedicationId, setEditingMedicationId] = useState<number | null>(null);

  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [androidPickerOpen, setAndroidPickerOpen] = useState(false);
  const [repeatType, setRepeatType] = useState<RepeatType>("daily");
  const [selectedMedicationIds, setSelectedMedicationIds] = useState<number[]>([]);
  const [doseOverrides, setDoseOverrides] = useState<Record<number, string>>({});

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

  const loadAll = useCallback(async () => {
    if (!canReadRoomData) {
      setMedications([]);
      setTodaySchedules([]);
      return;
    }
    try {
      setLoading(true);
      setScreenError("");
      const [meds, schedules] = await Promise.all([getMedications(), getTodaySchedules()]);
      setMedications(meds);
      setTodaySchedules(schedules);
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không tải được dữ liệu nhắc thuốc.");
    } finally {
      setLoading(false);
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
      await rescheduleMedicationNotifications(todaySchedules, { allowDaily });
    })();
  }, [todaySchedules, canReceiveMedicationNotifications, roomInfo?.medication_daily_reminders_enabled]);

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
      await loadPermissions();
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
      } catch {
        // Polling silently; lỗi đã hiển thị ở lần tải chính.
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [canReadRoomData, canReceiveMedicationNotifications, showDueNotice, loadPermissions]);

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
    try {
      setSavingSchedule(true);
      setScreenError("");
      setSuccessMessage("");

      await createSchedules({
        alarm_time: selectedTime,
        repeat_type: repeatType,
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
    try {
      setScreenError("");
      const data = await markMedicationSlotTaken(t);
      const ymd = String(data?.intake_date || localDateYmd()).slice(0, 10);
      const ids =
        Array.isArray(data?.schedule_ids) && data.schedule_ids.length
          ? data.schedule_ids.map(Number)
          : scheduleIdsFallback;
      await dismissMedicationReminderLogsForMedicationSlot(ymd, ids, t);
      await loadAll();
      return true;
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
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
    try {
      setScreenError("");
      const data = await markMedicationSlotSkipped(t);
      const ymd = String(data?.intake_date || localDateYmd()).slice(0, 10);
      const ids =
        Array.isArray(data?.schedule_ids) && data.schedule_ids.length
          ? data.schedule_ids.map(Number)
          : scheduleIdsFallback;
      await dismissMedicationReminderLogsForMedicationSlot(ymd, ids, t);
      await loadAll();
      return true;
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
      setScreenError(backendMessage || "Không thể đánh dấu bỏ qua.");
      return false;
    }
  };

  const onDeleteSlot = async (alarmTime: string) => {
    if (!canManageMedication) {
      setScreenError("Bạn không có quyền xóa lịch thuốc.");
      return;
    }
    const t = String(alarmTime || "").slice(0, 5);
    if (!t) return;
    try {
      setScreenError("");
      await deleteSchedulesForSlot(t);
      setSuccessMessage("Đã xóa toàn bộ lịch trong khung giờ này.");
      await loadAll();
    } catch (error) {
      const backendMessage = (error as any)?.response?.data?.message;
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
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle}>Nhắc uống thuốc</Text>
        <View style={{ width: 22 }} />
      </View>
      <Animated.View
        style={[
          styles.noticeContainer,
          {
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
                <Text style={styles.noticeTakenText}>Taken</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.noticeSkipBtn} onPress={() => void handleNoticeSlotAction("skipped")}>
                <Text style={styles.noticeSkipText}>Skip</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.noticeReadonly}>Chỉ xem</Text>
          )}
        </View>
      </Animated.View>

      <ScrollView style={styles.container} contentContainerStyle={styles.contentWrap}>
        {!!screenError && <Text style={styles.errorText}>{screenError}</Text>}
        {!!successMessage && <Text style={styles.successText}>{successMessage}</Text>}
        {roomInfo?.member_role === "caretaker" && <Text style={styles.readonlyBadge}>Chỉ xem</Text>}
        {!!permissionMessage && <Text style={styles.warnText}>{permissionMessage}</Text>}
        {permissionLoading && <Text style={styles.loadingText}>Đang kiểm tra quyền trong room...</Text>}
        {!!roomInfo?.room_id && <Text style={styles.loadingText}>Room: {roomInfo.room_id}</Text>}

        {roomInfo?.member_role === "host" && (
          <View style={styles.card}>
            <View style={styles.hostDailyRow}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.cardTitle}>Nhắc lặp hằng ngày (máy)</Text>
                <Text style={styles.cardHint}>
                  Tắt để không lên lịch thông báo OS cho lịch &quot;daily&quot; trong room (chỉ host).
                </Text>
              </View>
              <Switch
                value={
                  roomInfo.medication_daily_reminders_enabled !== false &&
                  roomInfo.medication_daily_reminders_enabled !== 0
                }
                onValueChange={(v) => {
                  void (async () => {
                    try {
                      setScreenError("");
                      await updateMedicationDailyReminders(v);
                      await loadPermissions();
                      await loadAll();
                    } catch (error) {
                      const backendMessage = (error as any)?.response?.data?.message;
                      setScreenError(backendMessage || "Không cập nhật được cài đặt nhắc hằng ngày.");
                    }
                  })();
                }}
                trackColor={{ false: "#D1D5DB", true: "#A78BFA" }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>1) Nhập thuốc</Text>
          <TextInput
            value={medicineName}
            onChangeText={setMedicineName}
            placeholder="Tên thuốc (name)"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            editable={canManageMedication}
          />
          <TextInput
            value={medicineDosage}
            onChangeText={setMedicineDosage}
            placeholder="Liều lượng mặc định (dosage)"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            editable={canManageMedication}
          />
          <TextInput
            value={medicineNote}
            onChangeText={setMedicineNote}
            placeholder="Ghi chú (note)"
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

        <View style={styles.card}>
          <Text style={styles.cardTitle}>2) Đặt lịch uống thuốc</Text>
          <Text style={styles.timeText}>{selectedTime}</Text>
          {Platform.OS === "ios" ? (
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
          ) : (
            <>
              <TouchableOpacity
                style={[styles.primaryBtn, !canManageMedication && { opacity: 0.6 }]}
                onPress={() => setAndroidPickerOpen(true)}
                disabled={!canManageMedication}
              >
                <Text style={styles.primaryBtnText}>Chọn giờ (Time picker)</Text>
              </TouchableOpacity>
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
              style={[styles.repeatPill, repeatType === "once" && styles.repeatPillActive, !canManageMedication && { opacity: 0.6 }]}
              onPress={() => setRepeatType("once")}
              disabled={!canManageMedication}
            >
              <Text style={[styles.repeatText, repeatType === "once" && styles.repeatTextActive]}>1 lần</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.repeatPill, repeatType === "daily" && styles.repeatPillActive, !canManageMedication && { opacity: 0.6 }]}
              onPress={() => setRepeatType("daily")}
              disabled={!canManageMedication}
            >
              <Text style={[styles.repeatText, repeatType === "daily" && styles.repeatTextActive]}>Hàng ngày</Text>
            </TouchableOpacity>
          </View>

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
                        onPress={() => void onDeleteSlot(time)}
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
                      >
                        <Text style={styles.takenBtnText}>✔ Taken (cả đơn)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.skipBtn}
                        onPress={() => void onMarkSlotSkipped(time, slotIds)}
                        disabled={!canMarkMedicationIntake}
                      >
                        <Text style={styles.skipBtnText}>Skip (cả đơn)</Text>
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
  safeArea: { flex: 1, backgroundColor: "#F6F7FB" },
  noticeContainer: {
    position: "absolute",
    top: 8,
    left: 10,
    right: 10,
    zIndex: 20,
  },
  noticeCard: {
    backgroundColor: "#111827",
    borderRadius: 14,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  noticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  noticeTitle: { color: "#F9FAFB", fontWeight: "700", fontSize: 14 },
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
  },
  noticeTakenText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  noticeSkipBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
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
  container: { flex: 1, backgroundColor: "#F6F7FB" },
  contentWrap: { padding: 16, paddingBottom: 24, gap: 12 },
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
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    gap: 10,
  },
  cardTitle: { fontSize: 16, color: "#111827", fontWeight: "700" },
  cardHint: { fontSize: 12, color: "#6B7280" },
  hostDailyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: "#111827",
  },
  textArea: { minHeight: 60, textAlignVertical: "top" },
  rowActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  primaryBtn: {
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "700", fontSize: 13 },
  lightBtn: {
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lightBtnText: { color: "#1D4ED8", fontSize: 12, fontWeight: "700" },
  deleteBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteBtnText: { color: "#991B1B", fontSize: 12, fontWeight: "700" },
  medicationRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    padding: 8,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  medName: { color: "#111827", fontSize: 14, fontWeight: "700" },
  medMeta: { color: "#6B7280", fontSize: 12 },
  timeText: { fontSize: 34, fontWeight: "700", color: "#111827", textAlign: "center" },
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
  repeatPillActive: { borderColor: "#2563EB", backgroundColor: "#DBEAFE" },
  repeatText: { color: "#4B5563", fontSize: 12 },
  repeatTextActive: { color: "#1D4ED8", fontWeight: "700" },
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
  checkboxActive: { backgroundColor: "#2563EB", borderColor: "#2563EB" },
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
  groupTime: { fontSize: 20, fontWeight: "700", color: "#111827", flexShrink: 1 },
  deleteSlotBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
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
  },
  takenBtnText: { color: "#166534", fontSize: 12, fontWeight: "700" },
  skipBtn: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
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
