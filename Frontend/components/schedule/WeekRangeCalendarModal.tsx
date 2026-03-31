import React, { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";

type Props = {
  visible: boolean;
  weekStart: dayjs.Dayjs;
  weekEnd: dayjs.Dayjs;
  valueStart: dayjs.Dayjs;
  valueEnd: dayjs.Dayjs;
  onClose: () => void;
  onApply: (start: dayjs.Dayjs, end: dayjs.Dayjs) => void;
};

type Cell = { date: dayjs.Dayjs; inMonth: boolean };

const DOW_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

const getMonday = (base: dayjs.Dayjs) => {
  const jsDay = base.day();
  const diffFromMonday = (jsDay + 6) % 7;
  return base.startOf("day").subtract(diffFromMonday, "day");
};

const buildMonthMatrix = (month: dayjs.Dayjs): Cell[][] => {
  const m = month.startOf("month");
  const startJsDay = m.day(); // 0=Sun
  const startGrid = m.subtract(startJsDay, "day").startOf("day");
  const endGrid = month.endOf("month").add(6 - month.endOf("month").day(), "day").startOf("day");
  const weeks: Cell[][] = [];
  let cursor = startGrid;
  while (cursor.isBefore(endGrid) || cursor.isSame(endGrid, "day")) {
    const row: Cell[] = [];
    for (let i = 0; i < 7; i += 1) {
      row.push({ date: cursor, inMonth: cursor.isSame(m, "month") });
      cursor = cursor.add(1, "day");
    }
    weeks.push(row);
  }
  return weeks;
};

const isBetweenInclusive = (d: dayjs.Dayjs, a: dayjs.Dayjs, b: dayjs.Dayjs) => {
  const start = a.isBefore(b) ? a : b;
  const end = a.isBefore(b) ? b : a;
  return (d.isAfter(start, "day") && d.isBefore(end, "day")) || d.isSame(start, "day") || d.isSame(end, "day");
};

export default function WeekRangeCalendarModal({
  visible,
  weekStart,
  weekEnd,
  valueStart,
  valueEnd,
  onClose,
  onApply,
}: Props) {
  const insets = useSafeAreaInsets();
  const [tempStart, setTempStart] = useState<dayjs.Dayjs | null>(valueStart.startOf("day"));
  const [tempEnd, setTempEnd] = useState<dayjs.Dayjs | null>(valueEnd.startOf("day"));
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [cursorMonth, setCursorMonth] = useState<dayjs.Dayjs>(weekStart.startOf("month"));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!visible) return;
    setTempStart(valueStart.startOf("day"));
    setTempEnd(valueEnd.startOf("day"));
    setCursorMonth(valueStart.startOf("month"));
    setSelectingEnd(false);
    setError("");
  }, [valueEnd, valueStart, visible]);

  const months = useMemo(() => [cursorMonth], [cursorMonth]);

  const effectiveEnd = tempEnd || tempStart || valueStart.startOf("day");
  const effectiveStart = tempStart || valueStart.startOf("day");
  const activeWeekStart = useMemo(() => getMonday(effectiveStart), [effectiveStart]);
  const activeWeekEnd = useMemo(() => activeWeekStart.add(6, "day"), [activeWeekStart]);

  const handlePick = (d: dayjs.Dayjs) => {
    setError("");
    const next = d.startOf("day");
    // UX:
    // - Tap 1 lần: chọn 1 ngày (start=end) ngay lập tức.
    // - Nếu muốn chọn khoảng: tap lần 2 để chọn ngày kết thúc (cùng tuần).
    if (!tempStart || !selectingEnd) {
      setTempStart(next);
      setTempEnd(next);
      setSelectingEnd(true);
      setCursorMonth(next.startOf("month"));
      return;
    }

    // selecting end
    const startWeek = getMonday(tempStart);
    const endWeek = getMonday(next);
    if (!startWeek.isSame(endWeek, "day")) {
      setError("Ngày kết thúc phải nằm trong cùng 1 tuần với ngày bắt đầu.");
      return;
    }
    setTempEnd(next);
    setSelectingEnd(false);
  };

  const handleClear = () => {
    setError("");
    setTempStart(weekStart.startOf("day"));
    setTempEnd(weekEnd.startOf("day"));
    setCursorMonth(weekStart.startOf("month"));
    setSelectingEnd(false);
  };

  const handleChoose = () => {
    if (!tempStart) {
      setError("Vui lòng chọn ngày bắt đầu.");
      return;
    }
    const s = tempStart.startOf("day");
    const e = (tempEnd || tempStart).startOf("day");
    const start = s.isBefore(e) ? s : e;
    const end = s.isBefore(e) ? e : s;
    onApply(start, end);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Chọn khoảng ngày</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Text style={styles.headerClose}>Đóng</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryText}>
              {effectiveStart.format("DD/MM/YY")} - {effectiveEnd.format("DD/MM/YY")}
            </Text>
            <Text style={styles.weekHint}>
              Tuần: {activeWeekStart.format("DD/MM")} - {activeWeekEnd.format("DD/MM")}
            </Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {months.map((m) => (
              <View key={m.format("YYYY-MM")} style={styles.monthBlock}>
                <View style={styles.monthHeaderRow}>
                  <TouchableOpacity
                    onPress={() => setCursorMonth((prev) => prev.subtract(1, "month"))}
                    style={styles.monthNavBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.monthNavText}>‹</Text>
                  </TouchableOpacity>
                  <Text style={styles.monthTitle}>{m.format("[Tháng] M YYYY")}</Text>
                  <TouchableOpacity
                    onPress={() => setCursorMonth((prev) => prev.add(1, "month"))}
                    style={styles.monthNavBtn}
                    hitSlop={6}
                  >
                    <Text style={styles.monthNavText}>›</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dowRow}>
                  {DOW_LABELS.map((t) => (
                    <Text key={t} style={styles.dowText}>
                      {t}
                    </Text>
                  ))}
                </View>
                <View style={styles.grid}>
                  {buildMonthMatrix(m).map((row, idx) => (
                    <View key={idx} style={styles.weekRow}>
                      {row.map((cell) => {
                        const d = cell.date;
                        const selected = isBetweenInclusive(d, effectiveStart, effectiveEnd);
                        const isStart = tempStart ? d.isSame(tempStart, "day") : false;
                        const isEnd = tempEnd ? d.isSame(tempEnd, "day") : d.isSame(effectiveEnd, "day");
                        const outOfActiveWeek = tempStart ? d.isBefore(activeWeekStart, "day") || d.isAfter(activeWeekEnd, "day") : false;
                        return (
                          <TouchableOpacity
                            key={d.format("YYYY-MM-DD")}
                            style={[
                              styles.dayCell,
                              selected && styles.daySelected,
                              (isStart || isEnd) && styles.dayEdge,
                              outOfActiveWeek && styles.dayDisabled,
                            ]}
                            onPress={() => handlePick(d)}
                            activeOpacity={0.85}
                          >
                            <Text
                              style={[
                                styles.dayText,
                                !cell.inMonth && styles.dayTextOutMonth,
                                selected && styles.dayTextSelected,
                                outOfActiveWeek && styles.dayTextDisabled,
                              ]}
                            >
                              {d.date()}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.clearBtn} onPress={handleClear} activeOpacity={0.9}>
              <Text style={styles.clearText}>Xóa</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.chooseBtn} onPress={handleChoose} activeOpacity={0.9}>
              <Text style={styles.chooseText}>Chọn</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#FFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 12,
    paddingHorizontal: 14,
    maxHeight: "82%",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 6 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  headerClose: { fontSize: 12, fontWeight: "800", color: "#2563EB" },
  summaryRow: { paddingBottom: 10, gap: 2 },
  summaryText: { fontSize: 13, fontWeight: "900", color: "#111827" },
  weekHint: { fontSize: 11, fontWeight: "700", color: "#64748B" },
  scrollContent: { paddingBottom: 12 },
  monthBlock: { paddingVertical: 8 },
  monthHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  monthNavBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: { fontSize: 18, fontWeight: "900", color: "#111827", marginTop: -1 },
  monthTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  dowRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 6 },
  dowText: { width: 40, textAlign: "center", fontSize: 11, fontWeight: "800", color: "#64748B" },
  grid: { gap: 6 },
  weekRow: { flexDirection: "row", justifyContent: "space-between" },
  dayCell: {
    width: 40,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  daySelected: { backgroundColor: "#FEE2E2" },
  dayEdge: { backgroundColor: "#EF4444" },
  dayDisabled: { opacity: 0.35 },
  dayText: { fontSize: 12, fontWeight: "800", color: "#111827" },
  dayTextOutMonth: { color: "#9CA3AF" },
  dayTextSelected: { color: "#111827" },
  dayTextDisabled: { color: "#9CA3AF" },
  error: { marginTop: 6, color: "#B91C1C", fontSize: 12, fontWeight: "700" },
  actionsRow: { flexDirection: "row", gap: 10, paddingTop: 10 },
  clearBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EF4444",
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    alignItems: "center",
  },
  clearText: { color: "#EF4444", fontWeight: "900", fontSize: 14 },
  chooseBtn: { flex: 1, borderRadius: 12, backgroundColor: "#EF4444", paddingVertical: 12, alignItems: "center" },
  chooseText: { color: "#FFFFFF", fontWeight: "900", fontSize: 14 },
});

