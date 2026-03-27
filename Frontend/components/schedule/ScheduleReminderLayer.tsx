import React, { useCallback, useEffect, useState } from "react";
import { Platform, View } from "react-native";
import dayjs from "dayjs";
import * as Notifications from "expo-notifications";
import {
  getDailySchedules,
  getMyRoom,
  getServerTime,
  subscribeActiveRoomChange,
  type DailyScheduleItem,
} from "@/services/api";
import {
  checkScheduleActivityStarts,
  ensureWeeklyScheduleNotificationChannel,
  resetScheduleActivityReminderKeys,
} from "@/services/scheduleActivityReminders";
import { useMealToast } from "./NotificationService";

/**
 * Luôn gắn vào (tabs): nhắc lịch sinh hoạt khi tới giờ — kể cả đang ở homepage.
 */
export default function ScheduleReminderLayer() {
  const { showMealToast, toast } = useMealToast();
  const [canReceive, setCanReceive] = useState(false);
  const [schedules, setSchedules] = useState<DailyScheduleItem[]>([]);
  const [now, setNow] = useState(() => dayjs());

  const sync = useCallback(async () => {
    try {
      const room = await getMyRoom();
      if (!room) {
        setCanReceive(false);
        setSchedules([]);
        return;
      }
      const isHost = room.member_role === "host";
      const canNotify = isHost || !!room.can_receive_schedule_notifications;
      setCanReceive(canNotify);
      if (!canNotify) {
        setSchedules([]);
        return;
      }
      try {
        const rows = await getDailySchedules();
        setSchedules(rows);
      } catch {
        setSchedules([]);
      }
      try {
        const serverIso = await getServerTime();
        setNow(dayjs(serverIso));
      } catch {
        setNow(dayjs());
      }
    } catch {
      setCanReceive(false);
      setSchedules([]);
    }
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  useEffect(() => {
    const unsub = subscribeActiveRoomChange(() => {
      resetScheduleActivityReminderKeys();
      void sync();
    });
    return unsub;
  }, [sync]);

  useEffect(() => {
    const t = setInterval(() => {
      void sync();
    }, 60_000);
    return () => clearInterval(t);
  }, [sync]);

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 15_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    const setup = async () => {
      try {
        const perms = await Notifications.getPermissionsAsync();
        if (perms.status !== "granted") {
          await Notifications.requestPermissionsAsync();
        }
        await ensureWeeklyScheduleNotificationChannel();
      } catch {
        // ignore
      }
    };
    void setup();
  }, []);

  useEffect(() => {
    checkScheduleActivityStarts(now, schedules, canReceive, showMealToast);
  }, [now, schedules, canReceive, showMealToast]);

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        zIndex: 50_000,
      }}
      pointerEvents="box-none"
    >
      {toast}
    </View>
  );
}
