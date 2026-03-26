import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import type { TodayScheduleItem } from "./api";

const MEDICATION_CHANNEL_ID = "medication-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const parseHHMM = (hhmm: string): { hour: number; minute: number } | null => {
  const raw = String(hhmm || "").slice(0, 5);
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(MEDICATION_CHANNEL_ID, {
      name: "Medication Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#2563EB",
    });
  }

  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return !!req.granted;
};

const buildContent = (time: string, items: TodayScheduleItem[]) => {
  const names = items.map((i) => i.name).filter(Boolean);
  const title = `Đến giờ uống thuốc (${time})`;
  const body =
    names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")}… (+${names.length - 3})`;
  return {
    title,
    body: body || "Bạn có lịch uống thuốc.",
    sound: true as const,
    data: { type: "medication", alarm_time: time },
  };
};

/**
 * Schedule local notifications based on today's schedules.
 * Strategy:
 * - Group by alarm_time
 * - If repeat_type is daily => repeats every day at HH:mm
 * - If repeat_type is once => schedule next occurrence today (if in future), otherwise skip
 *
 * To avoid duplicates, this cancels previously scheduled notifications for this app session.
 */
export const rescheduleMedicationNotifications = async (schedules: TodayScheduleItem[]): Promise<void> => {
  if (Platform.OS === "web") return;

  // Cancel all scheduled notifications to prevent duplicates.
  // If later you add other notification types, replace this with targeted cancellation.
  await Notifications.cancelAllScheduledNotificationsAsync();

  const pendingActive = schedules.filter((s) => s.status === "pending" && s.is_active);
  const groups: Record<string, TodayScheduleItem[]> = {};
  for (const item of pendingActive) {
    const key = String(item.alarm_time || "").slice(0, 5);
    if (!key) continue;
    groups[key] = groups[key] || [];
    groups[key].push(item);
  }

  const now = new Date();
  for (const [time, items] of Object.entries(groups)) {
    const hm = parseHHMM(time);
    if (!hm) continue;
    const content = buildContent(time, items);

    const anyDaily = items.some((i) => i.repeat_type === "daily");
    if (anyDaily) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hm.hour,
          minute: hm.minute,
          ...(Platform.OS === "android" ? { channelId: MEDICATION_CHANNEL_ID } : {}),
        },
      });
      continue;
    }

    // once: schedule only if the time is still ahead today
    const fireDate = new Date(now);
    fireDate.setHours(hm.hour, hm.minute, 0, 0);
    if (fireDate.getTime() <= now.getTime()) continue;

    await Notifications.scheduleNotificationAsync({
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        ...(Platform.OS === "android" ? { channelId: MEDICATION_CHANNEL_ID } : {}),
      },
    });
  }
};

