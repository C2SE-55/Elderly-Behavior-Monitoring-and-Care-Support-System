import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { api, getCurrentUser } from "../../services/api";

type ReminderStatus = "pending" | "done" | "early";

type ReminderItem = {
  id: string;
  time: string;
  note: string;
  dosage?: string;
  detail?: string;
  userName?: string;
  date?: string;
  status: ReminderStatus;
};

type DayItem = {
  id: string;
  date: string;
  day: string;
};

const DAYS: DayItem[] = [
  { id: "d1", date: "22", day: "CN" },
  { id: "d2", date: "23", day: "T2" },
  { id: "d3", date: "24", day: "T3" },
  { id: "d4", date: "25", day: "T4" },
  { id: "d5", date: "26", day: "T5" },
  { id: "d6", date: "27", day: "T6" },
  { id: "d7", date: "28", day: "T7" },
  { id: "d8", date: "1", day: "CN" },
];

const MOCK_REMINDERS: ReminderItem[] = [
  {
    id: "mock-1",
    time: "8:00",
    note: "Uống thuốc cảm",
    dosage: "1 viên / ngày",
    detail: "Uống sau ăn",
    userName: "Nguyễn Văn A",
    date: "26/02/2026",
    status: "done",
  },
  {
    id: "mock-2",
    time: "13:15",
    note: "Uống thuốc đau đầu",
    dosage: "1 viên / ngày",
    detail: "Uống sau ăn",
    userName: "Nguyễn Văn A",
    date: "26/02/2026",
    status: "done",
  },
  {
    id: "mock-3",
    time: "13:30",
    note: "Uống thuốc dạ dày",
    dosage: "1 viên / ngày",
    detail: "Uống sau ăn",
    userName: "Nguyễn Văn A",
    date: "26/02/2026",
    status: "done",
  },
  {
    id: "mock-4",
    time: "14:00",
    note: "Uống thuốc thận",
    dosage: "1 viên / ngày",
    detail: "Uống sau ăn",
    userName: "Nguyễn Văn A",
    date: "26/02/2026",
    status: "done",
  },
  {
    id: "mock-5",
    time: "16:00",
    note: "Uống thuốc",
    dosage: "1 viên / ngày",
    detail: "Uống sau ăn",
    userName: "Nguyễn Văn A",
    date: "26/02/2026",
    status: "done",
  },
];

