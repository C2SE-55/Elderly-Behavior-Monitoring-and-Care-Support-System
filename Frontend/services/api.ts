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

/** Gửi tin nhắn tới Trợ lý ảo (Chatbot Service). history: [{ role, content }] */
export const sendChatMessage = async (
  message: string,
  options?: { user_id?: number; history?: { role: string; content: string }[] }
): Promise<string> => {
  const res = await axios.post(
    `${CHATBOT_BASE_URL}/chat`,
    {
      message,
      user_id: options?.user_id ?? null,
      history: options?.history ?? [],
    },
    { timeout: 30000 }
  );
  return res.data?.reply ?? "Trợ lý chưa phản hồi.";
};

