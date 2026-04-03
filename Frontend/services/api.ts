import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
const API_BASE_URL_NORMALIZED = API_BASE_URL.replace(/\/$/, "");
const API_ROOT = /\/api$/i.test(API_BASE_URL_NORMALIZED)
  ? API_BASE_URL_NORMALIZED
  : `${API_BASE_URL_NORMALIZED}/api`;

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

/** Base URL cho Camera Service (AI stream + fall detection) - port 9001 */
const getCameraServiceBaseUrl = () => {
  try {
    const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
    if (extra?.cameraServiceUrl) return extra.cameraServiceUrl.replace(/\/$/, "");
    const base = getApiBaseUrl();
    const url = new URL(base);
    url.port = "9001";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:9001";
  }
};

export const CAMERA_SERVICE_BASE_URL = getCameraServiceBaseUrl();

/** URL stream MJPEG (video đã qua model té ngã, quét liên tục) */
export const CAMERA_STREAM_URL = `${CAMERA_SERVICE_BASE_URL}/stream`;

export type CameraLiveAccessResponse = {
  allowed: boolean;
  reason?: string | null;
  room_id: number | null;
  asset_key: "video3" | "videofall" | null;
  camera_id: number | null;
};

/** Quyền + khóa video demo theo room (header x-room-id / active room). */
export const getCameraLiveAccess = async (): Promise<CameraLiveAccessResponse | null> => {
  const roomId = getActiveRoomId();
  if (!roomId) return null;
  const res = await api.get("/cameras/live-access", {
    params: { room_id: roomId },
    timeout: 8000,
  });
  return (res.data?.data ?? null) as CameraLiveAccessResponse | null;
};

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
  baseURL: API_ROOT,
  headers: {
    "Content-Type": "application/json",
  },
});

const AUTH_TOKEN_KEY = "ecms_auth_token";
const AUTH_USER_KEY = "ecms_auth_user";
const ACTIVE_ROOM_KEY = "ecms_active_room_id";

const canUseLocalStorage = () => typeof window !== "undefined" && !!window.localStorage;
const canUseAsyncStorage = () => Platform.OS !== "web";

const storageGetItem = async (key: string): Promise<string | null> => {
  if (canUseLocalStorage()) return window.localStorage.getItem(key);
  if (canUseAsyncStorage()) return await AsyncStorage.getItem(key);
  return null;
};

const storageSetItem = async (key: string, value: string): Promise<void> => {
  if (canUseLocalStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }
  if (canUseAsyncStorage()) {
    await AsyncStorage.setItem(key, value);
  }
};

const storageRemoveItem = async (key: string): Promise<void> => {
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(key);
    return;
  }
  if (canUseAsyncStorage()) {
    await AsyncStorage.removeItem(key);
  }
};

const loadStoredAuth = (): { token: string | null; user: any | null } => {
  if (!canUseLocalStorage()) {
    return { token: null, user: null };
  }
  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_KEY);
    const rawUser = window.localStorage.getItem(AUTH_USER_KEY);
    const user = rawUser ? JSON.parse(rawUser) : null;
    return { token: token || null, user };
  } catch {
    return { token: null, user: null };
  }
};

let currentToken: string | null = loadStoredAuth().token;
let currentUser: any | null = loadStoredAuth().user;
let activeRoomId: number | null = (() => {
  if (!canUseLocalStorage()) return null;
  const raw = window.localStorage.getItem(ACTIVE_ROOM_KEY);
  const val = Number(raw || 0);
  return val > 0 ? val : null;
})();
const roomChangeListeners = new Set<(roomId: number | null) => void>();

if (currentToken) {
  api.defaults.headers.common.Authorization = `Bearer ${currentToken}`;
}

if (activeRoomId) {
  api.defaults.headers.common["x-room-id"] = String(activeRoomId);
}

