import type { NotificationLogEntry } from "@/services/notificationLog";
import type { CareConfirmationData, CareConfirmationStatus } from "@/services/careConfirmationNotifications";

export type NotificationStatusTone = { bg: string; border: string; text: string };

export const toneForType = (type: NotificationLogEntry["type"]): NotificationStatusTone => {
  if (type === "medication") return { bg: "#EEF2FF", border: "#C7D2FE", text: "#1D4ED8" }; // blue
  if (type === "weekly-schedule") return { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" }; // green
  if (type === "care-confirmation") return { bg: "#FFF7ED", border: "#FED7AA", text: "#9A3412" }; // orange
  return { bg: "#F3F4F6", border: "#E5E7EB", text: "#374151" }; // gray
};

export const labelForType = (type: NotificationLogEntry["type"]) => {
  if (type === "weekly-schedule") return "Quản lý lịch sinh hoạt";
  if (type === "medication") return "Nhắc nhở uống thuốc";
  if (type === "care-confirmation") return "Xác nhận chăm sóc";
  return "Hệ thống";
};

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

