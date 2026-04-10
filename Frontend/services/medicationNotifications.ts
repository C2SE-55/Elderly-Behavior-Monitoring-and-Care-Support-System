import { Platform } from "react-native";
import type { TodayScheduleItem } from "./api";
import { appendNotificationLog } from "./notificationLog";

const MEDICATION_CHANNEL_ID = "medication-reminders";
const DEFAULT_MISSED_REMINDER_INTERVAL_MINUTES = 5;
const MISSED_REMINDER_MAX_REPEAT = 1; // nhắc lại 1 lần (sau N phút cấu hình)

let handlerInstalled = false;

const ensureNotificationHandler = async () => {
  if (Platform.OS === "web" || handlerInstalled) return;
  handlerInstalled = true;
  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

const localDateYmd = (): string => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const parseHHMM = (hhmm: string): { hour: number; minute: number } | null => {
  const raw = String(hhmm || "").slice(0, 5);
  const [h, m] = raw.split(":").map((x) => Number(x));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return { hour: h, minute: m };
};

const addMinutes = (base: Date, minutes: number): Date => {
  const d = new Date(base);
  d.setMinutes(d.getMinutes() + minutes);
  return d;
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === "web") return false;

  await ensureNotificationHandler();
  const Notifications = await import("expo-notifications");

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
  const schedule_ids = items.map((i) => Number(i.id)).filter((id) => id > 0);
  return {
    title,
    body: body || "Bạn có lịch uống thuốc.",
    sound: true as const,
    data: {
      type: "medication",
      alarm_time: time,
      schedule_ids,
      date: localDateYmd(),
    },
  };
};

const collectMedicationNames = (items: TodayScheduleItem[]): string[] =>
  Array.from(
    new Set(
      items
        .map((i) => String(i.name || "").trim())
        .filter(Boolean)
    )
  );

export type RescheduleMedicationOptions = {
  /** Khi false (HOST tắt trong room): không lên lịch trigger DAILY, chỉ còn lịch một lần trong ngày */
  allowDaily?: boolean;
  /** Bật/tắt nhắc lại nếu lỡ giờ uống. */
  allowSnooze?: boolean;
  /** Số phút báo lại sau giờ gốc (ví dụ 1,5,10,15). */
  snoozeMinutes?: number;
};

export const rescheduleMedicationNotifications = async (
  schedules: TodayScheduleItem[],
  opts?: RescheduleMedicationOptions
): Promise<void> => {
  if (Platform.OS === "web") return;

  await ensureNotificationHandler();
  const Notifications = await import("expo-notifications");

  await Notifications.cancelAllScheduledNotificationsAsync();

  const allowDaily = opts?.allowDaily !== false;
  const allowSnooze = opts?.allowSnooze !== false;
  const snoozeMinutesRaw = Number(opts?.snoozeMinutes ?? DEFAULT_MISSED_REMINDER_INTERVAL_MINUTES);
  const snoozeMinutes = Number.isFinite(snoozeMinutesRaw)
    ? Math.max(1, Math.min(60, Math.round(snoozeMinutesRaw)))
    : DEFAULT_MISSED_REMINDER_INTERVAL_MINUTES;
  let pendingActive = schedules.filter((s) => s.status === "pending" && s.is_active);
  if (!allowDaily) {
    pendingActive = pendingActive.filter((s) => s.repeat_type !== "daily");
  }
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
      void appendNotificationLog({
        type: "medication",
        title: "Đã lên lịch nhắc thuốc",
        body: content.body,
        data: {
          alarm_time: time,
          count: items.length,
          repeat: "daily",
          schedule_ids: items.map((i) => Number(i.id)).filter((id) => id > 0),
          medication_names: collectMedicationNames(items),
          date: localDateYmd(),
        },
        read: false,
      }).catch(() => {});
      continue;
    }

    const fireDate = new Date(now);
    fireDate.setHours(hm.hour, hm.minute, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    if (fireDate.getTime() > now.getTime()) {
      await Notifications.scheduleNotificationAsync({
        content,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          ...(Platform.OS === "android" ? { channelId: MEDICATION_CHANNEL_ID } : {}),
        },
      });
    }

    // Nhắc lỡ giờ: tạo trước các mốc +5p, +10p... để app đóng vẫn nhận được.
    // Khi user Taken/Skip và app sync lại schedules, toàn bộ lịch cũ sẽ bị cancel/reschedule.
    if (!allowSnooze) continue;
    for (let i = 1; i <= MISSED_REMINDER_MAX_REPEAT; i += 1) {
      const repeatDate = addMinutes(fireDate, i * snoozeMinutes);
      if (repeatDate.getTime() <= now.getTime()) continue;
      if (repeatDate.getTime() > endOfDay.getTime()) break;
      await Notifications.scheduleNotificationAsync({
        content: {
          ...content,
          title: `Nhắc lại uống thuốc (${time})`,
          data: {
            ...(content.data as Record<string, unknown>),
            retry_after_minutes: i * snoozeMinutes,
            retry_index: i,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: repeatDate,
          ...(Platform.OS === "android" ? { channelId: MEDICATION_CHANNEL_ID } : {}),
        },
      });
    }

    void appendNotificationLog({
      type: "medication",
      title: "Đã lên lịch nhắc thuốc",
      body: content.body,
      data: {
        alarm_time: time,
        count: items.length,
        repeat: "once",
        schedule_ids: items.map((i) => Number(i.id)).filter((id) => id > 0),
        medication_names: collectMedicationNames(items),
        date: localDateYmd(),
      },
      read: false,
    }).catch(() => {});
  }
};
