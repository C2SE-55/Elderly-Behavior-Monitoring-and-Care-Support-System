import { io, Socket } from "socket.io-client";
import { API_BASE_URL, getAuthHeaders } from "./api";

let socket: Socket | null = null;
const roomChatNotifPrefCache = new Map<number, boolean>();
const prefListeners = new Set<() => void>();

const getSocketUrl = (): string => {
  const normalized = API_BASE_URL.replace(/\/$/, "");
  if (/\/api$/i.test(normalized)) {
    return normalized.replace(/\/api$/i, "");
  }
  return normalized;
};

const getToken = (): string | null => {
  const headers = getAuthHeaders();
  const auth = headers.Authorization || "";
  if (!auth) return null;
  return auth.replace(/^Bearer\s+/i, "");
};

export const connectRoomChatSocket = (): Socket | null => {
  const token = getToken();
  if (!token) return null;
  if (socket?.connected) return socket;
  if (socket) {
    socket.connect();
    return socket;
  }
  socket = io(getSocketUrl(), {
    transports: ["websocket"],
    auth: { token },
    autoConnect: true,
  });
  return socket;
};

export const getRoomChatSocket = (): Socket | null => socket;

export const disconnectRoomChatSocket = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};

export const setRoomChatNotifPrefCached = (roomId: number, enabled: boolean) => {
  const rid = Number(roomId || 0);
  if (!rid) return;
  roomChatNotifPrefCache.set(rid, !!enabled);
  for (const cb of Array.from(prefListeners)) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
};

export const getRoomChatNotifPrefCached = (roomId: number): boolean | undefined => {
  const rid = Number(roomId || 0);
  if (!rid) return undefined;
  return roomChatNotifPrefCache.get(rid);
};

export const seedRoomChatNotifPrefsCache = (rows: Array<{ room_id: number; chat_notifications_enabled: boolean }>) => {
  roomChatNotifPrefCache.clear();
  for (const r of rows || []) {
    const rid = Number((r as any)?.room_id || 0);
    if (!rid) continue;
    roomChatNotifPrefCache.set(rid, !!(r as any)?.chat_notifications_enabled);
  }
  for (const cb of Array.from(prefListeners)) {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  }
};

export const subscribeRoomChatNotifPrefCacheChange = (cb: () => void): (() => void) => {
  prefListeners.add(cb);
  return () => prefListeners.delete(cb);
};