export const setAuth = (token: string | null, user?: any) => {
  currentToken = token;
  if (user !== undefined) {
    currentUser = user;
  }

  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    void storageSetItem(AUTH_TOKEN_KEY, token);
  } else {
    delete api.defaults.headers.common.Authorization;
    void storageRemoveItem(AUTH_TOKEN_KEY);
  }

  if (user !== undefined) {
    if (user) {
      void storageSetItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      void storageRemoveItem(AUTH_USER_KEY);
    }
  }
};

export const setActiveRoomId = (roomId: number | null) => {
  activeRoomId = roomId && roomId > 0 ? roomId : null;
  if (activeRoomId) {
    api.defaults.headers.common["x-room-id"] = String(activeRoomId);
    void storageSetItem(ACTIVE_ROOM_KEY, String(activeRoomId));
  } else {
    delete api.defaults.headers.common["x-room-id"];
    void storageRemoveItem(ACTIVE_ROOM_KEY);
  }
  roomChangeListeners.forEach((listener) => {
    try {
      listener(activeRoomId);
    } catch {
      // ignore listener errors to avoid breaking auth flow
    }
  });
};

/**
 * Hydrate auth + activeRoomId on native (AsyncStorage).
 * On web, existing localStorage sync init already handles this.
 */
export const hydrateAuthFromStorage = async (): Promise<void> => {
  if (canUseLocalStorage()) return;
  try {
    const [token, rawUser, rawRoom] = await Promise.all([
      storageGetItem(AUTH_TOKEN_KEY),
      storageGetItem(AUTH_USER_KEY),
      storageGetItem(ACTIVE_ROOM_KEY),
    ]);
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (token) {
      setAuth(token, user ?? undefined);
    } else if (user) {
      setAuth(null, user);
    }
    const roomVal = Number(rawRoom || 0);
    if (roomVal > 0) {
      setActiveRoomId(roomVal);
    } else if (token) {
      // If user already joined rooms but active room isn't stored yet (common on native),
      // pick the first room as active so downstream services (chatbot) get x-room-id.
      try {
        const rooms = await getMyRooms();
        const firstId = Number(rooms?.[0]?.id || 0);
        if (firstId > 0) {
          setActiveRoomId(firstId);
        }
      } catch {
        // ignore room bootstrap errors
      }
    }
  } catch {
    // ignore hydration errors
  }
};

export const getActiveRoomId = (): number | null => activeRoomId;
export const subscribeActiveRoomChange = (listener: (roomId: number | null) => void) => {
  roomChangeListeners.add(listener);
  return () => {
    roomChangeListeners.delete(listener);
  };
};

export const logoutUser = () => {
  setAuth(null, null);
  setActiveRoomId(null);
  lastChatSessionId = null;
};

export const getCurrentUser = () => currentUser;

export type AuthProfile = {
  id: number;
  username: string;
  email: string;
  fullName?: string;
  phone?: string;
  role: string;
};

export type AdminUserAccount = {
  id: number;
  username: string;
  email: string;
  phone?: string | null;
  fullName?: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  role?: string | null;
};

export const getMyProfile = async (): Promise<AuthProfile> => {
  const res = await api.get("/auth/profile");
  return res.data?.data;
};

export const refreshCurrentUserProfile = async (): Promise<AuthProfile | null> => {
  const token = currentToken;
  if (!token) return null;
  const profile = await getMyProfile();
  const merged = {
    ...(currentUser || {}),
    id: profile.id,
    username: profile.username,
    email: profile.email,
    fullName: profile.fullName,
    phone: profile.phone,
    role: profile.role,
  };
  setAuth(token, merged);
  return profile;
};

export const getAdminUsers = async (keyword?: string): Promise<AdminUserAccount[]> => {
  const endpoint = keyword?.trim() ? "/auth/admin/search" : "/auth/admin/users";
  const res = await api.get(endpoint, {
    params: keyword?.trim() ? { name: keyword.trim() } : {},
  });
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.map((row: Record<string, unknown>) => ({
    id: Number(row?.id || 0),
    username: String(row?.username || ""),
    email: String(row?.email || ""),
    phone: (row?.phone as string) || null,
    fullName: (row?.fullName as string) || null,
    dateOfBirth: (row?.dateOfBirth as string) || null,
    createdAt: (row?.createdAt as string) || undefined,
    role: (row?.role as string) || null,
  }));
};

