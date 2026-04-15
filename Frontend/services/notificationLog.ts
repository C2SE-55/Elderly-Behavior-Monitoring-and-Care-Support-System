import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationLogType =
  | "weekly-schedule"
  | "medication"
  | "system"
  | "care-confirmation"
  | "room-message"
  | "support-message";

export type NotificationLogEntry = {
  id: string;
  type: NotificationLogType;
  title: string;
  body?: string;
  createdAt: string; // ISO
  data?: Record<string, any>;
  read: boolean;
};

const STORAGE_KEY = "ebms.notificationLogs.v1";
const MAX_LOGS = 200;

type ChangeListener = () => void;
const listeners = new Set<ChangeListener>();
const emitChange = () => {
  for (const cb of Array.from(listeners)) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
};

export function subscribeNotificationLogChange(cb: ChangeListener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const safeParse = (raw: string | null): NotificationLogEntry[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(Boolean)
      .map((it) => ({
        ...(it as any),
        read: typeof (it as any)?.read === "boolean" ? (it as any).read : false,
      })) as NotificationLogEntry[];
  } catch {
    return [];
  }
};

const writeLogs = async (rows: NotificationLogEntry[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX_LOGS)));
  emitChange();
};

export async function getNotificationLogs(): Promise<NotificationLogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

export async function clearNotificationLogs(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  emitChange();
}

export async function appendNotificationLog(entry: Omit<NotificationLogEntry, "id" | "createdAt">): Promise<void> {
  const current = await getNotificationLogs();
  const now = Date.now();

  // De-duplicate: avoid writing the same log repeatedly when callers reschedule/retry.
  // Example: medication reschedule can be called multiple times on screen reload.
  const sig = `${entry.type}::${entry.title}::${entry.body || ""}::${JSON.stringify(entry.data || {})}`;
  const DEDUPE_WINDOW_MS = 30_000;
  for (const it of current.slice(0, 5)) {
    const itSig = `${it.type}::${it.title}::${it.body || ""}::${JSON.stringify(it.data || {})}`;
    const itAt = dayjsSafe(it.createdAt);
    if (itSig === sig && typeof itAt === "number" && Math.abs(now - itAt) < DEDUPE_WINDOW_MS) {
      return;
    }
  }

  const next: NotificationLogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  const merged = [next, ...current].slice(0, MAX_LOGS);
  await writeLogs(merged);
}

const dayjsSafe = (iso: string): number | null => {
  const t = Date.parse(String(iso || ""));
  return Number.isFinite(t) ? t : null;
};

export async function markAllNotificationLogsRead(): Promise<void> {
  const current = await getNotificationLogs();
  if (!current.length) return;
  const updated = current.map((it) => (it.read ? it : { ...it, read: true }));
  await writeLogs(updated);
}

export async function markNotificationLogRead(id: string): Promise<void> {
  if (!id) return;
  const current = await getNotificationLogs();
  const idx = current.findIndex((x) => x.id === id);
  if (idx < 0) return;
  if (current[idx]?.read) return;
  const updated = [...current];
  updated[idx] = { ...updated[idx], read: true };
  await writeLogs(updated);
}

/** Đánh dấu đã đọc cho cả nhóm dedupe (cùng type + cùng phút + cùng title/body). */
export async function markNotificationLogsReadByGroupSignature(sig: {
  type: NotificationLogEntry["type"];
  createdAt: string;
  title: string;
  body?: string;
}): Promise<void> {
  const t = Date.parse(String(sig?.createdAt || ""));
  if (!Number.isFinite(t)) return;
  const minuteBucket = Math.floor(t / 60000);
  const type = sig.type;
  const title = String(sig.title || "");
  const body = String(sig.body || "");

  const current = await getNotificationLogs();
  let changed = false;
  const updated = current.map((it) => {
    if (it.read) return it;
    const itT = Date.parse(String(it.createdAt || ""));
    if (!Number.isFinite(itT)) return it;
    const itBucket = Math.floor(itT / 60000);
    if (itBucket !== minuteBucket) return it;
    if (it.type !== type) return it;
    if (String(it.title || "") !== title) return it;
    if (String(it.body || "") !== body) return it;
    changed = true;
    return { ...it, read: true };
  });
  if (changed) await writeLogs(updated);
}

export async function updateNotificationLog(
  id: string,
  patch: Partial<Omit<NotificationLogEntry, "id" | "createdAt">> & { data?: Record<string, any> }
): Promise<void> {
  if (!id) return;
  const current = await getNotificationLogs();
  const idx = current.findIndex((x) => x.id === id);
  if (idx < 0) return;
  const existing = current[idx]!;
  const next: NotificationLogEntry = {
    ...existing,
    ...patch,
    data: patch.data !== undefined ? patch.data : existing.data,
    id: existing.id,
    createdAt: existing.createdAt,
  };
  const updated = [...current];
  updated[idx] = next;
  await writeLogs(updated);
}

export async function deleteNotificationLog(id: string): Promise<void> {
  if (!id) return;
  const current = await getNotificationLogs();
  const updated = current.filter((x) => x.id !== id);
  if (updated.length === current.length) return;
  await writeLogs(updated);
}

/** Đánh đã đọc các log nhắc thuốc liên quan tới một lịch + ngày (đồng bộ khi ai đó Taken/Skip). */
export async function dismissMedicationReminderLogsForIntake(
  scheduleId: number,
  dateYmd: string
): Promise<void> {
  if (!scheduleId || !dateYmd) return;
  const day = String(dateYmd).slice(0, 10);
  const current = await getNotificationLogs();
  let changed = false;
  const updated = current.map((it) => {
    if (it.type !== "medication" || it.read) return it;
    const d = it.data || {};
    const ids = Array.isArray(d.schedule_ids) ? d.schedule_ids.map((x: unknown) => Number(x)) : [];
    const single = Number(d.schedule_id || 0);
    const matchesSchedule =
      (single > 0 && single === scheduleId) || ids.includes(scheduleId);
    if (!matchesSchedule) return it;
    const logDate = d.date != null ? String(d.date).slice(0, 10) : "";
    if (logDate && logDate !== day) return it;
    changed = true;
    return { ...it, read: true };
  });
  if (changed) await writeLogs(updated);
}

/** Gộp theo khung giờ: đánh đã đọc log có cùng alarm_time / schedule_ids (sau mark-slot). */
export async function dismissMedicationReminderLogsForMedicationSlot(
  dateYmd: string,
  scheduleIds: number[],
  alarmTime?: string
): Promise<void> {
  const day = String(dateYmd).slice(0, 10);
  const idSet = new Set(scheduleIds.filter((x) => Number(x) > 0));
  const t = alarmTime ? String(alarmTime).slice(0, 5) : "";
  const current = await getNotificationLogs();
  let changed = false;
  const updated = current.map((it) => {
    if (it.type !== "medication" || it.read) return it;
    const d = it.data || {};
    const logDate = d.date != null ? String(d.date).slice(0, 10) : "";
    if (logDate && logDate !== day) return it;
    const ids = Array.isArray(d.schedule_ids) ? d.schedule_ids.map((x: unknown) => Number(x)) : [];
    const logAlarm = String(d.alarm_time || "").slice(0, 5);
    const hit =
      (idSet.size > 0 && ids.some((x) => idSet.has(x))) || (Boolean(t) && logAlarm === t);
    if (!hit) return it;
    changed = true;
    return { ...it, read: true };
  });
  if (changed) await writeLogs(updated);
}

