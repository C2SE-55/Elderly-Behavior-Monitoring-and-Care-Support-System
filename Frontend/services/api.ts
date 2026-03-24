import axios from "axios";
import Constants from "expo-constants";

const getApiBaseUrl = () => {
  // Nếu cấu hình trong app.json / app.config.ts có extra.apiUrl thì ưu tiên dùng
  // (phù hợp cho môi trường production)
  // @ts-ignore
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (extraApiUrl) {
    return extraApiUrl;
  }

  // Trong môi trường phát triển với Expo, lấy host của Metro bundler
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(":")[0];
    return `http://${host}:5000`;
  }

  // Fallback: localhost (chạy web hoặc simulator)
  return "http://localhost:5000";
};

export const API_BASE_URL = getApiBaseUrl();

/** Base URL cho Chatbot Service (Trợ lý ảo, meal plan) - cùng host, port 8000 */
const getChatbotBaseUrl = () => {
  try {
    const base = getApiBaseUrl();
    const url = new URL(base);
    url.port = "8000";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:8000";
  }
};

export const CHATBOT_BASE_URL = getChatbotBaseUrl();

/** Base URL cho Camera Service (AI stream + fall detection) - port 9000 */
const getCameraServiceBaseUrl = () => {
  try {
    const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
    if (extra?.cameraServiceUrl) return extra.cameraServiceUrl.replace(/\/$/, "");
    const base = getApiBaseUrl();
    const url = new URL(base);
    url.port = "9000";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:9000";
  }
};

export const CAMERA_SERVICE_BASE_URL = getCameraServiceBaseUrl();

/** URL stream MJPEG (video đã qua model té ngã, quét liên tục) */
export const CAMERA_STREAM_URL = `${CAMERA_SERVICE_BASE_URL}/stream`;

/** Lấy trạng thái fall detection (fallcount, fps) */
export const getCameraStatus = async (): Promise<{
  fallcount: number;
  fps: number;
  ready: boolean;
}> => {
  const { data } = await axios.get(`${CAMERA_SERVICE_BASE_URL}/api/status`, {
    timeout: 5000,
  });
  return data;
};

export type CameraHistoryEvent = {
  id: number;
  camera_id?: number | null;
  image_url?: string | null;
  image_full_url?: string | null;
  severity_level?: string | null;
  created_at?: string | null;
  source_type?: string | null;
  title?: string | null;
};

export const getCameraEventHistory = async (limit = 20): Promise<CameraHistoryEvent[]> => {
  const { data } = await api.get("/fall-events/history", {
    params: { limit },
    timeout: 5000,
  });

  const raw = data?.data?.data ?? data?.data ?? [];
  if (!Array.isArray(raw)) return [];

  return raw.map((item: Record<string, unknown>) => ({
    id: Number(item?.id ?? 0),
    camera_id: item?.camera_id as number | null | undefined,
    image_url: item?.image_url as string | null | undefined,
    image_full_url: item?.image_full_url as string | null | undefined,
    severity_level: item?.severity_level as string | null | undefined,
    created_at: item?.created_at as string | null | undefined,
    source_type: item?.source_type as string | null | undefined,
    title: item?.title as string | null | undefined,
  })).filter((item) => item.id > 0);
};

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

let currentToken: string | null = null;
let currentUser: any | null = null;

export const setAuth = (token: string | null, user?: any) => {
  currentToken = token;
  if (user !== undefined) {
    currentUser = user;
  }

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
};

export const getCurrentUser = () => currentUser;

/** Header Authorization để gửi request upload (fetch) — không set Content-Type để browser tự thêm boundary */
export const getAuthHeaders = (): Record<string, string> => {
  const token = api.defaults.headers.common?.Authorization;
  if (token && typeof token === "string") return { Authorization: token };
  return {};
};
let lastChatSessionId: number | null = null;
export const getLastChatSessionId = () => lastChatSessionId;
export const setLastChatSessionId = (sessionId: number | null) => {
  lastChatSessionId = sessionId;
};