export const getAdminUserById = async (id: number): Promise<AdminUserAccount | null> => {
  const res = await api.get(`/auth/admin/users/${id}`);
  const row = res.data?.data;
  if (!row) return null;
  return {
    id: Number(row?.id || 0),
    username: String(row?.username || ""),
    email: String(row?.email || ""),
    phone: (row?.phone as string) || null,
    fullName: (row?.full_name as string) || (row?.fullName as string) || null,
    dateOfBirth: (row?.date_of_birth as string) || (row?.dateOfBirth as string) || null,
    createdAt: (row?.created_at as string) || (row?.createdAt as string) || undefined,
    role: (row?.role as string) || null,
  };
};

export const adminDeleteUser = async (id: number): Promise<void> => {
  await api.delete(`/auth/admin/users/${id}`);
};

export const adminCreateUser = async (payload: {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  phone?: string;
  dateOfBirth?: string;
}): Promise<{ id: number; role: string }> => {
  const res = await api.post("/auth/register", payload);
  return res.data?.data;
};

export type RoomMemberRole = "host" | "caretaker";

export type RoomMember = {
  user_id: number;
  username?: string;
  fullName?: string;
  email?: string;
  member_role: RoomMemberRole;
  can_manage_medication: boolean;
  can_receive_schedule_notifications: boolean;
  can_receive_medication_notifications: boolean;
  can_view_live: boolean;
};

export type MyRoomInfo = {
  id: number;
  room_id: string;
  admin_user_id: number;
  host_user_id: number | null;
  host_join_token?: string | null;
  member_role: RoomMemberRole;
  can_manage_medication: boolean;
  can_receive_schedule_notifications: boolean;
  can_receive_medication_notifications: boolean;
  can_view_live?: boolean;
};

export type MyRoomSummary = {
  id: number;
  room_id: string;
  admin_user_id: number;
  host_user_id?: number | null;
  admin_join_token?: string | null;
  host_join_token?: string | null;
  member_role: RoomMemberRole;
  can_manage_medication: boolean;
  can_receive_schedule_notifications: boolean;
  can_receive_medication_notifications: boolean;
  can_view_live?: boolean;
  created_at?: string;
};

export const adminCreateRoom = async (): Promise<{
  id: number;
  room_id: string;
  admin_join_token: string;
  admin_qr_payload: string;
}> => {
  const res = await api.post("/rooms/admin/create");
  return res.data?.data;
};

export type AdminRoomRow = {
  id: number;
  room_id: string;
  admin_user_id: number;
  host_user_id?: number | null;
  admin_join_token?: string | null;
  host_join_token?: string | null;
  admin_qr_payload?: string | null;
  host_qr_payload?: string | null;
  total_members?: number;
  created_at?: string;
};

