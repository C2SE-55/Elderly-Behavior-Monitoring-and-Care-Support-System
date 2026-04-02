import AsyncStorage from "@react-native-async-storage/async-storage";

export type NotificationLogType = "weekly-schedule" | "medication" | "system" | "care-confirmation";

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
};

export async function getNotificationLogs(): Promise<NotificationLogEntry[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return safeParse(raw);
}

export async function clearNotificationLogs(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
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

