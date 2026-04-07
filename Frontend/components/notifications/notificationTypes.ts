import type { NotificationLogEntry } from "@/services/notificationLog";
import type { CareConfirmationData, CareConfirmationStatus } from "@/services/careConfirmationNotifications";

export type NotificationStatusTone = { bg: string; border: string; text: string };

export const toneForType = (type: NotificationLogEntry["type"]): NotificationStatusTone => {
  if (type === "medication") return { bg: "#EEF2FF", border: "#C7D2FE", text: "#1D4ED8" }; // blue
  if (type === "weekly-schedule") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" }; // green
  if (type === "care-confirmation") return { bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" }; // orange
  if (type === "room-message") return { bg: "#EEF2FF", border: "#C7D2FE", text: "#1D4ED8" }; // blue (chat)
  return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" }; // gray
};

export const labelForType = (type: NotificationLogEntry["type"]) => {
  if (type === "weekly-schedule") return "Quản lý lịch sinh hoạt";
  if (type === "medication") return "Nhắc nhở uống thuốc";
  if (type === "care-confirmation") return "Xác nhận chăm sóc";
  if (type === "room-message") return "Tin nhắn phòng";
  return "Hệ thống";
};

/** Phân loại cảnh báo camera (data.type === "safety" trong log type system). */
export type SafetyKind = "fall" | "left_safe_zone";

export function safetyKindFromEntry(entry: NotificationLogEntry): SafetyKind | null {
  const d: any = entry?.data;
  if (!d || d.type !== "safety") return null;
  if (d.safety_type === "left_safe_zone") return "left_safe_zone";
  return "fall";
}

export function categoryLabelForEntry(entry: NotificationLogEntry): string {
  const sk = safetyKindFromEntry(entry);
  if (sk === "fall") return "Té ngã";
  if (sk === "left_safe_zone") return "Rời vùng an toàn";
  return labelForType(entry.type);
}

export function categoryToneForEntry(entry: NotificationLogEntry): NotificationStatusTone {
  const sk = safetyKindFromEntry(entry);
  if (sk === "fall") return { bg: "#FEE2E2", border: "#FECACA", text: "#991B1B" };
  if (sk === "left_safe_zone") return { bg: "#FFEDD5", border: "#FDBA74", text: "#C2410C" };
  return toneForType(entry.type);
}

export const statusLabelForCareConfirmation = (status: CareConfirmationStatus) => {
  if (status === "done") return "Hoàn tất";
  if (status === "half") return "Đã xác nhận 1 bên";
  return "Chưa xác nhận";
};

export const toneForCareConfirmationStatus = (status: CareConfirmationStatus): NotificationStatusTone => {
  if (status === "done") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" }; // green
  if (status === "half") return { bg: "#FFEDD5", border: "#FED7AA", text: "#C2410C" }; // orange
  return { bg: "#FEF3C7", border: "#FDE68A", text: "#92400E" }; // amber
};

export const isCareConfirmationData = (data: any): data is CareConfirmationData =>
  !!data && data.kind === "care-confirmation" && typeof data.thread_id === "string" && !!data.confirmations;

