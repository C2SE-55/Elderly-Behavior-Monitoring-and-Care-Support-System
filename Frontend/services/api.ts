import axios from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const trimUrl = (u: string) => u.trim().replace(/\/$/, "");

const isLocalhostUrl = (raw: string): boolean => {
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return /\blocalhost\b|127\.0\.0\.1/i.test(raw);
  }
};

/** Host từ Expo hostUri (vd 192.168.1.5:8081 → 192.168.1.5), không lấy nhầm cổng làm API. */
const hostFromExpoHostUri = (hostUri: string): string => {
  if (hostUri.startsWith("[")) {
    const end = hostUri.indexOf("]");
    if (end > 0) return hostUri.slice(1, end);
  }
  const idx = hostUri.lastIndexOf(":");
  if (idx > 0 && /^\d+$/.test(hostUri.slice(idx + 1))) {
    return hostUri.slice(0, idx);
  }
  return hostUri;
};

/**
 * Expo trên điện thoại thật: Metro báo hostUri dạng 192.168.x.x.
 * Khi đó EXPO_PUBLIC_*=localhost trong .env trỏ nhầm vào chính điện thoại → bỏ qua .env, dùng IP LAN.
 * Giữ .env localhost cho web + iOS Simulator (hostUri thường là localhost).
 */
const preferLanHostOverLocalhostEnv = (): boolean => {
  if (Platform.OS === "web") return false;
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return false;
  const h = hostFromExpoHostUri(hostUri);
  return h !== "localhost" && h !== "127.0.0.1";
};