export const getAdminRooms = async (): Promise<AdminRoomRow[]> => {
  const res = await api.get("/rooms/admin/all");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const adminDeleteRoom = async (roomId: number): Promise<void> => {
  await api.delete(`/rooms/admin/${roomId}`);
};

export const joinRoomByAdminCode = async (roomId: string): Promise<{
  room_id: string;
  role_in_room: "host";
  host_join_token: string;
  host_qr_payload: string;
}> => {
  const res = await api.post("/rooms/join/admin-room", { room_id: roomId });
  return res.data?.data;
};

export const joinRoomByHostQr = async (hostJoinToken: string): Promise<{
  room_id: string;
  role_in_room: "caretaker";
}> => {
  const res = await api.post("/rooms/join/host-qr", { host_join_token: hostJoinToken });
  return res.data?.data;
};

export const getMyRoom = async (): Promise<MyRoomInfo | null> => {
  const roomId = getActiveRoomId();
  const res = await api.get("/rooms/me", {
    params: roomId ? { room_id: roomId } : {},
  });
  return res.data?.data ?? null;
};

export const getMyRooms = async (): Promise<MyRoomSummary[]> => {
  const res = await api.get("/rooms/my-rooms");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const getRoomMembers = async (): Promise<RoomMember[]> => {
  const res = await api.get("/rooms/members");
  const rows = Array.isArray(res.data?.data) ? res.data.data : [];
  return rows.map((row: Record<string, unknown>) => ({
    user_id: Number(row?.user_id ?? row?.userId ?? row?.id ?? (row as any)?.user?.id ?? 0),
    username: ((row?.username as string) || (row as any)?.user?.username) || undefined,
    fullName:
      (row?.fullName as string) ||
      (row?.full_name as string) ||
      (row?.fullname as string) ||
      (row as any)?.user?.fullName ||
      (row as any)?.user?.full_name ||
      (row as any)?.user?.fullname ||
      undefined,
    email: ((row?.email as string) || (row as any)?.user?.email) || undefined,
    member_role:
      ((row?.member_role as RoomMemberRole) ||
        (row?.memberRole as RoomMemberRole) ||
        ((row as any)?.role_in_room as RoomMemberRole) ||
        ((row as any)?.role as RoomMemberRole) ||
        ((row as any)?.role_in_room as any) ||
        "caretaker") === ("caregiver" as any)
        ? "caretaker"
        : (((row?.member_role as RoomMemberRole) ||
            (row?.memberRole as RoomMemberRole) ||
            ((row as any)?.role_in_room as RoomMemberRole) ||
            ((row as any)?.role as RoomMemberRole) ||
            "caretaker") as RoomMemberRole),
    can_manage_medication: !!((row as any)?.can_manage_medication ?? (row as any)?.canManageMedication),
    can_receive_schedule_notifications: !!(
      (row as any)?.can_receive_schedule_notifications ?? (row as any)?.canReceiveScheduleNotifications
    ),
    can_receive_medication_notifications: !!(
      (row as any)?.can_receive_medication_notifications ?? (row as any)?.canReceiveMedicationNotifications
    ),
    can_view_live: !!((row as any)?.can_view_live ?? (row as any)?.canViewLive ?? true),
  })) as RoomMember[];
};

export const updateCaretakerPermissions = async (
  userId: number,
  payload: Partial<
    Pick<
      RoomMember,
      | "can_manage_medication"
      | "can_receive_schedule_notifications"
      | "can_receive_medication_notifications"
      | "can_view_live"
    >
  >
): Promise<void> => {
  await api.patch(`/rooms/members/${userId}/permissions`, payload);
};

export const kickCaretaker = async (userId: number): Promise<void> => {
  await api.delete(`/rooms/members/${userId}`);
};

export type RoomPatient = {
  room_id: number;
  full_name: string;
  gender?: string | null;
  date_of_birth?: string | null;
  note?: string | null;
  updated_at?: string;
};

export const getRoomPatient = async (): Promise<RoomPatient | null> => {
  const res = await api.get("/rooms/patient");
  return res.data?.data ?? null;
};

export const updateRoomPatient = async (payload: {
  full_name: string;
  gender?: string;
  date_of_birth?: string;
  note?: string;
}): Promise<RoomPatient> => {
  const res = await api.put("/rooms/patient", payload);
  return res.data?.data;
};

/** Header Authorization để gửi request upload (fetch) — không set Content-Type để browser tự thêm boundary */
export const getAuthHeaders = (): Record<string, string> => {
  const token = api.defaults.headers.common?.Authorization;
  const headers: Record<string, string> = {};
  if (token && typeof token === "string") {
    headers.Authorization = token;
  }
  if (activeRoomId) {
    headers["x-room-id"] = String(activeRoomId);
  }
  return headers;
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
    {
      timeout: 20000,
      headers: getAuthHeaders(),
    }
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
    headers: getAuthHeaders(),
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
    {
      timeout: 30000,
      headers: getAuthHeaders(),
    }
  );
  const data = res.data ?? {};
  const replyRaw =
    data?.reply ??
    data?.message ??
    data?.answer ??
    data?.content ??
    data?.data?.reply ??
    data?.data?.message;
  return {
    reply: typeof replyRaw === "string" && replyRaw.trim() ? replyRaw.trim() : "Trợ lý chưa phản hồi.",
    session_id: Number(data?.session_id ?? data?.data?.session_id ?? 0) || null,
  };
};

export type GeneratedMealPlanDay = {
  date: string;
  meals: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
};

const normalizeMealText = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : "";

const parseMealPlanJson = (rawReply: string): GeneratedMealPlanDay[] => {
  const txt = String(rawReply || "").trim();
  if (!txt) return [];

  const fencedMatch = txt.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const source = fencedMatch?.[1]?.trim() || txt;

  const start = source.indexOf("[");
  const end = source.lastIndexOf("]");
  const candidate = start >= 0 && end > start ? source.slice(start, end + 1) : source;

  try {
    const arr = JSON.parse(candidate);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((item: any) => ({
        date: String(item?.date || ""),
        meals: {
          breakfast: normalizeMealText(item?.meals?.breakfast),
          lunch: normalizeMealText(item?.meals?.lunch),
          dinner: normalizeMealText(item?.meals?.dinner),
        },
      }))
      .filter(
        (item) =>
          /^\d{4}-\d{2}-\d{2}$/.test(item.date) &&
          (item.meals.breakfast || item.meals.lunch || item.meals.dinner)
      );
  } catch {
    return [];
  }
};

export const generateMealPlanByDateRange = async (
  startDate: string,
  endDate: string,
  mealKeys?: Array<"breakfast" | "lunch" | "dinner">,
  options?: { user_id?: number; session_id?: number }
): Promise<{ plan: GeneratedMealPlanDay[]; rawReply: string; session_id: number | null }> => {
  const selectedMeals = Array.isArray(mealKeys) && mealKeys.length ? mealKeys : ["breakfast", "lunch", "dinner"];
  const selectedMealsText = selectedMeals.join(", ");
  const prompt = [
    "Hãy tạo thực đơn theo JSON array, đúng format sau (giữ nguyên key tiếng Anh):",
    "",
    '[{"date":"YYYY-MM-DD","meals":{"breakfast":"...","lunch":"...","dinner":"..."}}]',
    "",
    `Khoảng ngày: ${startDate} → ${endDate}.`,
    `Chỉ tạo chi tiết cho các bữa: ${selectedMealsText}.`,
    'Các bữa không chọn để chuỗi rỗng "".',
    "",
    "Chỉ trả về JSON, không thêm giải thích.",
  ].join("\n");

  const res = await sendChatMessage(prompt, options);
  const plan = parseMealPlanJson(res.reply);
  return { plan, rawReply: res.reply, session_id: res.session_id };
};

export type MealPlanTemplate = {
  id: string;
  name: string;
  created_at: string;
  days: GeneratedMealPlanDay[];
};

const MEAL_PLAN_TEMPLATE_KEY = "ecms_meal_plan_templates";
let memoryMealPlanTemplates: MealPlanTemplate[] = [];

export const getMealPlanTemplates = (): MealPlanTemplate[] => {
  if (!canUseLocalStorage()) return memoryMealPlanTemplates;
  try {
    const raw = window.localStorage.getItem(MEAL_PLAN_TEMPLATE_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(rows)) return [];
    return rows.filter((row) => Array.isArray(row?.days));
  } catch {
    return memoryMealPlanTemplates;
  }
};

export const saveMealPlanTemplate = (template: MealPlanTemplate): void => {
  if (!canUseLocalStorage()) {
    memoryMealPlanTemplates = [template, ...memoryMealPlanTemplates].slice(0, 20);
    return;
  }
  try {
    const current = getMealPlanTemplates();
    const next = [template, ...current].slice(0, 20);
    window.localStorage.setItem(MEAL_PLAN_TEMPLATE_KEY, JSON.stringify(next));
    memoryMealPlanTemplates = next;
  } catch {
    memoryMealPlanTemplates = [template, ...memoryMealPlanTemplates].slice(0, 20);
  }
};

export type MedicationReminderStatus = "pending" | "done" | "early";

export type MedicationItem = {
  id: number;
  profile_id: number;
  name: string;
  dosage?: string | null;
  note?: string | null;
  created_at?: string;
};

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

export type MedicationCreatePayload = {
  name: string;
  dosage?: string;
  note?: string;
};

export const getMedications = async (): Promise<MedicationItem[]> => {
  const res = await api.get("/medications");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const createMedication = async (payload: MedicationCreatePayload): Promise<MedicationItem | null> => {
  const res = await api.post("/medications", payload);
  return res.data?.data ?? null;
};

export const updateMedication = async (
  id: number,
  payload: Partial<MedicationCreatePayload>
): Promise<void> => {
  await api.put(`/medications/${id}`, payload);
};

export const deleteMedication = async (id: number): Promise<void> => {
  await api.delete(`/medications/${id}`);
};

export type ScheduleMedicationInput = {
  medication_id?: number;
  name?: string;
  dosage?: string;
  note?: string;
};

export type CreateSchedulesPayload = {
  alarm_time: string;
  repeat_type: "once" | "daily";
  medications: ScheduleMedicationInput[];
};

export type TodayScheduleItem = {
  id: number;
  alarm_time: string;
  repeat_type: "once" | "daily";
  is_active: boolean;
  medication_id: number;
  name: string;
  dosage?: string | null;
  note?: string | null;
  status: "pending" | "taken" | "skipped" | "missed";
};

export const createSchedules = async (payload: CreateSchedulesPayload): Promise<void> => {
  await api.post("/schedules", payload);
};

export const getTodaySchedules = async (): Promise<TodayScheduleItem[]> => {
  const res = await api.get("/schedules/today-schedules");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const updateSchedule = async (
  id: number,
  payload: {
    alarm_time?: string;
    repeat_type?: "once" | "daily";
    is_active?: boolean;
    dosage?: string;
    note?: string;
  }
): Promise<void> => {
  await api.put(`/schedules/${id}`, payload);
};

export const deleteSchedule = async (id: number): Promise<void> => {
  await api.delete(`/schedules/${id}`);
};

export const markTaken = async (scheduleId: number): Promise<void> => {
  await api.patch("/logs/mark-taken", { schedule_id: scheduleId });
};

export const markSkipped = async (scheduleId: number): Promise<void> => {
  await api.patch("/logs/mark-skipped", { schedule_id: scheduleId });
};

export type DailyScheduleType = "exercise" | "meal" | "rest" | "other";
export type DayOfWeek = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type DailyScheduleItem = {
  id: number;
  profile_id: number;
  day_of_week: DayOfWeek;
  title: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  type: DailyScheduleType;
  created_at?: string;
};

export type DailySchedulePayload = {
  profile_id?: number;
  day_of_week: DayOfWeek;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  type: DailyScheduleType;
};

export const getDailySchedules = async (profileId?: number): Promise<DailyScheduleItem[]> => {
  const res = await api.get("/daily-schedules", {
    params: profileId ? { profile_id: profileId } : {},
  });
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const createDailySchedule = async (payload: DailySchedulePayload): Promise<number | null> => {
  const res = await api.post("/daily-schedules", payload);
  const id = Number(res.data?.data?.id ?? 0);
  return id > 0 ? id : null;
};

export const updateDailySchedule = async (id: number, payload: Partial<DailySchedulePayload>): Promise<void> => {
  await api.put(`/daily-schedules/${id}`, payload);
};

export const deleteDailySchedule = async (id: number): Promise<void> => {
  await api.delete(`/daily-schedules/${id}`);
};

export const getServerTime = async (): Promise<string> => {
  const res = await api.get("/server-time");
  return String(res.data?.data?.now || new Date().toISOString());
};

