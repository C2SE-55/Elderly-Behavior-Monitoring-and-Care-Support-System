import type { DailyScheduleItem } from "@/services/api";

const DONE_MARKER = "[ĐÃ XONG]";

/** Đồng bộ với logic nút Đã xong (ghi marker vào mô tả). */
export function isScheduleMarkedDone(item: Pick<DailyScheduleItem, "description">): boolean {
  return String(item.description || "").includes(DONE_MARKER);
}
