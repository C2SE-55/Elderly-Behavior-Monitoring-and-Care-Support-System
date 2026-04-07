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

  const renderRow = ({ item }: { item: MedicationIntakeStatItem }) => (
    <View style={styles.row}>
      <Text style={styles.cellTime}>{dayjs(item.taken_time).format("DD/MM HH:mm")}</Text>
      <View style={styles.cellMain}>
        <Text style={styles.medName} numberOfLines={2}>
          {item.medication_name}
        </Text>
        <Text style={styles.cellMeta}>
          {item.alarm_time} · {item.status === "taken" ? "Đã uống" : "Bỏ qua"}
        </Text>
      </View>
      <Text style={styles.cellActor} numberOfLines={2}>
        {item.acted_by_name || (item.acted_by_user_id ? `#${item.acted_by_user_id}` : "—")}
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
      <Text style={styles.title}>Thống kê uống thuốc</Text>
      <Text style={styles.sub}>Room: {room.room_id}</Text>

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

      {statsLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#56328C" />
        </View>
      ) : (
        <FlatList
          data={statsData?.items ?? []}
          keyExtractor={(it) => String(it.log_id)}
          ListHeaderComponent={
            <View style={styles.tableHead}>
              <Text style={[styles.headText, { width: 88 }]}>Thời gian</Text>
              <Text style={[styles.headText, { flex: 1 }]}>Thuốc / lịch</Text>
              <Text style={[styles.headText, { width: 100 }]}>Người xác nhận</Text>
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>Không có bản ghi Taken/Skip trong khoảng này.</Text>}
          renderItem={renderRow}
          contentContainerStyle={styles.listContent}
        />
      )}

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
  loadingBox: { paddingVertical: 32, alignItems: "center" },
  listContent: { paddingBottom: 32, paddingTop: 8 },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headText: { fontWeight: "800", fontSize: 11, color: "#64748B" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 8,
  },
  cellTime: { width: 88, fontSize: 12, color: "#475569", fontWeight: "600" },
  cellMain: { flex: 1 },
  medName: { fontSize: 14, fontWeight: "700", color: "#0F172A" },
  cellMeta: { fontSize: 11, color: "#64748B", marginTop: 2 },
  cellActor: { width: 100, fontSize: 12, color: "#56328C", fontWeight: "600" },
  empty: { textAlign: "center", color: "#94A3B8", marginTop: 24, fontSize: 14 },
});
