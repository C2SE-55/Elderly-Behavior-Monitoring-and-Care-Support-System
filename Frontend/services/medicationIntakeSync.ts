import { Platform } from "react-native";
import { getMyRoom, getTodaySchedules } from "@/services/api";
import { ensureNotificationPermission, rescheduleMedicationNotifications } from "@/services/medicationNotifications";
import { dismissMedicationReminderLogsForMedicationSlot } from "@/services/notificationLog";

const pad2 = (n: number) => String(n).padStart(2, "0");

const localDateYmd = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const roomAllowsDaily = (room: { medication_daily_reminders_enabled?: boolean | number } | null): boolean => {
  if (!room) return true;
  const v = room.medication_daily_reminders_enabled;
  if (v === undefined || v === null) return true;
  if (typeof v === "boolean") return v;
  return Number(v) !== 0;
};

/**
 * Đồng bộ khi máy khác Taken/Skip: gỡ log nhắc + làm mới lịch OS (nếu user bật nhận nhắc thuốc).
 */
export async function handleRemoteMedicationIntake(payload: unknown): Promise<void> {
  const p = payload as Record<string, unknown>;
  const room = await getMyRoom().catch(() => null);
  if (!room?.id) return;
  if (Number(p?.roomId || 0) !== Number(room.id)) return;

  const rawIds = Array.isArray(p?.schedule_ids) ? p.schedule_ids : [];
  const ids = rawIds.map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
  if (!ids.length && p?.schedule_id) {
    const one = Number(p.schedule_id);
    if (Number.isFinite(one) && one > 0) ids.push(one);
  }
  const dateStr = String(p?.date || "").slice(0, 10) || localDateYmd();
  const al = String(p?.alarm_time || "").slice(0, 5);
  await dismissMedicationReminderLogsForMedicationSlot(dateStr, ids, al || undefined);

  const wantsNotifications =
    room.member_role === "host" || !!room.can_receive_medication_notifications;
  if (!wantsNotifications) return;

  const ok = await ensureNotificationPermission().catch(() => false);
  if (!ok) return;

  const schedules = await getTodaySchedules().catch(() => []);
  await rescheduleMedicationNotifications(schedules, { allowDaily: roomAllowsDaily(room) });
}

/**
 * Lên lịch nhắc thuốc trên thiết bị (host + caregiver được phép nhận).
 * Gọi từ root layout để máy caregiver vẫn có OS notification dù không mở tab Nhắc uống thuốc.
 */
export async function syncMedicationOsNotificationsFromServer(): Promise<void> {
  if (Platform.OS === "web") return;
  const room = await getMyRoom().catch(() => null);
  if (!room?.id) return;

  const wantsNotifications =
    room.member_role === "host" || !!room.can_receive_medication_notifications;
  if (!wantsNotifications) return;

  const ok = await ensureNotificationPermission().catch(() => false);
  if (!ok) return;

  const schedules = await getTodaySchedules().catch(() => []);
  await rescheduleMedicationNotifications(schedules, {
    allowDaily: roomAllowsDaily(room),
    allowSnooze: true,
    snoozeMinutes: 5,
  });
}
