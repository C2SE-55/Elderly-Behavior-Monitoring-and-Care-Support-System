import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import dayjs from "dayjs";
import ChatbotLogo from "./ChatbotLogo";
import {
  createDailySchedule,
  deleteDailySchedule,
  generateMealPlanByDateRange,
  sendChatMessage,
  getCurrentUser,
  getMyRoom,
  subscribeActiveRoomChange,
  getChatSessionMessages,
  getChatSessions,
  deleteChatSession,
  getDailySchedules,
  getLastChatSessionId,
  saveMealPlanTemplate,
  getMealPlanTemplates,
  setLastChatSessionId,
  type ChatSessionSummary,
  type MealPlanTemplate as ApiMealPlanTemplate,
  type MyRoomInfo,
} from "@/services/api";
import { emitScheduleRefresh } from "@/services/scheduleEvents";
import DateRangePicker from "./DateRangePicker";
import MealPlanCard from "./MealPlanCard";
import ApplyMealPlanButton from "./ApplyMealPlanButton";
import {
  getApplicableMealKeys,
  isMealApplyWindowPassed,
  MEAL_APPLY_LABEL_VI,
  MEAL_TIMES,
  parseMealPlanDateLocalStart,
} from "./mealApplyWindows";
import { MealKey, MealPlanDay, MealPlanMeals, MealPlanTemplate } from "./mealPlanTypes";

const { width, height } = Dimensions.get("window");

/** Chuẩn hóa danh sách phiên từ API — đảm bảo mỗi phiên có id và title hiển thị được */
function normalizeSessionList(
  sessions: ChatSessionSummary[] | null | undefined
): ChatSessionSummary[] {
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map((s) => {
      const id = Number(s?.id) || 0;
      const rawTitle = s?.title;
      const title =
        typeof rawTitle === "string" && rawTitle.trim()
          ? rawTitle.trim()
          : id
            ? `Phiên #${id}`
            : "Phiên chat";
      return { ...s, id: id || (s?.id as number), title };
    })
    .filter((s) => s.id > 0);
}

const BOT_SIZE = 56;
const BOTTOM_SAFE_OFFSET = 100;

// Màu chủ đạo — giao diện hiện đại, dễ đọc
const COLORS = {
  primary: "#5B3A9E",
  primaryLight: "#7C5CBF",
  primarySoft: "#EDE9F7",
  surface: "#F8F7FC",
  card: "#FFFFFF",
  bubbleUser: "#5B3A9E",
  bubbleAssistant: "#FFFFFF",
  textPrimary: "#1F2937",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  border: "#E5E7EB",
  online: "#10B981",
  shadow: "rgba(91, 58, 158, 0.12)",
};

/** Phát hiện dòng là tiêu đề section (vd: "GIỮA CHIỀU (15 h)", "TỐI (17-18 h)") */
function isSectionHeader(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  // Tiêu đề thường ngắn, có thể viết hoa hoặc có dạng (X h) / (X–Y h)
  return t.length < 55 && (/\(\d+[\s–-]*\d*\s*h\)/.test(t) || /^[A-ZÀ-Ỹ\s\d()–-]+$/.test(t));
}

/** Payload thực đơn / dinh dưỡng chatbot trả về dạng JSON */
type AssistantMealDayPayload = {
  date?: string;
  meals?: Partial<Record<MealKey, string>>;
  nutrition?: Partial<Record<"kcal" | "protein" | "fat" | "carbs" | "fiber" | "sodium", number>>;
};

const MEAL_LABEL_VI: Record<MealKey, string> = {
  breakfast: "Bữa sáng",
  lunch: "Bữa trưa",
  dinner: "Bữa tối",
};

const NUTRITION_ORDER = ["kcal", "protein", "fat", "carbs", "fiber", "sodium"] as const;

const NUTRITION_LABEL_VI: Record<(typeof NUTRITION_ORDER)[number], string> = {
  kcal: "Năng lượng",
  protein: "Đạm",
  fat: "Chất béo",
  carbs: "Tinh bột",
  fiber: "Chất xơ",
  sodium: "Natri",
};

function stripAssistantMarkdownFence(text: string): string {
  let t = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fenced) return fenced[1].trim();
  if (t.startsWith("```")) {
    const firstNl = t.indexOf("\n");
    if (firstNl !== -1) t = t.slice(firstNl + 1);
    if (t.endsWith("```")) t = t.slice(0, -3);
    t = t.trim();
  }
  return t;
}

function isMealDayShape(o: unknown): o is AssistantMealDayPayload {
  if (!o || typeof o !== "object" || Array.isArray(o)) return false;
  const r = o as Record<string, unknown>;
  if (r.meals != null && typeof r.meals === "object" && !Array.isArray(r.meals)) return true;
  if (r.nutrition != null && typeof r.nutrition === "object" && !Array.isArray(r.nutrition)) return true;
  return false;
}

/** Bắt chuỗi JSON thực đơn (có thể bọc ```json ... ```) */
function tryParseAssistantMealJson(content: string): AssistantMealDayPayload[] | null {
  let raw = stripAssistantMarkdownFence(content);
  if (!raw.startsWith("[") && !raw.startsWith("{")) {
    const i = raw.indexOf("[");
    if (i >= 0) raw = raw.slice(i);
  }
  if (!raw.startsWith("[") && !raw.startsWith("{")) return null;
  try {
    const data = JSON.parse(raw) as unknown;
    const arr = Array.isArray(data) ? data : [data];
    if (!arr.length || !arr.every(isMealDayShape)) return null;
    return arr;
  } catch {
    return null;
  }
}

const assistantStructuredStyles = StyleSheet.create({
  dayBlock: { marginBottom: 14 },
  mealParagraph: { marginTop: 6 },
  mealLabel: { fontWeight: "700" as const, color: COLORS.textPrimary },
  nutritionBlock: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border },
  nutritionLine: { marginTop: 4 },
});

function formatNutrientValue(key: (typeof NUTRITION_ORDER)[number], v: number): string {
  if (key === "kcal") return `${v} kcal`;
  if (key === "sodium") return `${v} mg`;
  return `${v} g`;
}

/** Hiển thị thực đơn / dinh dưỡng từ JSON — thay cho chuỗi JSON thô */
function FormattedAssistantMealDays({
  days,
  textStyle,
  sectionStyle,
}: {
  days: AssistantMealDayPayload[];
  textStyle: object;
  sectionStyle: object;
}) {
  return (
    <View style={markdownBlocksWrapStyle}>
      {days.map((day, idx) => (
        <View key={`${day.date ?? "d"}-${idx}`} style={assistantStructuredStyles.dayBlock}>
          {!!day.date?.trim() && (
            <Text
              style={[
                textStyle,
                sectionStyle,
                idx === 0 && { marginTop: 0 },
              ]}
            >
              {dayjs(day.date).isValid() ? dayjs(day.date).format("DD/MM/YYYY") : day.date}
            </Text>
          )}
          {(["breakfast", "lunch", "dinner"] as MealKey[]).map((key) => {
            const line = String(day.meals?.[key] ?? "").trim();
            if (!line) return null;
            return (
              <Text key={key} style={[textStyle, assistantStructuredStyles.mealParagraph]}>
                <Text style={assistantStructuredStyles.mealLabel}>{MEAL_LABEL_VI[key]}: </Text>
                {line}
              </Text>
            );
          })}
          {day.nutrition &&
            NUTRITION_ORDER.some((k) => {
              const v = day.nutrition?.[k];
              return v != null && !Number.isNaN(Number(v));
            }) && (
              <View style={assistantStructuredStyles.nutritionBlock}>
                <Text style={[textStyle, sectionStyle, { marginTop: 0, marginBottom: 2 }]}>Dinh dưỡng (ước tính)</Text>
                {NUTRITION_ORDER.map((key) => {
                  const raw = day.nutrition?.[key];
                  if (raw == null || Number.isNaN(Number(raw))) return null;
                  const num = Number(raw);
                  return (
                    <Text key={key} style={[textStyle, assistantStructuredStyles.nutritionLine]}>
                      <Text style={assistantStructuredStyles.mealLabel}>{NUTRITION_LABEL_VI[key]}: </Text>
                      {formatNutrientValue(key, Math.round(num * 10) / 10)}
                    </Text>
                  );
                })}
              </View>
            )}
        </View>
      ))}
    </View>
  );
}

