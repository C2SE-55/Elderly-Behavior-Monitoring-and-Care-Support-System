import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { getCameraEventHistory, getMyRoom, type CameraHistoryEvent } from "@/services/api";
import { appendNotificationLog } from "@/services/notificationLog";

const lastSeenKeyFor = (roomId?: string | null, role?: string | null) =>
  `ebms.safety.lastSeen.v3.${String(roomId || "no-room")}.${String(role || "no-role")}`;

type LastSeen = {
  fall: number;
  left_safe_zone: number;
};

const toInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const readLastSeen = async (key: string): Promise<LastSeen> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return { fall: 0, left_safe_zone: 0 };
    const v = JSON.parse(raw);
    return {
      fall: toInt(v?.fall),
      left_safe_zone: toInt(v?.left_safe_zone),
    };
  } catch {
    // Backward-compat: if v1 stored a number, treat as both (best effort)
    return { fall: 0, left_safe_zone: 0 };
  }
};

const writeLastSeen = async (key: string, next: LastSeen) => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore
  }
};

const isSafetyEvent = (ev: CameraHistoryEvent) =>
  ev.source_type === "left_safe_zone_event" || ev.source_type === "fall_event" || !ev.source_type;

const titleFor = (ev: CameraHistoryEvent) =>
  ev.source_type === "left_safe_zone_event" ? "Rời khỏi vùng an toàn" : "Cảnh báo té ngã";

let _Notifications: typeof import("expo-notifications") | null = null;
const getNotifications = async () => {
  if (_Notifications) return _Notifications;
  _Notifications = await import("expo-notifications");
  return _Notifications;
};

const notifyDevice = async (title: string, body: string, data: Record<string, any>) => {
  if (Platform.OS === "web") return;
  try {
    const Notifications = await getNotifications();
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        data,
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
};

export async function pollSafetyEventsOnce(): Promise<void> {
  const room = await getMyRoom().catch(() => null);
  if (!room) return;
  // Safety alerts should be visible to both host and caretaker.
  if (room.member_role !== "host" && room.member_role !== "caretaker") return;

  const key = lastSeenKeyFor(room.room_id, room.member_role);
  const lastSeen = await readLastSeen(key);
  const items = await getCameraEventHistory(30).catch(() => []);
  const safety = items.filter(isSafetyEvent);
  if (!safety.length) return;

  const typeKeyOf = (ev: CameraHistoryEvent): keyof LastSeen =>
    ev.source_type === "left_safe_zone_event" ? "left_safe_zone" : "fall";

  // process oldest -> newest by created_at (fallback id)
  const nextOnes = safety
    .filter((x) => x.id > (lastSeen[typeKeyOf(x)] || 0))
    .sort((a, b) => {
      const ta = a.created_at ? Date.parse(a.created_at) : 0;
      const tb = b.created_at ? Date.parse(b.created_at) : 0;
      if (ta && tb && ta !== tb) return ta - tb;
      return a.id - b.id;
    });

  if (!nextOnes.length) return;

  const nextLastSeen: LastSeen = { ...lastSeen };
  for (const ev of nextOnes) {
    const k = typeKeyOf(ev);
    // Prefer deterministic titles for safety event types.
    const isLeft = ev.source_type === "left_safe_zone_event";
    const isFall = ev.source_type === "fall_event" || !ev.source_type;
    const fallbackTitle = isLeft ? "Rời khỏi vùng an toàn" : isFall ? "Cảnh báo té ngã" : titleFor(ev);
    const title = fallbackTitle;
    const body =
      isLeft
        ? "Người cần chăm sóc đã rời khỏi vùng an toàn."
        : isFall
          ? "Phát hiện té ngã. Vui lòng kiểm tra ngay."
          : "Có cảnh báo an toàn. Vui lòng kiểm tra ngay.";

    const data = {
      type: "safety",
      safety_type: isLeft ? "left_safe_zone" : "fall",
      event_id: ev.id,
      camera_id: ev.camera_id ?? null,
      image_url: ev.image_url ?? null,
      image_full_url: ev.image_full_url ?? null,
      created_at: ev.created_at ?? null,
      room_id: room.room_id,
    };

    await appendNotificationLog({
      type: "system",
      title,
      body,
      data,
      read: false,
    });

    await notifyDevice(title, body, data);
    nextLastSeen[k] = Math.max(nextLastSeen[k] || 0, ev.id);
  }
  await writeLastSeen(key, nextLastSeen);
}

