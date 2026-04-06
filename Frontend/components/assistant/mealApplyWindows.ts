import dayjs from "dayjs";
import { MealKey, MealPlanDay } from "./mealPlanTypes";

/** Khung giờ áp dụng vào lịch (khớp start_time khi tạo daily schedule) */
export const MEAL_TIMES: Record<MealKey, { label: string; start: string; end: string }> = {
  breakfast: { label: "Breakfast", start: "07:00", end: "08:00" },
  lunch: { label: "Lunch", start: "12:00", end: "13:00" },
  dinner: { label: "Dinner", start: "18:00", end: "19:00" },
};

export const MEAL_APPLY_LABEL_VI: Record<MealKey, string> = {
  breakfast: "bữa sáng",
  lunch: "bữa trưa",
  dinner: "bữa tối",
};

/**
 * 00:00 đúng theo lịch địa phương của ngày trên thẻ.
 * Tránh bug `dayjs("YYYY-MM-DD")` / ISO date-only bị parse theo UTC → lệch ngày so với `now.startOf("day")`.
 */
export function parseMealPlanDateLocalStart(raw: string): dayjs.Dayjs | null {
  const s = String(raw || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    if (!Number.isFinite(y) || mo < 0 || mo > 11 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dayjs(dt).startOf("day");
  }
  const fallback = dayjs(s);
  return fallback.isValid() ? fallback.startOf("day") : null;
}

/** Ngày đã qua (trước hôm nay) → coi mọi bữa đều không còn áp dụng được. */
export function isMealApplyWindowPassed(planDateYmd: string, mealKey: MealKey, now: dayjs.Dayjs = dayjs()): boolean {
  const planStart = parseMealPlanDateLocalStart(planDateYmd);
  if (!planStart) return true;
  const todayStart = now.startOf("day");
  if (planStart.isBefore(todayStart)) return true;
  if (planStart.isAfter(todayStart)) return false;
  const end = MEAL_TIMES[mealKey].end;
  const [h, m] = end.split(":").map((x) => Number(x));
  const slotEnd = planStart.hour(h).minute(m).second(0).millisecond(0);
  return now.isAfter(slotEnd);
}

/** Các bữa có nội dung và vẫn trong/ chưa quá khung giờ kết thúc (theo `now`). */
export function getApplicableMealKeys(dayItem: MealPlanDay, now: dayjs.Dayjs = dayjs()): MealKey[] {
  return (["breakfast", "lunch", "dinner"] as MealKey[]).filter((mealKey) => {
    const mealName = String(dayItem.meals[mealKey] || "").trim();
    if (!mealName) return false;
    if (isMealApplyWindowPassed(dayItem.date, mealKey, now)) return false;
    return true;
  });
}