const inlineBoldStyle = { fontWeight: "700" as const };

/** Parse **đậm** trong một dòng → nội dung hợp lệ làm con của <Text> */
function renderTextWithBoldSegments(line: string, baseStyle: object): React.ReactNode {
  const segments = line.split(/(\*\*[^*]+\*\*)/g);
  if (segments.length === 1) {
    return line;
  }
  return segments.map((seg, i) => {
    if (!seg) return null;
    const bm = seg.match(/^\*\*([^*]+)\*\*$/);
    if (bm) {
      return (
        <Text key={i} style={[baseStyle, inlineBoldStyle]}>
          {bm[1]}
        </Text>
      );
    }
    return seg;
  });
}

function looksLikeMarkdownAssistantText(text: string): boolean {
  return (
    /\*\*[^*]+\*\*/.test(text) ||
    /^\s*[-*•·\u2013\u2014]\s+\S/m.test(text) ||
    /^\s*•\s*\S/m.test(text) ||
    /^\s*\d+\.\s+\S/m.test(text)
  );
}

const markdownBlocksWrapStyle = { width: "100%" as const };

const USER_MEAL_KEY_VI: Record<string, string> = {
  breakfast: "Sáng",
  lunch: "Trưa",
  dinner: "Tối",
};

const userPromptBubbleStyles = StyleSheet.create({
  plainText: { color: "#FFFFFF", fontSize: 14, lineHeight: 22, flexShrink: 1 },
  promptTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "800", marginBottom: 8 },
  promptLine: { color: "rgba(255,255,255,0.96)", fontSize: 14, lineHeight: 22, marginBottom: 4 },
  promptHint: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 18, marginBottom: 6 },
  promptExplain: {
    color: "rgba(255,255,255,0.93)",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  mdSection: {
    fontWeight: "700",
    fontSize: 13,
    color: "#EDE9FE",
    marginTop: 8,
    marginBottom: 4,
  },
  mdParagraph: { marginBottom: 6 },
  mdText: { color: "#FFFFFF", fontSize: 14, lineHeight: 22 },
});

function isStoredMealPlanJsonPrompt(content: string): boolean {
  return (
    /JSON array/i.test(content) && /"meals"\s*:/.test(content) && /YYYY-MM-DD/.test(content)
  );
}