export type ChatHistoryMessage = {
  id?: number | string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

export const createChatSession = async (user_id?: number): Promise<number> => {
  const res = await axios.post(
    `${CHATBOT_BASE_URL}/chat/sessions`,
    { user_id: user_id ?? null },
    { timeout: 20000 }
  );
  return Number(res.data?.session_id);
};

export type ChatSessionSummary = {
  id: number;
  started_at: string;
  title?: string;
  message_count?: number;
};

export const getChatSessions = async (user_id?: number): Promise<ChatSessionSummary[]> => {
  if (!user_id) return [];
  const res = await axios.get(`${CHATBOT_BASE_URL}/chat/sessions`, {
    params: { user_id },
    timeout: 20000,
  });
  const raw = res.data?.sessions ?? [];
  if (!Array.isArray(raw)) return [];
  return raw.map((s: Record<string, unknown>) => {
    const id = Number(s?.id ?? s?.ID ?? 0);
    const rawTitle = s?.title ?? s?.Title ?? "";
    const title =
      typeof rawTitle === "string" && rawTitle.trim()
        ? rawTitle.trim()
        : id > 0
          ? `Phiên #${id}`
          : "Phiên chat";
    return {
      id,
      title,
      started_at: (s?.started_at as string) || undefined,
      message_count: Number(s?.message_count ?? 0) || undefined,
    } as ChatSessionSummary;
  }).filter((s) => s.id > 0);
};

export const getChatSessionMessages = async (
  session_id: number,
  user_id?: number
): Promise<ChatHistoryMessage[]> => {
  const res = await axios.get(`${CHATBOT_BASE_URL}/chat/sessions/${session_id}/messages`, {
    params: user_id ? { user_id } : {},
    timeout: 20000,
  });
  return (res.data?.messages ?? []).map((m: any) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    created_at: m.created_at,
  }));
};

export const deleteChatSession = async (session_id: number, user_id?: number): Promise<boolean> => {
  const res = await axios.delete(`${CHATBOT_BASE_URL}/chat/sessions/${session_id}`, {
    params: user_id ? { user_id } : {},
    timeout: 20000,
  });
  return !!res.data?.deleted;
};

/** Gửi tin nhắn tới Trợ lý ảo, gắn với session hiện tại */
export const sendChatMessage = async (
  message: string,
  options?: { user_id?: number; session_id?: number }
): Promise<{ reply: string; session_id: number | null }> => {
  const res = await axios.post(
    `${CHATBOT_BASE_URL}/chat`,
    {
      message,
      user_id: options?.user_id ?? null,
      session_id: options?.session_id ?? null,
    },
    { timeout: 30000 }
  );
  return {
    reply: res.data?.reply ?? "Trợ lý chưa phản hồi.",
    session_id: res.data?.session_id ?? null,
  };
};

export type MedicationReminderStatus = "pending" | "done" | "early";

export type MedicationReminder = {
  id: number;
  user_id: number;
  target_user_id?: number | null;
  medicine_name: string;
  dosage?: string | null;
  note?: string | null;
  reminder_date?: string | null;
  reminder_time: string;
  status: MedicationReminderStatus;
  created_at?: string;
  updated_at?: string;
};

export type MedicationReminderPayload = {
  target_user_id?: number | null;
  medicine_name: string;
  dosage?: string;
  note?: string;
  reminder_date?: string;
  reminder_time: string;
  status?: MedicationReminderStatus;
};

export const getMedicationReminders = async (): Promise<MedicationReminder[]> => {
  const res = await api.get("/medication-reminders");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const createMedicationReminder = async (payload: MedicationReminderPayload): Promise<number | null> => {
  const res = await api.post("/medication-reminders", payload);
  const id = Number(res.data?.data?.id ?? 0);
  return id > 0 ? id : null;
};

export const updateMedicationReminder = async (
  id: number,
  payload: MedicationReminderPayload
): Promise<void> => {
  await api.put(`/medication-reminders/${id}`, payload);
};

export const updateMedicationReminderStatus = async (
  id: number,
  status: MedicationReminderStatus
): Promise<void> => {
  await api.patch(`/medication-reminders/${id}/status`, { status });
};

export const deleteMedicationReminder = async (id: number): Promise<void> => {
  await api.delete(`/medication-reminders/${id}`);
};

