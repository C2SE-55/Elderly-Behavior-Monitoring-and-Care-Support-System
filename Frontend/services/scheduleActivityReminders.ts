import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import dayjs from "dayjs";
import type { DailyScheduleItem, DayOfWeek } from "./api";
import { appendNotificationLog } from "./notificationLog";

const WEEKLY_SCHEDULE_CHANNEL = "weekly-schedule";

const notifiedActivityKeys: Record<string, true> = {};

const normalizeHHMM = (value: string) => String(value || "").slice(0, 5);

const getCurrentDayKey = (now: dayjs.Dayjs): DayOfWeek => {
  const d = now.day();
  if (d === 0) return "sun";
  if (d === 1) return "mon";
  if (d === 2) return "tue";
  if (d === 3) return "wed";
  if (d === 4) return "thu";
  if (d === 5) return "fri";
  return "sat";
};

export type ActivityToastPayload = {
  heading?: string;
  title: string;
  description?: string | null;
};

/** Xoá flag đã báo (khi đổi room / đăng xuất) để lịch mới vẫn thông báo được */
export const resetScheduleActivityReminderKeys = () => {
  Object.keys(notifiedActivityKeys).forEach((k) => {
    delete notifiedActivityKeys[k];
  });
};

export const ensureWeeklyScheduleNotificationChannel = async (): Promise<void> => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(WEEKLY_SCHEDULE_CHANNEL, {
    name: "Lịch sinh hoạt",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    sound: "default",
  });
};

/**
 * Kiểm tra mỗi phút: nếu có mục lịch trùng ngày + giờ bắt đầu → toast + banner hệ thống (khi mở app).
 */
export const checkScheduleActivityStarts = (
  refNow: dayjs.Dayjs,
  schedules: DailyScheduleItem[],
  canReceive: boolean,
  showToast: (p: ActivityToastPayload) => void
): void => {
  if (!canReceive || !schedules.length) return;

  const currentDayKey = getCurrentDayKey(refNow);
  const hhmm = refNow.format("HH:mm");
  const dateKey = refNow.format("YYYY-MM-DD");

  for (const item of schedules) {
    if (item.day_of_week !== currentDayKey) continue;
    if (normalizeHHMM(item.start_time) !== hhmm) continue;
    const key = `${dateKey}-${item.id}`;
    if (notifiedActivityKeys[key]) continue;
    notifiedActivityKeys[key] = true;
    const heading = item.type === "meal" ? "Đã tới giờ ăn!" : "Đến giờ sinh hoạt";
    showToast({
      heading,
      title: item.title,
      description: item.description,
    });

    if (Platform.OS !== "web") {
      void Notifications.scheduleNotificationAsync({
        content: {
          title: heading,
          body: item.description ? `${item.title} — ${item.description}` : item.title,
          sound: true,
          ...(Platform.OS === "android" ? { channelId: WEEKLY_SCHEDULE_CHANNEL } : {}),
          data: { type: "weekly-schedule", schedule_id: item.id },
        },
        trigger: null,
      })
        .then(() =>
          appendNotificationLog({
            type: "weekly-schedule",
            title: heading,
            body: item.description ? `${item.title} — ${item.description}` : item.title,
            data: { schedule_id: item.id },
            read: false,
          }).catch(() => {})
        )
        .catch(() => {});
    }
  }
};