function parseMealPlanPromptDisplay(
  content: string
): { start: string; end: string; mealsStr?: string } | null {
  const between =
    content.match(/Từ ngày\s+(\d{4}-\d{2}-\d{2})\s+đến\s+(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Khoảng ngày:\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/i) ||
    content.match(/Khoảng ngày:\s*(\d{4}-\d{2}-\d{2})\s*→\s*(\d{4}-\d{2}-\d{2})/i);
  if (!between) return null;
  const start = between[1];
  const end = between[2];
  const mealsMatch =
    content.match(/Chỉ tạo chi tiết cho các bữa:\s*([^\n]+)/i) ||
    content.match(/Chi tiết cho các bữa được chọn:\s*([^\n]+)/i) ||
    content.match(/Chi tiết cho các bữa được chọn:\s*([^\n]+)/i);
  let mealsStr = mealsMatch?.[1]?.trim();
  if (mealsStr) {
    mealsStr = mealsStr
      .replace(/\.\s*$/, "")
      .replace(/\s*Các bữa kh.*$/i, "")
      .replace(/\s*Cac bua kh.*$/i, "")
      .trim();
  }
  return { start, end, mealsStr };
}

/** Tin user là prompt nội bộ gửi chatbot — hiển thị gọn, không dải một dòng */
function MealPlanUserPromptBubble({ content }: { content: string }) {
  const meta = parseMealPlanPromptDisplay(content);
  const mealsReadable =
    meta?.mealsStr
      ?.split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((k) => USER_MEAL_KEY_VI[k.toLowerCase()] || k)
      .join(", ") ?? "";

  return (
    <View style={markdownBlocksWrapStyle}>
      <Text style={userPromptBubbleStyles.promptTitle}>Tạo thực đơn</Text>
      {meta ? (
        <>
          <Text style={userPromptBubbleStyles.promptLine}>
            {dayjs(meta.start).format("DD/MM/YYYY")} → {dayjs(meta.end).format("DD/MM/YYYY")}
          </Text>
          {mealsReadable.length > 0 ? (
            <Text style={userPromptBubbleStyles.promptLine}>Bữa có món: {mealsReadable}</Text>
          ) : null}
        </>
      ) : (
        <Text style={userPromptBubbleStyles.promptHint}>
          Ứng dụng đang gửi yêu cầu tạo thực đơn tới trợ lý; kết quả gợi ý sẽ hiện ở tin nhắn hoặc khung «Thực đơn» phía trên.
        </Text>
      )}
      <Text style={userPromptBubbleStyles.promptExplain}>
        Trợ lý sẽ gợi ý món cụ thể cho từng bữa (sáng, trưa, tối) trong khoảng ngày bạn chọn. Bạn chỉ cần đọc gợi ý bên dưới, chỉnh sửa nếu muốn rồi áp dụng vào lịch ăn — không cần xem định dạng kỹ thuật.
      </Text>
      {!meta ? (
        <Text style={[userPromptBubbleStyles.plainText, { marginTop: 10 }]} selectable>
          {content}
        </Text>
      ) : null}
    </View>
  );
}

function UserMessageBubbleBody({ content }: { content: string }) {
  if (isStoredMealPlanJsonPrompt(content)) {
    return <MealPlanUserPromptBubble content={content} />;
  }
  if (looksLikeMarkdownAssistantText(content)) {
    return (
      <MarkdownishAssistantContent
        content={content}
        style={{
          section: userPromptBubbleStyles.mdSection,
          paragraph: userPromptBubbleStyles.mdParagraph,
          text: userPromptBubbleStyles.mdText,
        }}
      />
    );
  }
  return <Text style={userPromptBubbleStyles.plainText}>{content}</Text>;
}

/** Công thức / hướng dẫn dạng markdown nhẹ từ LLM — **tiêu đề**, bullet, khoảng cách */
function MarkdownishAssistantContent({
  content,
  style,
}: {
  content: string;
  style: { section: object; paragraph: object; text: object };
}) {
  const lines = content.split(/\n/);
  const blocks: React.ReactNode[] = [];
  let k = 0;

  const wrapParagraph = (trimmed: string, withParagraphSpacing: boolean) => (
    <View
      key={`p-${k++}`}
      style={[withParagraphSpacing ? { marginBottom: 12 } : undefined, { width: "100%" }]}
    >
      <Text style={[style.text, style.paragraph]}>
        {renderTextWithBoldSegments(trimmed, [style.text, style.paragraph])}
      </Text>
    </View>
  );

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trimEnd();
    const t = trimmed.trim();

    if (!t) {
      blocks.push(<View key={`sp-${k++}`} style={{ height: 6 }} />);
      continue;
    }

    const bullet = t.match(/^[-*•·\u2013\u2014]\s+(.+)$/) || t.match(/^•\s*(.+)$/);
    if (bullet) {
      blocks.push(
        <View
          key={`li-${k++}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 8,
            paddingRight: 4,
            width: "100%",
          }}
        >
          <Text style={[style.text, { width: 16, lineHeight: 22, marginTop: 1 }]}>•</Text>
          <Text style={[style.text, { flex: 1, minWidth: 0, lineHeight: 22 }]}>
            {renderTextWithBoldSegments(bullet[1], style.text)}
          </Text>
        </View>
      );
      continue;
    }

    const numbered = t.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      blocks.push(
        <View
          key={`ln-${k++}`}
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: 8,
            paddingRight: 4,
            width: "100%",
          }}
        >
          <Text style={[style.text, { minWidth: 22, lineHeight: 22, marginTop: 1, fontWeight: "600" }]}>
            {numbered[1]}.
          </Text>
          <Text style={[style.text, { flex: 1, minWidth: 0, lineHeight: 22 }]}>
            {renderTextWithBoldSegments(numbered[2], style.text)}
          </Text>
        </View>
      );
      continue;
    }

    const loneHeading = t.match(/^\*\*([^*]+)\*\*\s*:?\s*$/);
    if (loneHeading) {
      blocks.push(
        <Text
          key={`hd-${k++}`}
          style={[
            style.text,
            style.section,
            blocks.length ? { marginTop: 6 } : { marginTop: 0 },
            { marginBottom: 4 },
          ]}
        >
          {loneHeading[1].trim()}
        </Text>
      );
      continue;
    }

    blocks.push(wrapParagraph(t, true));
  }

  return <View style={markdownBlocksWrapStyle}>{blocks}</View>;
}

/** Render nội dung tin nhắn — tách section để dễ đọc (meal plan, v.v.) */
function MessageContent({ content, style }: { content: string; style: { section: object; paragraph: object; text: object } }) {
  const structured = tryParseAssistantMealJson(content);
  if (structured && structured.length) {
    return (
      <FormattedAssistantMealDays
        days={structured}
        textStyle={style.text}
        sectionStyle={style.section}
      />
    );
  }

  if (looksLikeMarkdownAssistantText(content)) {
    return <MarkdownishAssistantContent content={content} style={style} />;
  }

  const lines = content.split(/\n/);
  const nodes: React.ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isSectionHeader(line)) {
      const isFirst = nodes.length === 0;
      nodes.push(
        <Text key={`h-${i}`} style={[style.text, style.section, isFirst && { marginTop: 0 }]}>
          {line.trim()}
        </Text>
      );
      i++;
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && !isSectionHeader(lines[i])) {
      if (lines[i].trim()) paragraph.push(lines[i].trim());
      i++;
    }
    if (paragraph.length) {
      nodes.push(
        <Text key={`p-${i}`} style={[style.text, style.paragraph]}>
          {paragraph.join("\n")}
        </Text>
      );
    }
  }
  if (nodes.length === 0) return <Text style={style.text}>{content}</Text>;
  return <>{nodes}</>;
}

/** Chuẩn hóa phản hồi để tránh hiển thị rỗng/truncated khi backend đổi schema */
function normalizeAssistantReply(rawReply: unknown): string {
  if (typeof rawReply === "string" && rawReply.trim()) return rawReply.trim();
  if (Array.isArray(rawReply) && rawReply.length && rawReply.every(isMealDayShape)) {
    return JSON.stringify(rawReply);
  }
  if (rawReply && typeof rawReply === "object") {
    const obj = rawReply as Record<string, unknown>;
    for (const key of ["plan", "days", "meal_plan", "meals"] as const) {
      const v = obj[key];
      if (Array.isArray(v) && v.length && v.every(isMealDayShape)) {
        return JSON.stringify(v);
      }
    }
    const candidates = [obj.reply, obj.message, obj.answer, obj.content];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
      if (Array.isArray(c) && c.length && c.every(isMealDayShape)) {
        return JSON.stringify(c);
      }
    }
  }
  return "Mình chưa nhận được nội dung phản hồi rõ ràng. Bạn thử gửi lại giúp mình nhé.";
}

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const toDayKey = (isoDate: string): DayKey => {
  const parsed = parseMealPlanDateLocalStart(isoDate);
  const d = (parsed ?? dayjs(isoDate)).day();
  if (d === 0) return "sun";
  if (d === 1) return "mon";
  if (d === 2) return "tue";
  if (d === 3) return "wed";
  if (d === 4) return "thu";
  if (d === 5) return "fri";
  return "sat";
};

const DEFAULT_MEALS: MealKey[] = ["breakfast", "lunch", "dinner"];

const parseDateToken = (raw: string): dayjs.Dayjs | null => {
  const clean = String(raw || "").trim().replace(/\./g, "/");
  const currentYear = dayjs().year();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = dayjs(clean);
    return d.isValid() ? d : null;
  }
  const dm = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (dm) {
    const d = dayjs(`${currentYear}-${dm[2].padStart(2, "0")}-${dm[1].padStart(2, "0")}`);
    return d.isValid() ? d : null;
  }
  const dmy = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = dayjs(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`);
    return d.isValid() ? d : null;
  }
  return null;
};

const extractDateRangeFromText = (text: string): { start: string; end: string } | null => {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\./g, "/")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return null;
  const tokens = normalized.match(/\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2}/g) || [];
  if (tokens.length < 2) return null;
  const start = parseDateToken(tokens[0] || "");
  const end = parseDateToken(tokens[1] || "");
  if (!start || !end) return null;
  return { start: start.format("YYYY-MM-DD"), end: end.format("YYYY-MM-DD") };
};

const extractMealKeysFromText = (text: string): MealKey[] => {
  const lower = String(text || "").toLowerCase();
  const hasBreakfast = /(sang|bua sang|breakfast)/.test(lower);
  const hasLunch = /(trua|bua trua|lunch)/.test(lower);
  const hasDinner = /(toi|bua toi|dinner)/.test(lower);
  const keys: MealKey[] = [];
  if (hasBreakfast) keys.push("breakfast");
  if (hasLunch) keys.push("lunch");
  if (hasDinner) keys.push("dinner");
  return keys.length ? keys : DEFAULT_MEALS;
};

const hasDateToken = (text: string) =>
  /(\d{1,2}\/\d{1,2}(?:\/\d{4})?|\d{4}-\d{2}-\d{2})/i.test(String(text || ""));

const hasRangeKeyword = (text: string) =>
  /(từ|tu|đến|den|tới|\bto\b|-)/i.test(String(text || ""));

/** Có 2 ngày + user nói rõ tạo thực đơn (không cần bật nút Thực đơn trước) */
const textImpliesMealPlanRequest = (text: string) =>
  /(thực\s*đơn|thuc\s*don|gợi\s*ý\s*thực|goi\s*y\s*thuc|tạo\s+thực|tao\s+thuc|meal\s*plan|menu\s+theo\s+ngày)/i.test(
    String(text || "")
  );

const INITIAL_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: "Xin chào bạn 👋 Hôm nay bạn thế nào? Mình là trợ lý dinh dưỡng, có thể giúp bạn gợi ý thực đơn, khẩu phần ăn hay tư vấn sức khỏe.",
};

