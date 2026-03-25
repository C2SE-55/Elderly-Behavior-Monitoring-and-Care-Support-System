import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { DailyScheduleItem, DailyScheduleType, DayOfWeek } from "@/services/api";

type FormValue = {
  day_of_week: DayOfWeek;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  type: DailyScheduleType;
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{editingItem ? "Sửa lịch sinh hoạt" : "Thêm lịch sinh hoạt"}</Text>

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
            multiline
          />

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Bắt đầu</Text>
              <TextInput
                value={value.start_time}
                onChangeText={(t) => setValue((prev) => ({ ...prev, start_time: t }))}
                style={styles.input}
                placeholder="HH:mm"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Kết thúc</Text>
              <TextInput
                value={value.end_time}
                onChangeText={(t) => setValue((prev) => ({ ...prev, end_time: t }))}
                style={styles.input}
                placeholder="HH:mm"
              />
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

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSubmit}>
              <Text style={styles.saveText}>{editingItem ? "Lưu sửa" : "Thêm mới"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 16,
  },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
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
