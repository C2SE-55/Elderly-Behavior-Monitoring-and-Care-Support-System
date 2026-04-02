import { api, getCurrentUser, getMyRoom } from "@/services/api";

const safeText = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

/**
 * Lấy tên người già theo đúng nguồn "Quản lý thông tin sức khỏe" (health-metrics).
 * HealthScreen đang dùng endpoint: GET /health-metrics/profile/{profileId} và đọc field elderly_name.
 */
export async function getElderNameFromHealthMetrics(): Promise<string | null> {
  try {
    const room = await getMyRoom();
    if (!room) return null;
    const me = getCurrentUser() as { id?: number } | null;
    const isHost = room.member_role === "host";
    const hostProfileId = Number(room.host_user_id || (isHost ? me?.id : 0)) || 0;
    if (!hostProfileId) return null;

    const response = await api.get(`/health-metrics/profile/${hostProfileId}`);
    const payload = response.data?.data;
    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const profile = rows[0];
    const name = safeText(profile?.elderly_name);
    return name || null;
  } catch {
    return null;
  }
}

