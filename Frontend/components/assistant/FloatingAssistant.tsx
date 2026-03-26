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

/** Render nội dung tin nhắn — tách section để dễ đọc (meal plan, v.v.) */
function MessageContent({ content, style }: { content: string; style: { section: object; paragraph: object; text: object } }) {
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
  if (rawReply && typeof rawReply === "object") {
    const obj = rawReply as Record<string, unknown>;
    const candidates = [obj.reply, obj.message, obj.answer, obj.content];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }
  return "Mình chưa nhận được nội dung phản hồi rõ ràng. Bạn thử gửi lại giúp mình nhé.";
}

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

const MEAL_TIMES: Record<keyof MealPlanMeals, { label: string; start: string; end: string }> = {
  breakfast: { label: "Breakfast", start: "07:00", end: "08:00" },
  lunch: { label: "Lunch", start: "12:00", end: "13:00" },
  dinner: { label: "Dinner", start: "18:00", end: "19:00" },
};

const toDayKey = (isoDate: string): DayKey => {
  const d = dayjs(isoDate).day();
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

    if (mealPlannerOpen) {
      const parsedRange = extractDateRangeFromText(text);
      if (parsedRange) {
        const mealKeys = extractMealKeysFromText(text);
        setPlannerMealKeys(mealKeys);
        if (generatingMealPlan) return;
        setGeneratingMealPlan(true);
        try {
          const userId = resolveUserId();
          const res = await generateMealPlanByDateRange(
            parsedRange.start,
            parsedRange.end,
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
          showPlannerToast("Da tao thuc don tu thong tin ban vua nhap.");
        } finally {
          setGeneratingMealPlan(false);
        }
        return;
      }

      // Chỉ gợi ý lại format khi user đang nhập "khoảng ngày" dở dang.
      // Không chặn các câu hỏi dinh dưỡng có nhắc 1 ngày cụ thể.
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
              content: "Mình chưa parse được thực đơn JSON. Bạn thử lại hoặc đổi khoảng ngày khác nhé.",
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
          name: `Thuc don ${startDate} - ${endDate}`,
          created_at: new Date().toISOString(),
          days: res.plan,
        };
        saveMealPlanTemplate(template as ApiMealPlanTemplate);
        setTemplates((prev) => [template, ...prev].slice(0, 5));
        showPlannerToast("Da tao thuc don. Ban co the sua roi ap dung.");
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: "Khong the tao thuc don luc nay. Ban thu lai sau it phut.",
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
    const msg = `Ngay ${date} da co lich an. Ban muon ghi de hay bo qua?`;
    if (Platform.OS === "web") {
      const raw =
        typeof window !== "undefined"
          ? window.prompt(`${msg}\nNhap: overwrite | skip | cancel`, "skip")
          : "cancel";
      const decision = String(raw || "cancel").trim().toLowerCase();
      if (decision === "overwrite") return "overwrite";
      if (decision === "skip") return "skip";
      return "cancel";
    }
    return new Promise((resolve) => {
      Alert.alert("Xac nhan ap dung", msg, [
        { text: "Huy", style: "cancel", onPress: () => resolve("cancel") },
        { text: "Bo qua", onPress: () => resolve("skip") },
        { text: "Ghi de", style: "destructive", onPress: () => resolve("overwrite") },
      ]);
    });
  }, []);

  const confirmApply = useCallback(async (message: string): Promise<boolean> => {
    if (Platform.OS === "web") {
      return typeof window !== "undefined" ? window.confirm(message) : true;
    }
    return new Promise((resolve) => {
      Alert.alert("Xac nhan", message, [
        { text: "Huy", style: "cancel", onPress: () => resolve(false) },
        { text: "Dong y", onPress: () => resolve(true) },
      ]);
    });
  }, []);

  const applyMealsOfDay = useCallback(
    async (dayItem: MealPlanDay): Promise<"applied" | "skipped" | "cancelled"> => {
      const dayKey = toDayKey(dayItem.date);
      const rows = await getDailySchedules();
      const conflicts = rows.filter(
        (row) =>
          row.day_of_week === dayKey &&
          row.type === "meal" &&
          ["07:00", "12:00", "18:00"].includes(String(row.start_time || "").slice(0, 5))
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

      const payloads = plannerMealKeys
        .map((mealKey) => {
          const mealName = String(dayItem.meals[mealKey] || "").trim();
          if (!mealName) return null;
          const map = MEAL_TIMES[mealKey];
          return {
            day_of_week: dayKey,
            title: mealName,
            description: map.label,
            start_time: map.start,
            end_time: map.end,
            type: "meal" as const,
          };
        })
        .filter(Boolean);

      for (const payload of payloads) {
        await createDailySchedule(payload as any);
      }
      return "applied";
    },
    [askOverwriteDecision, plannerMealKeys]
  );

  const handleApplyDay = useCallback(
    async (date: string) => {
      const target = mealPlanDays.find((item) => item.date === date);
      if (!target) return;
      const confirmed = await confirmApply(`Ap dung thuc don ngay ${date} vao lich sinh hoat?`);
      if (!confirmed) return;
      setApplyingByDate((prev) => ({ ...prev, [date]: true }));
      try {
        const result = await applyMealsOfDay(target);
        if (result === "applied") {
          showPlannerToast(`Da ap dung thuc don ngay ${date}`);
          emitScheduleRefresh();
        } else if (result === "skipped") {
          showPlannerToast(`Da bo qua ngay ${date}`);
        }
      } catch {
        showPlannerToast("Ap dung that bai. Ban thu lai nhe.");
      } finally {
        setApplyingByDate((prev) => ({ ...prev, [date]: false }));
      }
    },
    [mealPlanDays, applyMealsOfDay, showPlannerToast, confirmApply]
  );

  const handleApplyAll = useCallback(async () => {
    if (!mealPlanDays.length) return;
    const confirmed = await confirmApply("Ap dung toan bo thuc don vao lich sinh hoat?");
    if (!confirmed) return;
    setApplyingAll(true);
    let appliedCount = 0;
    try {
      for (const dayItem of mealPlanDays) {
        const result = await applyMealsOfDay(dayItem);
        if (result === "cancelled") break;
        if (result === "applied") appliedCount += 1;
      }
      emitScheduleRefresh();
      showPlannerToast(`Hoan tat ap dung ${appliedCount}/${mealPlanDays.length} ngay.`);
    } catch {
      showPlannerToast("Ap dung toan bo that bai.");
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
    showPlannerToast(`Da nap template: ${template.name}`);
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
                    <Text style={styles.headerMealBtnText}>Thuc don</Text>
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
                      <Text style={styles.quickMealBtnText}>🍽️ Goi y thuc don theo ngay</Text>
                    </TouchableOpacity>
                  </View>

                  {mealPlannerOpen && (
                    <Animated.View style={[styles.mealPlannerWrap, { opacity: mealPlanFade }]}>
                      <DateRangePicker disabled={generatingMealPlan || applyingAll} onGenerate={handleGenerateMealPlan} />

                      {templates.length > 0 && (
                        <View style={styles.templateWrap}>
                          <Text style={styles.templateTitle}>Template da luu</Text>
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
                          <Text style={styles.generatingText}>Dang tao thuc don...</Text>
                        </View>
                      )}

                      {mealPlanDays.map((dayItem) => (
                        <MealPlanCard
                          key={dayItem.date}
                          date={dayItem.date}
                          meals={dayItem.meals}
                          disabled={applyingAll}
                          applying={!!applyingByDate[dayItem.date]}
                          onChangeMeal={(mealKey, value) => handleChangeMeal(dayItem.date, mealKey, value)}
                          onApplyDay={() => void handleApplyDay(dayItem.date)}
                        />
                      ))}

                      {!!mealPlanDays.length && <ApplyMealPlanButton loading={applyingAll} onPress={() => void handleApplyAll()} />}
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
                          <Text style={styles.messageTextRight}>{msg.content}</Text>
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
    shadowOffset: { width: 0, height: 10   },

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
  },
  messageRowRight: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  messageBubbleLeft: {
    maxWidth: "92%",
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

