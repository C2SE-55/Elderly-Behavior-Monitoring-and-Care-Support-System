import React, { useEffect, useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DailyScheduleItem, DailyScheduleType, DayOfWeek } from "@/services/api";

type FormValue = {
  day_of_week: DayOfWeek;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  type: DailyScheduleType;
};

const timeStringToDate = (value: string) => {
  const now = new Date();
  const [hRaw, mRaw] = String(value || "00:00").split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  now.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return now;
};

const dateToHHmm = (date: Date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
};

type Props = {
  visible: boolean;
  initialDay: DayOfWeek;
  editingItem: DailyScheduleItem | null;
  onClose: () => void;
  onSubmit: (payload: FormValue) => void;
};

const DAY_OPTIONS: { key: DayOfWeek; label: string }[] = [
  { key: "mon", label: "T2" },
  { key: "tue", label: "T3" },
  { key: "wed", label: "T4" },
  { key: "thu", label: "T5" },
  { key: "fri", label: "T6" },
  { key: "sat", label: "T7" },
  { key: "sun", label: "CN" },
];

const TYPE_OPTIONS: { key: DailyScheduleType; label: string }[] = [
  { key: "meal", label: "Ăn uống" },
  { key: "exercise", label: "Vận động" },
  { key: "rest", label: "Nghỉ ngơi" },
  { key: "other", label: "Khác" },
];