const getApiBaseUrl = () => {
  const envApi =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_API_URL
      ? trimUrl(String(process.env.EXPO_PUBLIC_API_URL))
      : "";
  if (envApi && !(preferLanHostOverLocalhostEnv() && isLocalhostUrl(envApi))) {
    return envApi;
  }

  // Nếu cấu hình trong app.json / app.config.ts có extra.apiUrl thì ưu tiên dùng
  // (phù hợp cho môi trường production)
  // @ts-ignore
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (extraApiUrl) {
    const raw = trimUrl(String(extraApiUrl));
    try {
      const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
      // Tránh cấu hình nhầm: trỏ apiUrl vào cổng Metro (8081) — Backend Node là 5000
      if (Platform.OS === "web" && (u.port === "8081" || u.port === "19006")) {
        u.port = "5000";
        return trimUrl(u.toString());
      }
    } catch {
      // giữ nguyên raw
    }
    return raw;
  }

  // Trong môi trường phát triển với Expo, lấy host của Metro bundler
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostFromExpoHostUri(hostUri);
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

/** Base URL cho Camera Service (AI stream + fall detection) - port 9001 (không phải cổng Expo 8081). */
const getCameraServiceBaseUrl = () => {
  const envCam =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_CAMERA_SERVICE_URL
      ? trimUrl(String(process.env.EXPO_PUBLIC_CAMERA_SERVICE_URL))
      : "";
  if (envCam && !(preferLanHostOverLocalhostEnv() && isLocalhostUrl(envCam))) {
    return envCam;
  }
  try {
    const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
    if (extra?.cameraServiceUrl) {
      const raw = trimUrl(extra.cameraServiceUrl);
      try {
        const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
        if (Platform.OS === "web" && (u.port === "8081" || u.port === "19006")) {
          const base = getApiBaseUrl();
          const bu = new URL(base.includes("://") ? base : `http://${base}`);
          bu.port = "9001";
          return trimUrl(bu.toString());
        }
      } catch {
        // fall through
      }
      return raw;
    }
    const base = getApiBaseUrl();
    const url = new URL(base.includes("://") ? base : `http://${base}`);
    url.port = "9001";
    return trimUrl(url.toString());
  } catch {
    return "http://localhost:9001";
  }
};

export const CAMERA_SERVICE_BASE_URL = getCameraServiceBaseUrl();

/** URL stream MJPEG (video đã qua model té ngã, quét liên tục) */
export const CAMERA_STREAM_URL = `${CAMERA_SERVICE_BASE_URL}/stream`;

/** Base URL Camera Service theo port (đa tiến trình AI: CAMERA_AI_STREAM_PORTS trên Backend). */
export const getCameraServiceBaseUrlForPort = (port?: number | null): string => {
  if (!port || port < 1) {
    return CAMERA_SERVICE_BASE_URL;
  }
  try {
    const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
    if (extra?.cameraServiceUrl) {
      const u = new URL(extra.cameraServiceUrl);
      u.port = String(port);
      return u.toString().replace(/\/$/, "");
    }
    const base = getApiBaseUrl();
    const url = new URL(base);
    url.port = String(port);
    return url.toString().replace(/\/$/, "");
  } catch {
    return `http://localhost:${port}`;
  }
};

export const getCameraServiceStreamUrl = (port?: number | null): string =>
  `${getCameraServiceBaseUrlForPort(port ?? null)}/stream`;

export type CameraLiveAccessResponse = {
  allowed: boolean;
  reason?: string | null;
  room_id: number | null;
  asset_key: "video3" | "videofall" | null;
  camera_id: number | null;
  /** Port tiến trình Camera Service cho camera này (khi Backend bật CAMERA_AI_STREAM_PORTS). */
  stream_port?: number | null;
  /** Video demo trong app khi stream_port bật nhưng MJPEG tắt / lỗi mạng */
  fallback_asset_key?: "video3" | "videofall" | null;
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
export const getCameraStatus = async (streamPort?: number | null): Promise<{
  fallcount: number;
  fps: number;
  ready: boolean;
}> => {
  const base = getCameraServiceBaseUrlForPort(streamPort ?? null);
  const { data } = await axios.get(`${base}/api/status`, {
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

export const getCameraEventHistory = async (
  limit = 20,
  cameraId?: number | null
): Promise<CameraHistoryEvent[]> => {
  const params: Record<string, string | number> = { limit };
  if (cameraId != null && Number(cameraId) > 0) {
    params.camera_id = Number(cameraId);
  }
  const { data } = await api.get("/fall-events/history", {
    params,
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
const authChangeListeners = new Set<(payload: { token: string | null; user: any | null }) => void>();

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

  authChangeListeners.forEach((listener) => {
    try {
      listener({ token: currentToken, user: currentUser });
    } catch {
      // ignore
    }
  });
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
export const getCurrentToken = () => currentToken;

export const subscribeAuthChange = (listener: (payload: { token: string | null; user: any | null }) => void) => {
  authChangeListeners.add(listener);
  return () => {
    authChangeListeners.delete(listener);
  };
};

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
  /** cameras.id gắn room — dùng lọc lịch sử / thông báo an toàn */
  camera_id?: number | null;
  /** HOST: bật/tắt lịch OS lặp theo ngày cho cả room (thiếu field = bật) */
  medication_daily_reminders_enabled?: boolean | number;
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
  camera_id?: number | null;
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
  already_in_room?: boolean;
  serverMessage?: string;
}> => {
  const res = await api.post("/rooms/join/admin-room", { room_id: roomId });
  const data = (res.data?.data ?? {}) as Record<string, unknown>;
  return {
    ...(data as any),
    serverMessage: typeof res.data?.message === "string" ? res.data.message : undefined,
  };
};

export const joinRoomByHostQr = async (hostJoinToken: string): Promise<{
  room_id: string;
  role_in_room: "caretaker" | "host";
  already_in_room?: boolean;
  already_host?: boolean;
  serverMessage?: string;
}> => {
  const res = await api.post("/rooms/join/host-qr", { host_join_token: hostJoinToken });
  const data = (res.data?.data ?? {}) as Record<string, unknown>;
  return {
    ...(data as any),
    serverMessage: typeof res.data?.message === "string" ? res.data.message : undefined,
  };
};

export const getMyRoom = async (): Promise<MyRoomInfo | null> => {
  const roomId = getActiveRoomId();
  const res = await api.get("/rooms/me", {
    params: roomId ? { room_id: roomId } : {},
  });
  return res.data?.data ?? null;
};

export const updateMedicationDailyReminders = async (
  enabled: boolean
): Promise<{ medication_daily_reminders_enabled: number }> => {
  const res = await api.put("/rooms/medication-daily-reminders", { enabled });
  return (res.data?.data ?? {}) as { medication_daily_reminders_enabled: number };
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

export type ExtractedMedicineItem = {
  id: string;
  ten_thuoc: string | null;
  lieu_luong: string | null;
  ghi_chu: string | null;
  confidence: number;
  needs_review: boolean;
  note_item: string;
};

export type MedicationExtractionResponse = {
  status: "ok" | "partial" | "fail";
  message: string;
  medicines: ExtractedMedicineItem[];
  summary: {
    total_detected: number;
    high_confidence_count: number;
  };
};

export const getMedications = async (): Promise<MedicationItem[]> => {
  const res = await api.get("/medications");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const createMedication = async (payload: MedicationCreatePayload): Promise<MedicationItem | null> => {
  const res = await api.post("/medications", payload);
  return res.data?.data ?? null;
};

export const extractMedicationsFromImage = async (imageUri: string): Promise<MedicationExtractionResponse> => {
  const formData = new FormData();
  if (Platform.OS === "web" || imageUri.startsWith("blob:")) {
    const fetched = await fetch(imageUri);
    const blob = await fetched.blob();
    const file = new File([blob], "prescription.jpg", { type: "image/jpeg" });
    formData.append("image", file);
  } else {
    formData.append("image", {
      uri: imageUri,
      name: "prescription.jpg",
      type: "image/jpeg",
    } as any);
  }

  const headers: Record<string, string> = getAuthHeaders();
  const uploadUrl = `${API_ROOT}/medications/extract-from-image`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body: formData,
  });
  const json = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(json?.message || "Không thể trích xuất thuốc từ ảnh"), {
      response: { data: json, status: response.status },
    });
  }
  return json as MedicationExtractionResponse;
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

export type MedicationMarkResult = {
  schedule_id: number;
  status: string;
  inserted?: boolean;
  intake_date?: string;
  acted_by_user_id?: number | null;
  acted_by_name?: string | null;
};

export const markTaken = async (scheduleId: number): Promise<MedicationMarkResult> => {
  const res = await api.patch("/logs/mark-taken", { schedule_id: scheduleId });
  return (res.data?.data ?? {}) as MedicationMarkResult;
};

export const markSkipped = async (scheduleId: number): Promise<MedicationMarkResult> => {
  const res = await api.patch("/logs/mark-skipped", { schedule_id: scheduleId });
  return (res.data?.data ?? {}) as MedicationMarkResult;
};

export type MedicationSlotMarkResult = {
  schedule_ids: number[];
  alarm_time: string;
  status: string;
  inserted?: boolean;
  intake_date?: string;
  acted_by_user_id?: number | null;
  acted_by_name?: string | null;
};

export const markMedicationSlotTaken = async (
  alarmTime: string,
  date?: string
): Promise<MedicationSlotMarkResult> => {
  const res = await api.patch("/logs/mark-slot-taken", {
    alarm_time: alarmTime,
    ...(date ? { date } : {}),
  });
  return (res.data?.data ?? {}) as MedicationSlotMarkResult;
};

export const markMedicationSlotSkipped = async (
  alarmTime: string,
  date?: string
): Promise<MedicationSlotMarkResult> => {
  const res = await api.patch("/logs/mark-slot-skipped", {
    alarm_time: alarmTime,
    ...(date ? { date } : {}),
  });
  return (res.data?.data ?? {}) as MedicationSlotMarkResult;
};

export const deleteSchedulesForSlot = async (alarmTime: string): Promise<{ deleted: number }> => {
  const res = await api.delete("/schedules/slot", { data: { alarm_time: alarmTime } });
  const d = res.data?.data ?? {};
  return { deleted: Number(d.deleted || 0) };
};

export type MedicationIntakeStatItem = {
  log_id: number;
  taken_time: string;
  status: string;
  schedule_id: number;
  alarm_time: string;
  medication_name: string;
  acted_by_user_id: number | null;
  acted_by_name: string | null;
};

export type MedicationIntakeStatsResponse = {
  range: { start: string; end: string; period: string };
  items: MedicationIntakeStatItem[];
};

export const getMedicationIntakeStats = async (
  roomId: number,
  params: { period: "day" | "week" | "month"; anchor?: string }
): Promise<MedicationIntakeStatsResponse> => {
  const res = await api.get(`/rooms/${roomId}/medication-intake-stats`, {
    params: { period: params.period, ...(params.anchor ? { anchor: params.anchor } : {}) },
  });
  const data = res.data?.data;
  if (!data || typeof data !== "object") {
    return { range: { start: "", end: "", period: params.period }, items: [] };
  }
  return {
    range: data.range || { start: "", end: "", period: params.period },
    items: Array.isArray(data.items) ? data.items : [],
  };
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

export type RoomMessageSeenBy = {
  user_id: number;
  user_name: string;
  read_at: string;
};

export type RoomChatMessage = {
  id: number;
  room_id: number;
  sender_user_id: number;
  sender_name: string;
  content: string;
  created_at: string;
  seen_by: RoomMessageSeenBy[];
  is_mine?: boolean;
};

export type RoomChatPage = {
  items: RoomChatMessage[];
  has_more: boolean;
  next_before_id: number | null;
};

export type RoomUnreadSummaryItem = {
  room_id: number;
  room_name: string;
  unread_count: number;
  last_message_id: number | null;
  last_sender_user_id: number | null;
  last_sender_name: string | null;
  last_content: string | null;
  last_sent_at: string | null;
};

export type RoomNote = {
  id: number;
  room_id: number;
  created_by_user_id: number;
  created_by_name: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
};

export const getRoomMessages = async (
  roomId: number,
  params?: { limit?: number; before_id?: number }
): Promise<RoomChatPage> => {
  const res = await api.get(`/rooms/${roomId}/messages`, {
    params: {
      limit: params?.limit ?? 100,
      ...(params?.before_id ? { before_id: params.before_id } : {}),
    },
  });
  const data = res.data?.data ?? {};
  return {
    items: Array.isArray(data.items) ? data.items : [],
    has_more: !!data.has_more,
    next_before_id: Number(data.next_before_id || 0) || null,
  };
};

export const sendRoomMessage = async (roomId: number, content: string): Promise<RoomChatMessage> => {
  const res = await api.post(`/rooms/${roomId}/messages`, { content });
  return res.data?.data as RoomChatMessage;
};

export const markRoomMessagesRead = async (
  roomId: number,
  payload: { message_ids?: number[]; read_until_id?: number }
): Promise<{
  read_count: number;
  seen_updates: Array<{ message_id: number; seen_by: RoomMessageSeenBy[] }>;
}> => {
  const res = await api.post(`/rooms/${roomId}/messages/read`, payload);
  return (
    res.data?.data ?? {
      read_count: 0,
      seen_updates: [],
    }
  );
};

export const getRoomUnreadCount = async (roomId: number): Promise<number> => {
  const res = await api.get(`/rooms/${roomId}/messages/unread-count`);
  return Number(res.data?.data?.unread_count || 0);
};

export const getRoomsUnreadSummary = async (): Promise<RoomUnreadSummaryItem[]> => {
  const res = await api.get("/rooms/messages/unread-summary");
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export type RoomChatNotificationPrefItem = {
  room_id: number;
  chat_notifications_enabled: boolean;
};

export const getRoomChatNotificationPrefs = async (): Promise<RoomChatNotificationPrefItem[]> => {
  const res = await api.get("/rooms/chat-notification-prefs");
  const rows = res.data?.data;
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    room_id: Number(r.room_id),
    chat_notifications_enabled: r.chat_notifications_enabled !== false && r.chat_notifications_enabled !== 0,
  }));
};

export const setRoomChatNotificationPref = async (
  roomId: number,
  enabled: boolean
): Promise<{ chat_notifications_enabled: boolean }> => {
  const res = await api.put(`/rooms/${roomId}/chat-notification-pref`, { enabled });
  const d = res.data?.data ?? {};
  return {
    chat_notifications_enabled: !!d.chat_notifications_enabled,
  };
};

export const getRoomNotes = async (roomId: number): Promise<RoomNote[]> => {
  const res = await api.get(`/rooms/${roomId}/notes`);
  return Array.isArray(res.data?.data) ? res.data.data : [];
};

export const createRoomNote = async (
  roomId: number,
  payload: { title?: string; content: string; is_pinned?: boolean }
): Promise<RoomNote> => {
  const res = await api.post(`/rooms/${roomId}/notes`, payload);
  return res.data?.data as RoomNote;
};

export const updateRoomNote = async (
  roomId: number,
  noteId: number,
  payload: { title?: string; content?: string; is_pinned?: boolean }
): Promise<RoomNote> => {
  const res = await api.put(`/rooms/${roomId}/notes/${noteId}`, payload);
  return res.data?.data as RoomNote;
};

export const deleteRoomNote = async (roomId: number, noteId: number): Promise<void> => {
  await api.delete(`/rooms/${roomId}/notes/${noteId}`);
};

