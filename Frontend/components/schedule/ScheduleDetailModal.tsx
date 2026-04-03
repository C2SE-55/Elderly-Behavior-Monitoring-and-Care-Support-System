import React from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DailyScheduleItem } from "@/services/api";

type Props = {
  visible: boolean;
  item: DailyScheduleItem | null;
  onClose: () => void;
  canManage?: boolean;
  isPast?: boolean;
  onDone?: (item: DailyScheduleItem) => void;
};

const TYPE_LABEL: Record<DailyScheduleItem["type"], string> = {
  meal: "Ăn uống",
  exercise: "Vận động",
  rest: "Nghỉ ngơi",
  other: "Khác",
};

export default function ScheduleDetailModal({
  visible,
  item,
  onClose,
  canManage = false,
  isPast = false,
  onDone,
}: Props) {
  const insets = useSafeAreaInsets();
  if (!visible) return null;

  const canAct = !!item && canManage && item.id > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top, 12), paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Chi tiết lịch sinh hoạt</Text>
            {!item ? (
              <Text style={styles.value}>Không có dữ liệu.</Text>
            ) : (
              <>
                <View style={styles.row}>
                  <Text style={styles.label}>Thời gian</Text>
                  <Text style={styles.value}>
                    {String(item.start_time).slice(0, 5)} - {String(item.end_time).slice(0, 5)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Tiêu đề</Text>
                  <Text style={styles.value}>{item.title}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Loại</Text>
                  <Text style={styles.value}>{TYPE_LABEL[item.type] || item.type}</Text>
                </View>
                <View style={styles.row}>
                  <Text style={styles.label}>Mô tả</Text>
                  <Text style={styles.value}>{item.description?.trim() ? item.description : "—"}</Text>
                </View>
              </>
            )}

            <View style={styles.actions}>
              <View style={styles.rightActions}>
                {canAct ? (
                  <TouchableOpacity style={styles.doneBtn} onPress={() => item && onDone?.(item)}>
                    <Text style={styles.doneText}>Đã xong</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                  <Text style={styles.closeText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  scrollContent: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 16 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  row: { gap: 4 },
  label: { fontSize: 12, color: "#4B5563", fontWeight: "800" },
  value: { fontSize: 14, color: "#111827", fontWeight: "600", lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 2 },
  rightActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  doneBtn: { backgroundColor: "#16A34A", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  doneText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
  closeBtn: { backgroundColor: "#2563EB", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  closeText: { color: "#FFF", fontSize: 12, fontWeight: "800" },
});