export default function MedicineReminderScreen() {
  const [selectedDayId, setSelectedDayId] = useState("d4");
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [screenError, setScreenError] = useState("");
  const [useMockData, setUseMockData] = useState(false);
  const swipeableRefs = useRef<Record<string, Swipeable | null>>({});
  const user = getCurrentUser();

  const selectedDay = useMemo(
    () => DAYS.find((day) => day.id === selectedDayId) ?? DAYS[0],
    [selectedDayId]
  );

  const closeAllSwipeables = () => {
    Object.values(swipeableRefs.current).forEach((ref) => ref?.close());
  };

  const loadReminders = useCallback(async () => {
    if (!user?.id) {
      setReminders(MOCK_REMINDERS);
      setScreenError("");
      setUseMockData(true);
      return;
    }
    try {
      setLoading(true);
      setScreenError("");
      const response = await api.get(`/medication-reminders/profile/${user.id}`);
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      const mapped: ReminderItem[] = rows.map((item: any, idx: number) => ({
        id: String(item.id ?? `local-${idx}`),
        time: String(item.time ?? ""),
        note: String(item.note ?? "Uống thuốc"),
        dosage: item.dosage ? String(item.dosage) : undefined,
        detail: item.detail ? String(item.detail) : undefined,
        userName: user?.full_name ?? "Người dùng",
        date: item.date ? String(item.date) : undefined,
        status: item.status === "done" ? "done" : "pending",
      }));
      setReminders(mapped);
      setUseMockData(false);
    } catch (error) {
      console.warn("Không thể tải danh sách nhắc thuốc:", error);
      setScreenError("");
      setReminders(MOCK_REMINDERS);
      setUseMockData(true);
    } finally {
      setLoading(false);
    }
  }, [user?.full_name, user?.id]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  const markDone = async (id: string) => {
    if (useMockData) {
      setReminders((prev) => prev.map((item) => (item.id === id ? { ...item, status: "done" } : item)));
      return;
    }
    try {
      await api.patch(`/medication-reminders/${id}/mark-done`);
      await loadReminders();
    } catch (error) {
      console.warn("Không thể cập nhật trạng thái:", error);
      setScreenError("Không thể đánh dấu đã uống thuốc.");
    }
  };

  const removeReminder = async (id: string) => {
    swipeableRefs.current[id]?.close();
    if (useMockData) {
      setReminders((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    try {
      await api.delete(`/medication-reminders/${id}`);
      await loadReminders();
    } catch (error) {
      console.warn("Không thể xóa nhắc thuốc:", error);
      setScreenError("Không thể xóa nhắc thuốc.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.monthText}>Thg 2 2026</Text>

        <View style={styles.daysWrap}>
          {DAYS.map((day) => {
            const isActive = day.id === selectedDayId;
            return (
              <TouchableOpacity
                key={day.id}
                style={[styles.dayPill, isActive && styles.dayPillActive]}
                activeOpacity={0.85}
                onPress={() => setSelectedDayId(day.id)}
              >
                <Text style={[styles.dayDate, isActive && styles.dayDateActive]}>{day.date}</Text>
                <Text style={[styles.dayLabel, isActive && styles.dayLabelActive]}>{day.day}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!!screenError && <Text style={styles.formErrorText}>{screenError}</Text>}
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#16A34A" />
            <Text style={styles.loadingText}>Đang tải dữ liệu nhắc thuốc...</Text>
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.scheduleList} showsVerticalScrollIndicator={false}>
          {reminders.map((item) => {
            const isDone = item.status === "done";
            const doneText = isDone ? "Xong" : "Sẵn";

            return (
              <View key={item.id} style={styles.block}>
                <Text style={styles.blockTime}>{item.time}</Text>
                <Swipeable
                  ref={(ref) => {
                    swipeableRefs.current[item.id] = ref;
                  }}
                  overshootRight={false}
                  renderRightActions={() => (
                    <View style={styles.rightActions}>
                      <TouchableOpacity
                        style={[styles.swipeActionBtn, styles.editBtn]}
                        onPress={closeAllSwipeables}
                      >
                        <Text style={styles.swipeActionText}>Sửa</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.swipeActionBtn, styles.deleteBtn]}
                        onPress={() => removeReminder(item.id)}
                      >
                        <Text style={styles.swipeActionText}>Xóa</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                >
                  <View style={styles.card}>
                    <Text style={styles.dayHint}>
                      CN T2 T3 {selectedDay.day} T5 T6 T7
                    </Text>
                    <View style={styles.cardBody}>
                      <Text style={styles.noteText}>{item.note}</Text>
                      <View style={styles.actions}>
                        <TouchableOpacity
                          style={[styles.actionBtn, isDone ? styles.doneBtnActive : styles.doneBtn]}
                          onPress={() => markDone(item.id)}
                        >
                          <Text style={styles.doneBtnText}>{doneText}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </Swipeable>
              </View>
            );
          })}
        </ScrollView>
        )}

        <TouchableOpacity
          style={styles.addButton}
          activeOpacity={0.9}
          onPress={closeAllSwipeables}
        >
          <Text style={styles.addButtonIcon}>⊕</Text>
          <Text style={styles.addButtonText}>Thêm một loại thuốc</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#FFFFFF" },
  container: { flex: 1, backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingTop: 8 },
  monthText: { color: "#4B5563", fontSize: 14, marginBottom: 8 },
  daysWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  dayPill: {
    width: 34,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    backgroundColor: "#16A34A",
  },
  dayPillActive: { backgroundColor: "#0EA5E9" },
  dayDate: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
  dayDateActive: { color: "#FFFFFF" },
  dayLabel: { color: "#E5E7EB", fontSize: 10, marginTop: 2 },
  dayLabelActive: { color: "#E0F2FE" },
  scheduleList: { paddingBottom: 20 },
  loadingWrap: {
    paddingVertical: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    color: "#6B7280",
    fontSize: 13,
  },
  block: { marginBottom: 12 },
  blockTime: { color: "#374151", fontSize: 13, marginBottom: 4, marginLeft: 4 },
  card: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rightActions: { flexDirection: "row", alignItems: "stretch" },
  swipeActionBtn: {
    width: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  swipeActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  dayHint: {
    color: "#6B7280",
    fontSize: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#E5E7EB",
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  noteText: { color: "#111827", fontSize: 13, flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionBtn: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  doneBtn: { backgroundColor: "#D1D5DB" },
  doneBtnActive: { backgroundColor: "#86EFAC" },
  doneBtnText: { color: "#111827", fontSize: 11, fontWeight: "600" },
  editBtn: { backgroundColor: "#FACC15" },
  deleteBtn: { backgroundColor: "#DC2626" },
  addButton: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  addButtonIcon: { color: "#111827", fontSize: 14 },
  addButtonText: { color: "#111827", fontSize: 14, fontWeight: "500" },
  formErrorText: {
    color: "#FCA5A5",
    fontSize: 12,
    marginTop: -4,
  },
});
