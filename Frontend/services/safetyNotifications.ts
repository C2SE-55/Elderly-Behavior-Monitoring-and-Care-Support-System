import AsyncStorage from "@react-native-async-storage/async-storage";
import { getCameraEventHistory, getMyRoom, type CameraHistoryEvent } from "@/services/api";
import { appendNotificationLog } from "@/services/notificationLog";

const LAST_SEEN_KEY = "ebms.safety.lastSeen.v2";

type LastSeen = {
  fall: number;
  left_safe_zone: number;
};

const toInt = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const readLastSeen = async (): Promise<LastSeen> => {
  try {
    const raw = await AsyncStorage.getItem(LAST_SEEN_KEY);
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

const writeLastSeen = async (next: LastSeen) => {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
};

const isSafetyEvent = (ev: CameraHistoryEvent) =>
  ev.source_type === "left_safe_zone_event" || ev.source_type === "fall_event" || !ev.source_type;

const titleFor = (ev: CameraHistoryEvent) =>
  ev.source_type === "left_safe_zone_event" ? "Rời khỏi vùng an toàn" : "Cảnh báo té ngã";

export async function pollSafetyEventsOnce(): Promise<void> {
  const room = await getMyRoom().catch(() => null);
  if (!room) return;
  if (room.member_role !== "host") return; // host-only

  const lastSeen = await readLastSeen();
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
    const title = titleFor(ev);
    const body =
      ev.source_type === "left_safe_zone_event"
        ? "Người cần chăm sóc đã rời khỏi vùng an toàn."
        : "Phát hiện té ngã. Vui lòng kiểm tra ngay.";

    await appendNotificationLog({
      type: "system",
      title,
      body,
      data: {
        type: "safety",
        safety_type: ev.source_type === "left_safe_zone_event" ? "left_safe_zone" : "fall",
        event_id: ev.id,
        camera_id: ev.camera_id ?? null,
        image_url: ev.image_url ?? null,
        image_full_url: ev.image_full_url ?? null,
        created_at: ev.created_at ?? null,
        room_id: room.room_id,
      },
      read: false,
    });

    nextLastSeen[k] = Math.max(nextLastSeen[k] || 0, ev.id);
  }
  await writeLastSeen(nextLastSeen);
}

