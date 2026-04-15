import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import dayjs from "dayjs";
import {
  getMedicationIntakeStats,
  getMedicationIntakeStatsRange,
  getMyRoom,
  MedicationIntakeStatItem,
  MedicationIntakeStatsResponse,
  MyRoomInfo,
} from "@/services/api";
import WeekRangeCalendarModal from "@/components/schedule/WeekRangeCalendarModal";

type Period = "day" | "week" | "month" | "range";

const pad2 = (n: number) => String(n).padStart(2, "0");

const localTodayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const shiftAnchor = (ymd: string, period: Period, delta: number): string => {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  if (!y || !m || !d) return localTodayYmd();
  if (period === "day") {
    const dt = new Date(y, m - 1, d + delta);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  if (period === "week") {
    const dt = new Date(y, m - 1, d + delta * 7);
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  const dt = new Date(y, m - 1 + delta, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  const day = Math.min(d, last);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(day)}`;
};

export default function StatsScreen() {
  const [room, setRoom] = useState<MyRoomInfo | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(localTodayYmd);
  const [rangeVisible, setRangeVisible] = useState(false);
  const [rangeStart, setRangeStart] = useState(localTodayYmd);
  const [rangeEnd, setRangeEnd] = useState(localTodayYmd);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [statsData, setStatsData] = useState<MedicationIntakeStatsResponse | null>(null);

  const isHost = room?.member_role === "host";

  const loadRoom = useCallback(async () => {
    setRoomLoading(true);
    try {
      const r = await getMyRoom();
      setRoom(r);
    } catch {
      setRoom(null);
    } finally {
      setRoomLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  const loadStats = useCallback(async () => {
    if (!room?.id || !isHost) {
      setStatsData(null);
      return;
    }
    setStatsLoading(true);
    setStatsError("");
    try {
      const data =
        period === "range"
          ? await getMedicationIntakeStatsRange(room.id, { from: rangeStart, to: rangeEnd })
          : await getMedicationIntakeStats(room.id, { period: period as any, anchor });
      setStatsData(data);
    } catch (e: any) {
      const msg = e?.response?.data?.message || "Không tải được thống kê.";
      setStatsError(msg);
      setStatsData(null);
    } finally {
      setStatsLoading(false);
    }
  }, [room?.id, isHost, period, anchor, rangeEnd, rangeStart]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const rangeLabel = useMemo(() => {
    if (!statsData?.range?.start) return "";
    const { start, end } = statsData.range;
    if (start === end) return dayjs(start).format("DD/MM/YYYY");
    return `${dayjs(start).format("DD/MM/YYYY")} — ${dayjs(end).format("DD/MM/YYYY")}`;
  }, [statsData]);

  const summary = useMemo(() => {
    const items = statsData?.items ?? [];
    const total = items.length;
    const taken = items.filter((i) => i.status === "taken").length;
    const skipped = items.filter((i) => i.status !== "taken").length;
    const adherence = total > 0 ? Math.round((taken / total) * 100) : 0;
    return { total, taken, skipped, adherence };
  }, [statsData]);

  const renderRow = ({ item }: { item: MedicationIntakeStatItem }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemTop}>
        <Text style={styles.itemTime}>{dayjs(item.taken_time).format("DD/MM • HH:mm")}</Text>
        <View style={[styles.statusPill, item.status === "taken" ? styles.statusTaken : styles.statusSkipped]}>
          <Text style={[styles.statusPillText, item.status === "taken" ? styles.statusTakenText : styles.statusSkippedText]}>
            {item.status === "taken" ? "Đã uống" : "Bỏ qua"}
          </Text>
        </View>
      </View>

      <Text style={styles.medName} numberOfLines={2}>
        {item.medication_name}
      </Text>
      <Text style={styles.itemMeta}>Giờ nhắc: {item.alarm_time}</Text>
      <Text style={styles.itemActor} numberOfLines={1}>
        Xác nhận: {item.acted_by_name || (item.acted_by_user_id ? `#${item.acted_by_user_id}` : "—")}
      </Text>
    </View>
  );

  if (roomLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator color="#56328C" />
          <Text style={styles.muted}>Đang tải...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Thống kê</Text>
          <Text style={styles.muted}>Bạn chưa tham gia room nào.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isHost) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.center}>
          <Text style={styles.title}>Thống kê</Text>
          <Text style={styles.forbidden}>Chỉ người thân (host) xem được thống kê uống thuốc trong room.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={statsData?.items ?? []}
        keyExtractor={(it) => String(it.log_id)}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>Thống kê uống thuốc</Text>
            <Text style={styles.sub}>Room: {room.room_id}</Text>

            <View style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <Text style={styles.heroTitle}>Tuân thủ dùng thuốc</Text>
                <Text style={styles.heroPercent}>{summary.adherence}%</Text>
              </View>
              <Text style={styles.heroDesc}>
                Theo dõi theo ngày/tuần/tháng để biết mức độ duy trì thói quen uống thuốc đúng giờ.
              </Text>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.min(100, Math.max(0, summary.adherence))}%` }]} />
              </View>
            </View>

            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Tổng lần ghi nhận</Text>
                <Text style={styles.summaryValue}>{summary.total}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Đã uống</Text>
                <Text style={[styles.summaryValue, { color: "#059669" }]}>{summary.taken}</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Bỏ qua</Text>
                <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{summary.skipped}</Text>
              </View>
            </View>

            <View style={styles.periodRow}>
              {(["day", "week", "month"] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.periodChip, period === p && styles.periodChipOn]}
                  onPress={() => setPeriod(p)}
                >
                  <Text style={[styles.periodChipText, period === p && styles.periodChipTextOn]}>
                    {p === "day" ? "Ngày" : p === "week" ? "Tuần" : "Tháng"}
                  </Text>
                </TouchableOpacity>
              ))}
              <View style={{ flex: 1 }} />
              <TouchableOpacity style={styles.todayBtn} onPress={() => setAnchor(localTodayYmd())}>
                <Text style={styles.todayBtnText}>Hôm nay</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.navRow}>
              {period === "range" ? (
                <TouchableOpacity
                  style={styles.anchorTap}
                  activeOpacity={0.8}
                  onPress={() => setRangeVisible(true)}
                >
                  <Text style={styles.anchorText} numberOfLines={1} ellipsizeMode="tail">
                    {dayjs(rangeStart).format("DD/MM/YYYY")} — {dayjs(rangeEnd).format("DD/MM/YYYY")}
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.navBtn} onPress={() => setAnchor((a) => shiftAnchor(a, period as any, -1))}>
                    <Text style={styles.navBtnText}>◀</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.anchorTap}
                    activeOpacity={0.8}
                    onPress={() => {
                      const s = statsData?.range?.start ? String(statsData.range.start).slice(0, 10) : anchor;
                      const e = statsData?.range?.end ? String(statsData.range.end).slice(0, 10) : anchor;
                      setRangeStart(s);
                      setRangeEnd(e);
                      setRangeVisible(true);
                    }}
                  >
                    <Text style={styles.anchorText} numberOfLines={1} ellipsizeMode="tail">
                      {rangeLabel || anchor}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.navBtn} onPress={() => setAnchor((a) => shiftAnchor(a, period as any, 1))}>
                    <Text style={styles.navBtnText}>▶</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {!!statsError && <Text style={styles.error}>{statsError}</Text>}
            <Text style={styles.sectionLabel}>Nhật ký uống thuốc</Text>
          </>
        }
        ListEmptyComponent={
          statsLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#56328C" />
            </View>
          ) : (
            <Text style={styles.empty}>Không có bản ghi uống thuốc trong khoảng thời gian này.</Text>
          )
        }
        renderItem={renderRow}
        contentContainerStyle={styles.listContent}
      />

      <WeekRangeCalendarModal
        visible={rangeVisible}
        weekStart={dayjs(rangeStart)}
        weekEnd={dayjs(rangeEnd)}
        valueStart={dayjs(rangeStart)}
        valueEnd={dayjs(rangeEnd)}
        restrictToSameWeek={false}
        showWeekHint={false}
        onClose={() => setRangeVisible(false)}
        onApply={(s, e) => {
          const from = s.format("YYYY-MM-DD");
          const to = e.format("YYYY-MM-DD");
          setRangeStart(from);
          setRangeEnd(to);
          setPeriod("range");
          setRangeVisible(false);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F7FB", paddingHorizontal: 16, paddingTop: 8 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 20, fontWeight: "800", color: "#0F172A" },
  sub: { marginTop: 4, fontSize: 13, color: "#64748B" },
  muted: { marginTop: 8, color: "#64748B", textAlign: "center" },
  forbidden: { marginTop: 12, color: "#B45309", textAlign: "center", lineHeight: 22 },
  heroCard: {
    marginTop: 14,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E7FF",
    padding: 14,
  },
  heroHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  heroTitle: { fontSize: 14, fontWeight: "800", color: "#1F2937" },
  heroPercent: { fontSize: 24, fontWeight: "900", color: "#56328C" },
  heroDesc: { marginTop: 6, fontSize: 12, color: "#6B7280", lineHeight: 18, fontWeight: "600" },
  progressTrack: {
    marginTop: 10,
    height: 9,
    borderRadius: 999,
    backgroundColor: "#EDE9FE",
    overflow: "hidden",
  },
  progressFill: {
    height: 9,
    backgroundColor: "#56328C",
    borderRadius: 999,
  },
  summaryGrid: { flexDirection: "row", gap: 10, marginTop: 10 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEF2FF",
    borderRadius: 14,
    padding: 10,
  },
  summaryLabel: { fontSize: 11, color: "#64748B", fontWeight: "700" },
  summaryValue: { marginTop: 4, fontSize: 18, color: "#0F172A", fontWeight: "900" },
  periodRow: { flexDirection: "row", gap: 8, marginTop: 16 },
  periodChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
  },
  periodChipOn: { backgroundColor: "#56328C" },
  periodChipText: { fontWeight: "700", color: "#475569", fontSize: 13 },
  periodChipTextOn: { color: "#FFFFFF" },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    gap: 8,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  navBtnText: { fontSize: 16, color: "#56328C", fontWeight: "800" },
  todayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  todayBtnText: { fontWeight: "700", color: "#334155", fontSize: 13 },
  anchorTap: { flex: 1, alignItems: "center", justifyContent: "center" },
  anchorText: { maxWidth: "100%", textAlign: "center", fontWeight: "600", color: "#334155", fontSize: 13 },
  error: { color: "#DC2626", marginTop: 8, fontSize: 13 },
  sectionLabel: { marginTop: 12, marginBottom: 6, fontSize: 13, fontWeight: "800", color: "#374151" },
  loadingBox: { paddingVertical: 32, alignItems: "center" },
  listContent: { paddingBottom: 32, paddingTop: 8 },
  itemCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    padding: 12,
    marginBottom: 10,
  },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  itemTime: { fontSize: 12, color: "#6B7280", fontWeight: "700" },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  statusTaken: { backgroundColor: "rgba(16,185,129,0.12)", borderColor: "rgba(16,185,129,0.30)" },
  statusSkipped: { backgroundColor: "rgba(239,68,68,0.12)", borderColor: "rgba(239,68,68,0.30)" },
  statusPillText: { fontSize: 11, fontWeight: "800" },
  statusTakenText: { color: "#047857" },
  statusSkippedText: { color: "#B91C1C" },
  medName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  itemMeta: { fontSize: 12, color: "#64748B", marginTop: 3, fontWeight: "600" },
  itemActor: { fontSize: 12, color: "#56328C", marginTop: 6, fontWeight: "700" },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 24, fontSize: 14 },
});
