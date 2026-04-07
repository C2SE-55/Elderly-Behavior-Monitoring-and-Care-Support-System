import { io, Socket } from "socket.io-client";
import { API_BASE_URL, getAuthHeaders } from "./api";

let socket: Socket | null = null;

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