/** Gợi ý tin nhắn khi mới vào trang chatbot */
const MESSAGE_SUGGESTIONS = [
  { id: "1", label: "Gợi ý thực đơn", icon: "🍽️", prompt: "Gợi ý thực đơn dinh dưỡng cho tôi", color: "#5B3A9E" },
  { id: "2", label: "Nhắc uống thuốc", icon: "💊", prompt: "Nhắc tôi uống thuốc", color: "#059669" },
  { id: "3", label: "Tư vấn dinh dưỡng", icon: "❤️", prompt: "Tư vấn dinh dưỡng phù hợp sức khỏe", color: "#DC2626" },
  { id: "4", label: "Khẩu phần ăn", icon: "📋", prompt: "Gợi ý khẩu phần ăn trong ngày", color: "#D97706" },
];

const FloatingAssistant: React.FC = () => {
  const [permissionLoading, setPermissionLoading] = useState(true);
  const [roomInfo, setRoomInfo] = useState<MyRoomInfo | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [input, setInput] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionList, setSessionList] = useState<ChatSessionSummary[]>([]);
  const [initializing, setInitializing] = useState(false);
  const [sessionIdToDelete, setSessionIdToDelete] = useState<number | null>(null);
  const [mealPlannerOpen, setMealPlannerOpen] = useState(false);
  const [generatingMealPlan, setGeneratingMealPlan] = useState(false);
  const [mealPlanDays, setMealPlanDays] = useState<MealPlanDay[]>([]);
  const [plannerMealKeys, setPlannerMealKeys] = useState<MealKey[]>(DEFAULT_MEALS);
  const [applyingAll, setApplyingAll] = useState(false);
  const [applyingByDate, setApplyingByDate] = useState<Record<string, boolean>>({});
  const [plannerToast, setPlannerToast] = useState("");
  const [templates, setTemplates] = useState<MealPlanTemplate[]>([]);
  const mealPlanFade = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const resolveUserId = useCallback(() => {
    const user = getCurrentUser() as any;
    return user?.id ?? user?.user_id ?? undefined;
  }, []);

  const initialPos = {
    x: width - BOT_SIZE - 24,
    y: height - BOTTOM_SAFE_OFFSET - BOT_SIZE,
  };

  // Lưu toạ độ logic
  const positionRef = useRef(initialPos);
  // Animated value để di chuyển mượt mà
  const animatedPos = useRef(new Animated.ValueXY(initialPos)).current;

  const gestureRef = useRef({ startX: 0, startY: 0, moved: false });

  const loadRoomPermission = useCallback(async () => {
    try {
      setPermissionLoading(true);
      const room = await getMyRoom();
      setRoomInfo(room);
    } catch {
      setRoomInfo(null);
    } finally {
      setPermissionLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRoomPermission();
    const unsubscribe = subscribeActiveRoomChange(() => {
      void loadRoomPermission();
    });
    return unsubscribe;
  }, [loadRoomPermission]);

  const canUseChatbot = roomInfo?.member_role === "host";

  useEffect(() => {
    const rows = getMealPlanTemplates() as MealPlanTemplate[];
    setTemplates(rows.slice(0, 5));
  }, []);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponder: (_evt, gestureState) => Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 2,
        onMoveShouldSetPanResponderCapture: (_evt, gestureState) => Math.abs(gestureState.dx) + Math.abs(gestureState.dy) > 2,
        onPanResponderTerminationRequest: () => false,
        // Quan trọng: chặn ScrollView/native responder phía sau khi kéo bubble
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: () => {
          gestureRef.current = { startX: positionRef.current.x, startY: positionRef.current.y, moved: false };
        },
        onPanResponderMove: (_evt, gestureState) => {
          gestureRef.current.moved = true;

          let nextX = gestureRef.current.startX + gestureState.dx;
          let nextY = gestureRef.current.startY + gestureState.dy;

          const margin = 8;
          nextX = Math.max(margin, Math.min(nextX, width - BOT_SIZE - margin));
          nextY = Math.max(margin, Math.min(nextY, height - BOT_SIZE - BOTTOM_SAFE_OFFSET));

          positionRef.current = { x: nextX, y: nextY };
          animatedPos.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_evt, gestureState) => {
          const distance = Math.abs(gestureState.dx) + Math.abs(gestureState.dy);

          // Snap về cạnh gần nhất giống chat-head iOS
          const margin = 8;
          const middleX = width / 2;
          const currentX = positionRef.current.x;
          const snappedX =
            currentX + BOT_SIZE / 2 < middleX
              ? margin
              : width - BOT_SIZE - margin;

          positionRef.current = { x: snappedX, y: positionRef.current.y };

          Animated.spring(animatedPos, {
            toValue: { x: snappedX, y: positionRef.current.y },
            useNativeDriver: true,
            friction: 7,
            tension: 40,
          }).start();

          // Nếu gần như không kéo thì coi như click để mở chat
          if (distance < 5) {
            setChatOpen((prev) => !prev);
          }
        },
      }),
    []
  );

  const showPlannerToast = useCallback((text: string) => {
    setPlannerToast(text);
    setTimeout(() => setPlannerToast(""), 3500);
  }, []);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || loading || initializing) return;
    setInput("");
    setInputHeight(44);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    const parsedRange = extractDateRangeFromText(text);
    const mealIntent = textImpliesMealPlanRequest(text);
    const shouldRunMealPlan = !!parsedRange && (mealIntent || mealPlannerOpen);

    if (shouldRunMealPlan) {
      if (generatingMealPlan) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Mình đang tạo thực đơn, bạn đợi vài giây rồi thử lại nhé.",
          },
        ]);
        return;
      }

      if (!mealPlannerOpen && mealIntent) {
        setMealPlannerOpen(true);
        Animated.timing(mealPlanFade, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }

      const mealKeys = extractMealKeysFromText(text);
      setPlannerMealKeys(mealKeys);
      setGeneratingMealPlan(true);
      try {
        const userId = resolveUserId();
        const res = await generateMealPlanByDateRange(
          parsedRange!.start,
          parsedRange!.end,
          mealKeys,
          {
            user_id: userId,
            session_id: sessionId ?? undefined,
          }
        );
        if (res.session_id) {
          setSessionId(res.session_id);
          setLastChatSessionId(res.session_id);
        }
        if (!res.plan.length) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Mình chưa tạo được thực đơn hợp lệ từ thông tin này. Bạn thử nhập lại rõ hơn nhé.",
            },
          ]);
          return;
        }
        setMealPlanDays(
          res.plan.map((day) => ({
            date: day.date,
            meals: {
              breakfast: day.meals.breakfast || "",
              lunch: day.meals.lunch || "",
              dinner: day.meals.dinner || "",
            },
          }))
        );
        Animated.timing(mealPlanFade, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
        showPlannerToast("Đã tạo thực đơn từ nội dung bạn vừa nhập.");
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: `Đã gợi ý thực đơn từ ${parsedRange!.start} đến ${parsedRange!.end}. Bạn xem khung «Thực đơn» phía trên, chỉnh sửa rồi bấm áp dụng.`,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Không thể tạo thực đơn lúc này. Bạn kiểm tra mạng / Chatbot rồi thử lại.",
          },
        ]);
      } finally {
        setGeneratingMealPlan(false);
      }
      return;
    }

    if (mealPlannerOpen) {
      const looksLikeIncompleteDateRange = hasDateToken(text) && hasRangeKeyword(text) && !parsedRange;
      if (looksLikeIncompleteDateRange) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content:
              "Mình hiểu bạn đang nhập khoảng ngày. Bạn nhập theo mẫu: 26/03 tới 29/03, bữa sáng + trưa (tối đa 7 ngày).",
          },
        ]);
        return;
      }
    }

    setLoading(true);
    try {
      const userId = resolveUserId();
      const res = await sendChatMessage(text, {
        user_id: userId,
        session_id: sessionId ?? undefined,
      });
      const replyText = normalizeAssistantReply(res.reply);
      if (res.session_id) {
        setSessionId(res.session_id);
        setLastChatSessionId(res.session_id);
      }
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: "assistant", content: replyText },
      ]);
      if (userId) {
        const sessions = await getChatSessions(userId);
        setSessionList(normalizeSessionList(sessions));
      }
    } catch (_e) {
      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "Không thể kết nối trợ lý. Bạn kiểm tra Chatbot Service (port 8000) và thử lại.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, initializing, sessionId, resolveUserId, mealPlannerOpen, generatingMealPlan, mealPlanFade, showPlannerToast]);

  const isSendDisabled = loading || initializing || !input.trim();

  /** Gửi tin nhắn từ gợi ý (chips) */
  const sendMessage = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || loading || initializing) return;
      setInputHeight(44);
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: t,
      };
      setMessages((prev) => [...prev, userMsg]);
      setLoading(true);
      try {
        const userId = resolveUserId();
        const res = await sendChatMessage(t, {
          user_id: userId,
          session_id: sessionId ?? undefined,
        });
        const replyText = normalizeAssistantReply(res.reply);
        if (res.session_id) {
          setSessionId(res.session_id);
          setLastChatSessionId(res.session_id);
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", content: replyText },
        ]);
        if (userId) {
          const sessions = await getChatSessions(userId);
          setSessionList(normalizeSessionList(sessions));
        }
      } catch (_e) {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Không thể kết nối trợ lý. Bạn kiểm tra Chatbot Service (port 8000) và thử lại.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, initializing, sessionId, resolveUserId]
  );

  const openMealPlanner = useCallback(() => {
    setMealPlannerOpen(true);
    setPlannerMealKeys(DEFAULT_MEALS);
    Animated.timing(mealPlanFade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [mealPlanFade]);

  const handleGenerateMealPlan = useCallback(
    async (startDate: string, endDate: string, mealKeys: MealKey[] = DEFAULT_MEALS) => {
      if (generatingMealPlan || loading || initializing) return;
      setPlannerMealKeys(mealKeys);
      setGeneratingMealPlan(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `u-${Date.now()}`,
          role: "user",
          content: `Tạo thực đơn từ ${startDate} đến ${endDate} (${mealKeys.join(", ")})`,
        },
      ]);
      try {
        const userId = resolveUserId();
        const res = await generateMealPlanByDateRange(
          startDate,
          endDate,
          mealKeys,
          {
            user_id: userId,
            session_id: sessionId ?? undefined,
          }
        );
        if (res.session_id) {
          setSessionId(res.session_id);
          setLastChatSessionId(res.session_id);
        }
        if (!res.plan.length) {
          setMessages((prev) => [
            ...prev,
            {
              id: `a-${Date.now()}`,
              role: "assistant",
              content: "Mình chưa parse được thực đơn. Bạn thử lại hoặc đổi khoảng ngày khác nhé.",
            },
          ]);
          return;
        }
        setMealPlanDays(
          res.plan.map((day) => ({
            date: day.date,
            meals: {
              breakfast: day.meals.breakfast || "",
              lunch: day.meals.lunch || "",
              dinner: day.meals.dinner || "",
            },
          }))
        );
        Animated.timing(mealPlanFade, {
          toValue: 1,
          duration: 280,
          useNativeDriver: true,
        }).start();
        const template: MealPlanTemplate = {
          id: `tpl-${Date.now()}`,
          name: `Thực đơn ${startDate} - ${endDate}`,
          created_at: new Date().toISOString(),
          days: res.plan,
        };
        saveMealPlanTemplate(template as ApiMealPlanTemplate);
        setTemplates((prev) => [template, ...prev].slice(0, 5));
        showPlannerToast("Đã tạo thực đơn. Bạn có thể sửa rồi áp dụng.");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Không thể tạo thực đơn lúc này. Bạn thử lại sau ít phút.",
          },
        ]);
      } finally {
        setGeneratingMealPlan(false);
      }
    },
    [generatingMealPlan, loading, initializing, resolveUserId, sessionId, mealPlanFade, showPlannerToast]
  );

  const handleChangeMeal = useCallback((date: string, mealKey: keyof MealPlanMeals, value: string) => {
    setMealPlanDays((prev) =>
      prev.map((item) => (item.date === date ? { ...item, meals: { ...item.meals, [mealKey]: value } } : item))
    );
  }, []);

  const askOverwriteDecision = useCallback(async (date: string): Promise<"overwrite" | "skip" | "cancel"> => {
    const msg = `Ngày ${date} đã có lịch ăn. Bạn muốn ghi đè hay bỏ qua?`;
    if (Platform.OS === "web") {
      const raw =
        typeof window !== "undefined"
          ? window.prompt(`${msg}\nNhập: overwrite | skip | cancel`, "skip")
          : "cancel";
      const decision = String(raw || "cancel").trim().toLowerCase();
      if (decision === "overwrite") return "overwrite";
      if (decision === "skip") return "skip";
      return "cancel";
    }
    return new Promise((resolve) => {
      Alert.alert("Xác nhận áp dụng", msg, [
        { text: "Hủy", style: "cancel", onPress: () => resolve("cancel") },
        { text: "Bỏ qua", onPress: () => resolve("skip") },
        { text: "Ghi đè", style: "destructive", onPress: () => resolve("overwrite") },
      ]);
    });
  }, []);

  const confirmApply = useCallback(async (message: string): Promise<boolean> => {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? window.confirm(message) : true;
    }
    return new Promise((resolve) => {
      Alert.alert("Xác nhận", message, [
        { text: "Hủy", style: "cancel", onPress: () => resolve(false) },
        { text: "Đồng ý", onPress: () => resolve(true) },
      ]);
    });
  }, []);

  const applyMealsOfDay = useCallback(
    async (dayItem: MealPlanDay): Promise<"applied" | "skipped" | "cancelled" | "nothing_to_apply"> => {
      const now = dayjs();
      const applicableKeys = getApplicableMealKeys(dayItem, now);
      if (!applicableKeys.length) {
        return "nothing_to_apply";
      }

      const dayKey = toDayKey(dayItem.date);
      const rows = await getDailySchedules();
      const startTimesToMatch = applicableKeys.map((k) => MEAL_TIMES[k].start.slice(0, 5));
      const conflicts = rows.filter(
        (row) =>
          row.day_of_week === dayKey &&
          row.type === "meal" &&
          startTimesToMatch.includes(String(row.start_time || "").slice(0, 5))
      );

      let action: "overwrite" | "skip" | "cancel" = "overwrite";
      if (conflicts.length) {
        action = await askOverwriteDecision(dayItem.date);
      }
      if (action === "cancel") return "cancelled";
      if (action === "skip") return "skipped";

      if (action === "overwrite" && conflicts.length) {
        for (const item of conflicts) {
          await deleteDailySchedule(item.id);
        }
      }

      const payloads = applicableKeys.map((mealKey) => {
        const mealName = String(dayItem.meals[mealKey] || "").trim();
        const map = MEAL_TIMES[mealKey];
        return {
          day_of_week: dayKey,
          title: mealName,
          description: map.label,
          start_time: map.start,
          end_time: map.end,
          type: "meal" as const,
        };
      });

      for (const payload of payloads) {
        await createDailySchedule(payload as any);
      }
      return "applied";
    },
    [askOverwriteDecision]
  );

  const handleApplyDay = useCallback(
    async (date: string) => {
      const target = mealPlanDays.find((item) => item.date === date);
      if (!target) return;
      const now = dayjs();
      const applicable = getApplicableMealKeys(target, now);
      if (!applicable.length) {
        const hasAnyText = (["breakfast", "lunch", "dinner"] as MealKey[]).some(
          (k) => String(target.meals[k] || "").trim().length > 0
        );
        const msg = hasAnyText
          ? "Các bữa trong ngày này đã qua khung giờ áp dụng (sáng/trưa/tối). Bạn chỉ có thể áp dụng các bữa chưa hết giờ."
          : "Chưa có món nào để áp dụng. Hãy nhập ít nhất một bữa còn trong khung giờ.";
        if (Platform.OS === "web") {
          typeof window !== "undefined" && window.alert(msg);
        } else {
          Alert.alert("Không thể áp dụng", msg);
        }
        return;
      }

      const skippedByTime = (["breakfast", "lunch", "dinner"] as MealKey[]).filter((k) => {
        const text = String(target.meals[k] || "").trim();
        if (!text) return false;
        return !applicable.includes(k);
      });
      let confirmMsg = `Áp dụng thực đơn ngày ${date} vào lịch sinh hoạt?`;
      if (skippedByTime.length) {
        confirmMsg += `\n\nChỉ áp dụng: ${applicable.map((k) => MEAL_APPLY_LABEL_VI[k]).join(", ")}. Các bữa đã qua giờ sẽ bỏ qua.`;
      }
      const confirmed = await confirmApply(confirmMsg);
      if (!confirmed) return;
      setApplyingByDate((prev) => ({ ...prev, [date]: true }));
      try {
        const result = await applyMealsOfDay(target);
        if (result === "applied") {
          const msg = `Đã áp dụng thực đơn ngày ${date}`;
          showPlannerToast(msg);
          if (Platform.OS !== "web") {
            Alert.alert("Đã áp dụng thành công", msg);
          }
          emitScheduleRefresh();
        } else if (result === "skipped") {
          showPlannerToast(`Đã bỏ qua ngày ${date}`);
        } else if (result === "nothing_to_apply") {
          showPlannerToast("Không còn bữa nào có thể áp dụng (đã qua giờ).");
        }
      } catch {
        showPlannerToast("Áp dụng thất bại. Bạn thử lại nhé.");
      } finally {
        setApplyingByDate((prev) => ({ ...prev, [date]: false }));
      }
    },
    [mealPlanDays, applyMealsOfDay, showPlannerToast, confirmApply]
  );

  const handleApplyAll = useCallback(async () => {
    if (!mealPlanDays.length) return;
    const confirmed = await confirmApply("Áp dụng toàn bộ thực đơn vào lịch sinh hoạt?");
    if (!confirmed) return;
    setApplyingAll(true);
    let appliedCount = 0;
    try {
      for (const dayItem of mealPlanDays) {
        const result = await applyMealsOfDay(dayItem);
        if (result === "cancelled") break;
        if (result === "applied") appliedCount += 1;
        // nothing_to_apply: bỏ qua ngày đó (đã qua giờ / không có món hợp lệ)
      }
      emitScheduleRefresh();
      const msg = `Hoàn tất áp dụng ${appliedCount}/${mealPlanDays.length} ngày.`;
      showPlannerToast(msg);
      if (Platform.OS !== "web") {
        Alert.alert("Đã áp dụng thành công", msg);
      }
    } catch {
      showPlannerToast("Áp dụng toàn bộ thất bại.");
    } finally {
      setApplyingAll(false);
    }
  }, [mealPlanDays, applyMealsOfDay, showPlannerToast, confirmApply]);

  const handleUseTemplate = useCallback((template: MealPlanTemplate) => {
    setMealPlannerOpen(true);
    setMealPlanDays(template.days);
    Animated.timing(mealPlanFade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    showPlannerToast(`Đã nạp template: ${template.name}`);
  }, [mealPlanFade, showPlannerToast]);

  const handleStartNewSession = useCallback(async () => {
    setSessionId(null);
    setLastChatSessionId(null);
    setMessages([INITIAL_MESSAGE]);
    setMealPlannerOpen(false);
    setPlannerMealKeys(DEFAULT_MEALS);
    setMealPlanDays([]);
    mealPlanFade.setValue(0);
  }, [mealPlanFade]);

  const loadLatestSession = useCallback(async () => {
    const userId = resolveUserId();
    setInitializing(true);
    try {
      const rememberedSessionId = getLastChatSessionId();
      if (rememberedSessionId) {
        setSessionId(rememberedSessionId);
        const rememberedRows = await getChatSessionMessages(rememberedSessionId, userId);
        if (rememberedRows.length) {
          setMessages(
            rememberedRows.map((m, idx) => ({
              id: String(m.id ?? `${m.role}-${idx}`),
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }))
          );
          return;
        }
      }

      const sessions = await getChatSessions(userId);
      setSessionList(normalizeSessionList(sessions));
      if (!sessions.length) {
        setSessionId(null);
        setLastChatSessionId(null);
        setMessages([INITIAL_MESSAGE]);
        return;
      }
      const sid = Number(sessions[0].id);
      setSessionId(sid);
      setLastChatSessionId(sid);
      const rows = await getChatSessionMessages(sid, userId);
      if (!rows.length) {
        setMessages([INITIAL_MESSAGE]);
      } else {
        setMessages(
          rows.map((m, idx) => ({
            id: String(m.id ?? `${m.role}-${idx}`),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          }))
        );
      }
    } catch {
      setSessionId(null);
      setMessages([INITIAL_MESSAGE]);
    } finally {
      setInitializing(false);
    }
  }, [resolveUserId]);

  const handleSelectSession = useCallback(
    async (sid: number) => {
      const userId = resolveUserId();
      setLoading(true);
      try {
        setSessionId(sid);
        setLastChatSessionId(sid);
        const rows = await getChatSessionMessages(sid, userId);
        if (!rows.length) {
          setMessages([INITIAL_MESSAGE]);
          return;
        }
        setMessages(
          rows.map((m, idx) => ({
            id: String(m.id ?? `${m.role}-${idx}`),
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          }))
        );
      } finally {
        setLoading(false);
      }
    },
    [resolveUserId]
  );

  const doDeleteSession = useCallback(
    async (sid: number) => {
      const userId = resolveUserId();
      setLoading(true);
      try {
        await deleteChatSession(sid, userId);
        const sessions = await getChatSessions(userId);
        setSessionList(normalizeSessionList(sessions));

        if (sessionId === sid) {
          if (sessions.length > 0) {
            const nextId = Number(sessions[0].id);
            setSessionId(nextId);
            setLastChatSessionId(nextId);
            const rows = await getChatSessionMessages(nextId, userId);
            if (!rows.length) {
              setMessages([INITIAL_MESSAGE]);
            } else {
              setMessages(
                rows.map((m, idx) => ({
                  id: String(m.id ?? `${m.role}-${idx}`),
                  role: m.role === "user" ? "user" : "assistant",
                  content: m.content,
                }))
              );
            }
          } else {
            setSessionId(null);
            setLastChatSessionId(null);
            setMessages([INITIAL_MESSAGE]);
          }
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Không thể xóa phiên chat. Bạn thử lại nhé.",
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [resolveUserId, sessionId]
  );

  const handleDeleteSession = useCallback(
    (sid: number) => {
      if (Platform.OS === "web") {
        const confirmed =
          typeof window !== "undefined"
            ? window.confirm("Bạn có chắc muốn xóa phiên chat này không?")
            : true;
        if (confirmed) void doDeleteSession(sid);
        return;
      }
      setSessionIdToDelete(sid);
    },
    [doDeleteSession]
  );

  useEffect(() => {
    if (chatOpen) {
      loadLatestSession();
    }
  }, [chatOpen, loadLatestSession]);

  if (permissionLoading || !canUseChatbot) {
    return null;
  }

  return (
    <>
      {/* Nút trợ lý ảo trôi nổi — thiết kế mới */}
      {!chatOpen && (
        <Animated.View
          style={[
            styles.botContainer,
            { transform: animatedPos.getTranslateTransform() },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.botShadow}>
            <View style={styles.botCircle}>
              <View style={styles.botInnerCircle}>
                <ChatbotLogo size={36} color="#FFFFFF" />
              </View>
            </View>
          </View>
        </Animated.View>
      )}

      {chatOpen && (
        <View
          style={[
            styles.overlay,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 16,
              paddingLeft: Math.max(8, insets.left),
              paddingRight: Math.max(8, insets.right),
            },
          ]}
        >
          <KeyboardAvoidingView
            style={styles.keyboardAvoid}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 50 : 0}
          >
            <View
              style={[
                styles.chatCard,
                {
                  width: Math.min(width * 0.92, 520),
                  height: Math.min((height - insets.top - insets.bottom) * 0.8, 760),
                },
              ]}
            >
              {/* Header hiện đại */}
              <View style={styles.chatHeader}>
                <View style={styles.chatHeaderLeft}>
                  <View style={styles.avatarSmall}>
                    <ChatbotLogo size={28} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.chatTitle}>Bé Bụt</Text>
                    <View style={styles.chatStatusRow}>
                      <View style={styles.statusDot} />
                      <Text style={styles.statusText}>Online</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.headerActions}>
                  <TouchableOpacity
                    style={styles.headerMealBtn}
                    onPress={openMealPlanner}
                    disabled={loading || initializing || generatingMealPlan}
                  >
                    <Text style={styles.headerMealBtnText}>Thực đơn</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.headerBtn}
                    onPress={handleStartNewSession}
                    disabled={loading || initializing}
                  >
                    <Text style={styles.headerBtnText}>Phiên mới</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.closeBtn}
                    onPress={() => setChatOpen(false)}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Text style={styles.closeText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {sessionList.length > 0 && (
                <ScrollView
                  horizontal
                  style={styles.sessionListWrap}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sessionList}
                >
                  {sessionList.map((s) => {
                    const sid = Number(s.id) || 0;
                    const sessionTitle =
                      (typeof s.title === "string" && s.title.trim()) || `Phiên #${sid || "?"}`;
                    return (
                      <View
                        key={String(sid)}
                        style={[
                          styles.sessionChip,
                          sessionId === sid && styles.sessionChipActive,
                        ]}
                      >
                        <TouchableOpacity
                          style={styles.sessionMainBtn}
                          onPress={() => handleSelectSession(sid)}
                          disabled={loading || initializing}
                        >
                          <Text
                            style={[
                              styles.sessionChipText,
                              sessionId === sid && styles.sessionChipTextActive,
                            ]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {sessionTitle || "Phiên chat"}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.sessionDeleteBtn}
                          onPress={() => void handleDeleteSession(sid)}
                          disabled={loading || initializing}
                        >
                          <Text style={styles.sessionDeleteText}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}

              <View style={styles.chatBodyWrap}>
                <ScrollView
                  ref={scrollRef}
                  style={styles.chatBody}
                  contentContainerStyle={styles.chatBodyContent}
                  onContentSizeChange={() =>
                    scrollRef.current?.scrollToEnd({ animated: true })
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <View style={styles.quickActionRow}>
                    <TouchableOpacity
                      style={styles.quickMealBtn}
                      onPress={openMealPlanner}
                      disabled={loading || initializing || generatingMealPlan}
                    >
                      <Text style={styles.quickMealBtnText}>🍽️ Gợi ý thực đơn theo ngày</Text>
                    </TouchableOpacity>
                  </View>

                  {mealPlannerOpen && (
                    <Animated.View style={[styles.mealPlannerWrap, { opacity: mealPlanFade }]}>
                      <DateRangePicker disabled={generatingMealPlan || applyingAll} onGenerate={handleGenerateMealPlan} />

                      {templates.length > 0 && (
                        <View style={styles.templateWrap}>
                          <Text style={styles.templateTitle}>Template đã lưu</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templateList}>
                            {templates.map((tpl) => (
                              <TouchableOpacity key={tpl.id} style={styles.templateChip} onPress={() => handleUseTemplate(tpl)}>
                                <Text style={styles.templateChipText} numberOfLines={1}>
                                  {tpl.name}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}

                      {generatingMealPlan && (
                        <View style={styles.generatingWrap}>
                          <ActivityIndicator size="small" color={COLORS.primary} />
                          <Text style={styles.generatingText}>Đang tạo thực đơn...</Text>
                        </View>
                      )}

                      {mealPlanDays.map((dayItem) => {
                        const now = dayjs();
                        const applicable = getApplicableMealKeys(dayItem, now);
                        const mealPassed = {
                          breakfast: isMealApplyWindowPassed(dayItem.date, "breakfast", now),
                          lunch: isMealApplyWindowPassed(dayItem.date, "lunch", now),
                          dinner: isMealApplyWindowPassed(dayItem.date, "dinner", now),
                        };
                        return (
                          <MealPlanCard
                            key={dayItem.date}
                            date={dayItem.date}
                            meals={dayItem.meals}
                            disabled={applyingAll}
                            applying={!!applyingByDate[dayItem.date]}
                            canApplyDay={applicable.length > 0}
                            mealPassed={mealPassed}
                            onChangeMeal={(mealKey, value) => handleChangeMeal(dayItem.date, mealKey, value)}
                            onApplyDay={() => void handleApplyDay(dayItem.date)}
                          />
                        );
                      })}

                      {!!mealPlanDays.length && (
                        <ApplyMealPlanButton
                          loading={applyingAll}
                          disabled={
                            !mealPlanDays.some((d) => getApplicableMealKeys(d, dayjs()).length > 0)
                          }
                          onPress={() => void handleApplyAll()}
                        />
                      )}
                      {!!plannerToast && <Text style={styles.plannerToast}>{plannerToast}</Text>}
                    </Animated.View>
                  )}

                  {messages.map((msg) =>
                    msg.role === "assistant" ? (
                      <View key={msg.id} style={styles.messageRowLeft}>
                        <View style={styles.messageBubbleLeft}>
                          <MessageContent
                            content={msg.content}
                            style={{
                              section: styles.assistantSectionHeader,
                              paragraph: styles.assistantParagraph,
                              text: styles.messageTextLeft,
                            }}
                          />
                        </View>
                      </View>
                    ) : (
                      <View key={msg.id} style={styles.messageRowRight}>
                        <View style={styles.messageBubbleRight}>
                          <UserMessageBubbleBody content={msg.content} />
                        </View>
                      </View>
                    )
                  )}

                  {/* Gợi ý tin nhắn khi mới vào — chỉ hiện khi mới bắt đầu (chỉ có tin welcome) */}
                  {messages.length === 1 && !loading && !initializing && (
                    <View style={styles.suggestionsBlock}>
                      <Text style={styles.suggestionsTitle}>Bạn có thể hỏi nhanh:</Text>
                      <View style={styles.suggestionsGrid}>
                        {MESSAGE_SUGGESTIONS.map((s) => (
                          <TouchableOpacity
                            key={s.id}
                            style={[styles.suggestionChip, { backgroundColor: s.color + "22" }]}
                            onPress={() => {
                              if (s.id === "1") {
                                openMealPlanner();
                                return;
                              }
                              void sendMessage(s.prompt);
                            }}
                            activeOpacity={0.8}
                            disabled={loading}
                          >
                            <Text style={styles.suggestionIcon}>{s.icon}</Text>
                            <Text style={[styles.suggestionLabel, { color: s.color }]} numberOfLines={2}>
                              {s.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                  {loading && (
                    <View style={styles.messageRowLeft}>
                      <View style={[styles.messageBubbleLeft, { flexDirection: "row", alignItems: "center" }]}>
                        <ActivityIndicator size="small" color={COLORS.primary} />
                        <Text style={styles.loadingText}>Đang trả lời...</Text>
                      </View>
                    </View>
                  )}
                  {initializing && (
                    <View style={styles.messageRowLeft}>
                      <View style={styles.messageBubbleLeft}>
                        <Text style={styles.messageTextLeft}>Đang tải lịch sử phiên chat...</Text>
                      </View>
                    </View>
                  )}
                </ScrollView>
              </View>

              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { height: inputHeight }]}
                  placeholder="Nhập tin nhắn..."
                  placeholderTextColor={COLORS.textMuted}
                  value={input}
                  onChangeText={setInput}
                  multiline
                  textAlignVertical="top"
                  onContentSizeChange={(e) => {
                    const next = Math.max(44, Math.min(110, e.nativeEvent.contentSize.height + 14));
                    setInputHeight(next);
                  }}
                  editable={!loading}
                  blurOnSubmit={false}
                  returnKeyType="send"
                  onSubmitEditing={() => {
                    if (!Platform.OS || Platform.OS !== "ios") {
                      void handleSend();
                    }
                  }}
                  onKeyPress={(e: any) => {
                    const key = e?.nativeEvent?.key;
                    const shift = e?.nativeEvent?.shiftKey;
                    if (key === "Enter" && !shift) {
                      e?.preventDefault?.();
                      void handleSend();
                    }
                  }}
                />
                <TouchableOpacity
                  style={[styles.sendButton, isSendDisabled && styles.sendButtonDisabled]}
                  onPress={handleSend}
                  disabled={isSendDisabled}
                  activeOpacity={0.8}
                >
                  <Text style={styles.sendIcon}>➤</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Modal xác nhận xóa phiên chat — giao diện trong app, không dùng thông báo hệ thống */}
      <Modal
        visible={sessionIdToDelete !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSessionIdToDelete(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSessionIdToDelete(null)}
        >
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xóa phiên chat</Text>
            <Text style={styles.modalMessage}>
              Bạn có chắc muốn xóa phiên chat này không?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalBtnCancel}
                onPress={() => setSessionIdToDelete(null)}
              >
                <Text style={styles.modalBtnCancelText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalBtnDelete}
                onPress={() => {
                  if (sessionIdToDelete !== null) {
                    doDeleteSession(sessionIdToDelete);
                    setSessionIdToDelete(null);
                  }
                }}
              >
                <Text style={styles.modalBtnDeleteText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default FloatingAssistant;

const styles = StyleSheet.create({
  botContainer: {
    position: "absolute",
    zIndex: 50,
  },
  botShadow: {
    shadowColor: COLORS.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  botCircle: {
    width: BOT_SIZE,
    height: BOT_SIZE,
    borderRadius: BOT_SIZE / 2,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.primarySoft,
  },
  botInnerCircle: {
    width: BOT_SIZE - 12,
    height: BOT_SIZE - 12,
    borderRadius: (BOT_SIZE - 12) / 2,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  keyboardAvoid: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  chatCard: {
    width: "80%",
    height: "80%",
    maxWidth: 440,
    minWidth: 300,
    minHeight: 460,
    maxHeight: "90%",
    alignSelf: "center",
    marginHorizontal: 0,

    borderRadius: 28,
    backgroundColor: COLORS.card,

    overflow: "hidden",

    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },

    elevation: 6,
  },
  chatHeader: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  chatHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  chatTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  chatStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
    marginRight: 6,
  },
  statusText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerMealBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#10B981",
  },
  headerMealBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  headerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  headerBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  chatBodyWrap: {
    flex: 1,
    minHeight: 0,
  },
  chatBody: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  sessionListWrap: {
    maxHeight: 68,
    backgroundColor: COLORS.card,
  },
  sessionList: {
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 8,
  },
  sessionChip: {
    minWidth: 150,
    maxWidth: 220,
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  sessionMainBtn: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  sessionDeleteBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.border,
  },
  sessionDeleteText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  sessionChipActive: {
    backgroundColor: COLORS.primarySoft,
  },
  sessionChipText: {
    fontSize: 13,
    color: COLORS.textPrimary,
  },
  sessionChipTextActive: {
    color: COLORS.primary,
    fontWeight: "700",
  },
  chatBodyContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 20,
    flexGrow: 1,
    width: "100%",
  },
  quickActionRow: {
    marginBottom: 10,
  },
  quickMealBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#EDE9FE",
    borderColor: "#C4B5FD",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickMealBtnText: {
    color: "#5B21B6",
    fontWeight: "700",
    fontSize: 12,
  },
  mealPlannerWrap: {
    marginBottom: 14,
  },
  templateWrap: {
    marginTop: 10,
  },
  templateTitle: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  templateList: {
    gap: 8,
  },
  templateChip: {
    maxWidth: 220,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: "#EEF2FF",
    borderColor: "#C7D2FE",
    borderWidth: 1,
  },
  templateChipText: {
    color: "#3730A3",
    fontSize: 12,
    fontWeight: "600",
  },
  generatingWrap: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  generatingText: {
    marginLeft: 8,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  plannerToast: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#DCFCE7",
    color: "#166534",
    fontSize: 12,
    fontWeight: "700",
  },
  suggestionsBlock: {
    marginTop: 8,
    marginBottom: 16,
  },
  suggestionsTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  suggestionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  suggestionChip: {
    width: "48%",
    minWidth: 0,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "transparent",
  },
  suggestionIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  suggestionLabel: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  messageRowLeft: {
    alignItems: "flex-start",
    marginBottom: 12,
    width: "100%",
  },
  messageRowRight: {
    alignItems: "flex-end",
    marginBottom: 12,
    width: "100%",
  },
  messageBubbleLeft: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    width: "92%",
    backgroundColor: COLORS.bubbleAssistant,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  messageBubbleRight: {
    maxWidth: "92%",
    backgroundColor: COLORS.bubbleUser,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  messageTextLeft: {
    color: COLORS.textPrimary,
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  messageTextRight: {
    color: "#FFFFFF",
    fontSize: 14,
    lineHeight: 22,
    flexShrink: 1,
  },
  assistantSectionHeader: {
    fontWeight: "700",
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 10,
    marginBottom: 4,
  },
  assistantParagraph: {
    marginBottom: 6,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    marginRight: 10,
    color: COLORS.textPrimary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.textPrimary,
    marginBottom: 10,
  },
  modalMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    justifyContent: "flex-end",
  },
  modalBtnCancel: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  modalBtnCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  modalBtnDelete: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: "#DC2626",
  },
  modalBtnDeleteText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});