export default function ScheduleModal({
  visible,
  initialDay,
  editingItem,
  onClose,
  onSubmit,
}: Props) {
  const insets = useSafeAreaInsets();
  const defaultValue = useMemo<FormValue>(
    () => ({
      day_of_week: initialDay,
      title: "",
      description: "",
      start_time: "08:00",
      end_time: "09:00",
      type: "other",
    }),
    [initialDay]
  );
  const [value, setValue] = useState<FormValue>(defaultValue);
  const [error, setError] = useState("");
  const [iosPickerField, setIosPickerField] = useState<"start" | "end" | null>(null);
  const [androidStartPickerOpen, setAndroidStartPickerOpen] = useState(false);
  const [androidEndPickerOpen, setAndroidEndPickerOpen] = useState(false);

  useEffect(() => {
    if (editingItem) {
      setValue({
        day_of_week: editingItem.day_of_week,
        title: editingItem.title || "",
        description: editingItem.description || "",
        start_time: String(editingItem.start_time).slice(0, 5),
        end_time: String(editingItem.end_time).slice(0, 5),
        type: editingItem.type,
      });
    } else {
      setValue(defaultValue);
    }
    setIosPickerField(null);
    setAndroidStartPickerOpen(false);
    setAndroidEndPickerOpen(false);
    setError("");
  }, [defaultValue, editingItem, visible]);

  const validate = () => {
    if (!value.title.trim()) return "Vui lòng nhập tiêu đề";
    if (!/^\d{2}:\d{2}$/.test(value.start_time) || !/^\d{2}:\d{2}$/.test(value.end_time)) {
      return "Thời gian phải theo định dạng HH:mm";
    }
    if (value.start_time >= value.end_time) return "start_time phải nhỏ hơn end_time";
    return "";
  };

  const handleSubmit = () => {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError("");
    onSubmit(value);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 8 : 0}
        >
          <View
            style={[
              styles.modalStage,
              {
                paddingTop: Math.max(insets.top, 12),
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={styles.card}>
              <Text style={styles.title}>{editingItem ? "Sửa lịch sinh hoạt" : "Thêm lịch sinh hoạt"}</Text>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.label}>Ngày</Text>
                <View style={styles.rowOptions}>
                  {DAY_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pill, value.day_of_week === opt.key && styles.pillActive]}
                      onPress={() => setValue((prev) => ({ ...prev, day_of_week: opt.key }))}
                    >
                      <Text style={[styles.pillText, value.day_of_week === opt.key && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Tiêu đề</Text>
                <TextInput
                  value={value.title}
                  onChangeText={(t) => setValue((prev) => ({ ...prev, title: t }))}
                  style={styles.input}
                  placeholder="Ví dụ: Đi bộ"
                />

                <Text style={styles.label}>Mô tả</Text>
                <TextInput
                  value={value.description}
                  onChangeText={(t) => setValue((prev) => ({ ...prev, description: t }))}
                  style={[styles.input, styles.textArea]}
                  placeholder="Mô tả chi tiết"
                  placeholderTextColor="#6B7280"
                  multiline
                  scrollEnabled={false}
                />

                <View style={styles.timeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Bắt đầu</Text>
                    {Platform.OS === "ios" ? (
                      <TouchableOpacity
                        style={[styles.input, styles.androidTimeButton]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setIosPickerField("start");
                        }}
                      >
                        <Text style={styles.androidTimeText}>{value.start_time}</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.input, styles.androidTimeButton]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setAndroidStartPickerOpen(true);
                          }}
                        >
                          <Text style={styles.androidTimeText}>{value.start_time}</Text>
                        </TouchableOpacity>
                        {androidStartPickerOpen && (
                          <DateTimePicker
                            value={timeStringToDate(value.start_time)}
                            mode="time"
                            display="default"
                            onChange={(_, date) => {
                              setAndroidStartPickerOpen(false);
                              if (!date) return;
                              setValue((prev) => ({ ...prev, start_time: dateToHHmm(date) }));
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Kết thúc</Text>
                    {Platform.OS === "ios" ? (
                      <TouchableOpacity
                        style={[styles.input, styles.androidTimeButton]}
                        onPress={() => {
                          Keyboard.dismiss();
                          setIosPickerField("end");
                        }}
                      >
                        <Text style={styles.androidTimeText}>{value.end_time}</Text>
                      </TouchableOpacity>
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.input, styles.androidTimeButton]}
                          onPress={() => {
                            Keyboard.dismiss();
                            setAndroidEndPickerOpen(true);
                          }}
                        >
                          <Text style={styles.androidTimeText}>{value.end_time}</Text>
                        </TouchableOpacity>
                        {androidEndPickerOpen && (
                          <DateTimePicker
                            value={timeStringToDate(value.end_time)}
                            mode="time"
                            display="default"
                            onChange={(_, date) => {
                              setAndroidEndPickerOpen(false);
                              if (!date) return;
                              setValue((prev) => ({ ...prev, end_time: dateToHHmm(date) }));
                            }}
                          />
                        )}
                      </>
                    )}
                  </View>
                </View>

                <Text style={styles.label}>Loại</Text>
                <View style={styles.rowOptions}>
                  {TYPE_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={[styles.pill, value.type === opt.key && styles.pillActive]}
                      onPress={() => setValue((prev) => ({ ...prev, type: opt.key }))}
                    >
                      <Text style={[styles.pillText, value.type === opt.key && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {!!error && <Text style={styles.error}>{error}</Text>}
              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelText}>Hủy</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
                  <Text style={styles.saveText}>{editingItem ? "Lưu sửa" : "Thêm mới"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {Platform.OS === "ios" && iosPickerField && (
              <View style={styles.iosPickerOverlay}>
                <View style={styles.iosPickerSheet}>
                  <View style={styles.iosDoneRow}>
                    <Text style={styles.iosPickerTitle}>
                      {iosPickerField === "start" ? "Chọn giờ bắt đầu" : "Chọn giờ kết thúc"}
                    </Text>
                    <TouchableOpacity style={styles.iosDoneBtn} onPress={() => setIosPickerField(null)}>
                      <Text style={styles.iosDoneText}>Xong</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.iosPickerCenter}>
                    <DateTimePicker
                      value={timeStringToDate(iosPickerField === "start" ? value.start_time : value.end_time)}
                      mode="time"
                      display="spinner"
                      onChange={(_, date) => {
                        if (!date) return;
                        if (iosPickerField === "start") {
                          setValue((prev) => ({ ...prev, start_time: dateToHHmm(date) }));
                        } else {
                          setValue((prev) => ({ ...prev, end_time: dateToHHmm(date) }));
                        }
                      }}
                      minuteInterval={1}
                      textColor="#111827"
                      themeVariant="light"
                      style={styles.iosPicker}
                    />
                  </View>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  keyboardAvoid: {
    flex: 1,
  },
  modalStage: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    maxHeight: "85%",
  },
  formScroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  formContent: {
    paddingBottom: 12,
    gap: 8,
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  label: { fontSize: 12, color: "#4B5563", fontWeight: "700", marginTop: 2 },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: "#F9FAFB",
    fontSize: 14,
  },
  textArea: { minHeight: 58, textAlignVertical: "top" },
  rowOptions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  pill: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "#FFF",
  },
  pillActive: { borderColor: "#2563EB", backgroundColor: "#DBEAFE" },
  pillText: { fontSize: 12, color: "#4B5563", fontWeight: "600" },
  pillTextActive: { color: "#1D4ED8", fontWeight: "700" },
  timeRow: { flexDirection: "row", gap: 8 },
  iosPickerWrap: {
    display: "none",
  },
  iosPicker: {
    width: 300,
    height: 180,
  },
  iosPickerCenter: {
    alignItems: "center",
    justifyContent: "center",
  },
  iosPickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  iosPickerSheet: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
    width: "88%",
    maxWidth: 360,
    minHeight: 250,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    justifyContent: "center",
  },
  iosDoneRow: {
    width: "100%",
    paddingHorizontal: 4,
    paddingBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iosPickerTitle: {
    color: "#111827",
    fontWeight: "700",
    fontSize: 13,
    paddingHorizontal: 6,
    flexShrink: 1,
  },
  iosDoneBtn: {
    backgroundColor: "#DBEAFE",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  iosDoneText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 12,
  },
  androidTimeButton: {
    justifyContent: "center",
  },
  androidTimeText: {
    fontSize: 15,
    color: "#111827",
    fontWeight: "600",
  },
  error: { color: "#B91C1C", fontSize: 12, marginTop: 2 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 8 },
  cancelBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: { color: "#374151", fontSize: 12, fontWeight: "700" },
  saveBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
});
