import { Platform } from "react-native";
import {
  getMyRoom,
  getRoomMembers,
  getRoomPatient,
  type RoomMemberRole,
} from "@/services/api";
import {
  appendNotificationLog,
  getNotificationLogs,
  updateNotificationLog,
  type NotificationLogEntry,
} from "@/services/notificationLog";

export type CareConfirmationStatus = "pending" | "half" | "done";

export type CareConfirmationData = {
  kind: "care-confirmation";
  thread_id: string;
  room_id?: string;
  room_name?: string;
  elder_name?: string;
  caregiver_name?: string;
  host_name?: string;
  requested_by?: RoomMemberRole;
  target_role?: RoomMemberRole;
  confirmations: { host: boolean; caretaker: boolean };
  first_confirmed_by?: RoomMemberRole;
  confirmed_by?: RoomMemberRole;
  status: CareConfirmationStatus;
};

const otherRole = (role: RoomMemberRole): RoomMemberRole => (role === "host" ? "caretaker" : "host");

const safeName = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

const makeThreadId = (roomId?: string) => {
  const seed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return roomId ? `${roomId}::${seed}` : seed;
};

export async function createCareConfirmationRequest(): Promise<void> {
  const room = await getMyRoom();
  const patient = await getRoomPatient().catch(() => null);
  const members = await getRoomMembers().catch(() => []);

  const myRole = room?.member_role ?? "host";
  const toRole = otherRole(myRole);

  const caretaker = members.find((m) => m.member_role === "caretaker");
  const host = members.find((m) => m.member_role === "host");

  const roomIdText = safeName(room?.room_id);
  const threadId = makeThreadId(roomIdText || undefined);

  const elderName = safeName(patient?.full_name);
  const caregiverName = safeName(caretaker?.fullName || caretaker?.username);
  const hostName = safeName(host?.fullName || host?.username);

  const roomLabel = roomIdText ? `Room ${roomIdText}` : "Room";
  const title = `Xác nhận chăm sóc - ${roomLabel}`;
  const bodyLines = [
    roomIdText ? `Phòng: ${roomIdText}` : "",
    elderName ? `Người cần chăm sóc: ${elderName}` : "",
    caregiverName ? `Người chăm sóc: ${caregiverName}` : "",
    hostName ? `Chủ phòng: ${hostName}` : "",
    `Trạng thái: Chờ xác nhận`,
  ].filter(Boolean);

  const data: CareConfirmationData = {
    kind: "care-confirmation",
    thread_id: threadId,
    room_id: roomIdText || undefined,
    room_name: roomIdText || undefined,
    elder_name: elderName || undefined,
    caregiver_name: caregiverName || undefined,
    host_name: hostName || undefined,
    requested_by: myRole,
    target_role: toRole,
    confirmations: { host: false, caretaker: false },
    status: "pending",
  };

  await appendNotificationLog({
    type: "care-confirmation",
    title,
    body: bodyLines.join("\n"),
    data,
    read: false,
  });

  if (Platform.OS !== "web") {
    const Notifications = await import("expo-notifications");
    await Notifications.scheduleNotificationAsync({
      content: { title, body: `${myRole === "host" ? "Chủ phòng" : "Người chăm sóc"} đã tạo yêu cầu xác nhận.` },
      trigger: null,
    });
  }
}

const computeStatus = (c: { host: boolean; caretaker: boolean }): CareConfirmationStatus => {
  const count = (c.host ? 1 : 0) + (c.caretaker ? 1 : 0);
  if (count >= 2) return "done";
  if (count === 1) return "half";
  return "pending";
};

export const isCareConfirmationLog = (it: NotificationLogEntry | null | undefined): it is NotificationLogEntry & { data: CareConfirmationData } =>
  !!it && it.type === "care-confirmation" && (it.data as any)?.kind === "care-confirmation";

export async function confirmCareNotification(logId: string, role: RoomMemberRole): Promise<void> {
  const logs = await getNotificationLogs();
  const entry = logs.find((x) => x.id === logId);
  if (!isCareConfirmationLog(entry)) return;

  const data = entry.data;
  const current = { ...data.confirmations };
  if (role === "host" && current.host) return;
  if (role === "caretaker" && current.caretaker) return;

  const nextConfirmations =
    role === "host" ? { ...current, host: true } : { ...current, caretaker: true };
  const status = computeStatus(nextConfirmations);
  const nextData: CareConfirmationData = {
    ...data,
    confirmations: nextConfirmations,
    first_confirmed_by: data.first_confirmed_by || role,
    confirmed_by: role,
    status,
  };

  // update current log (so it fades / shows status immediately)
  await updateNotificationLog(logId, {
    data: nextData as any,
  });

  const roomLabel = safeName(nextData.room_id) ? `Room ${nextData.room_id}` : "Room";
  const title = `Xác nhận chăm sóc - ${roomLabel}`;
  const statusText =
    status === "done"
      ? "Đã xác nhận đầy đủ"
      : role === "host"
        ? "Host đã xác nhận"
        : "Caregiver đã xác nhận";

  const bodyLines = [
    nextData.room_id ? `Phòng: ${nextData.room_id}` : "",
    nextData.elder_name ? `Người cần chăm sóc: ${nextData.elder_name}` : "",
    nextData.caregiver_name ? `Người chăm sóc: ${nextData.caregiver_name}` : "",
    nextData.host_name ? `Chủ phòng: ${nextData.host_name}` : "",
    `Trạng thái: ${statusText}${status !== "done" ? " / Chờ bên còn lại xác nhận" : ""}`,
  ].filter(Boolean);

  // create follow-up for other role if not done
  if (status !== "done") {
    const followData: CareConfirmationData = {
      ...nextData,
      requested_by: role,
      target_role: otherRole(role),
    };
    await appendNotificationLog({
      type: "care-confirmation",
      title,
      body: bodyLines.join("\n"),
      data: followData as any,
      read: false,
    });
  } else {
    // optional completion notification
    await appendNotificationLog({
      type: "care-confirmation",
      title,
      body: bodyLines.join("\n"),
      data: nextData as any,
      read: false,
    });
  }
}

