import { joinRoomByAdminCode, joinRoomByHostQr } from "@/services/api";

export type ParsedRoomQr =
  | { kind: "host"; token: string }
  | { kind: "admin_host"; value: string }
  | { kind: "room_code"; roomId: string }
  | { kind: "unknown"; raw: string };

const MAX_PARSE_DEPTH = 6;

function normalizeRaw(raw: string): string {
  let s = raw
    .replace(/^\uFEFF/, "")
    .replace(/\u200b/g, "")
    .replace(/\r|\n/g, "")
    .trim()
    .replace(/[\uFF1A\uFE55\u02F8]/g, ":");
  s = s.replace(/\s*:\s*/g, ":");
  return s.trim();
}

const isBareAdminToken = (t: string) => /^ADMIN_[a-f0-9]+$/i.test(t);
const isBareHostToken = (t: string) => /^HOST_[a-f0-9]+$/i.test(t);

function safeDecode(s: string): string {
  let out = s.trim();
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(out.replace(/\+/g, "%20"));
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out.trim();
}

/**
 * Phân tích nội dung QR: payload thuần (ADMIN_JOIN / HOST_JOIN / RM…),
 * hoặc URL (nhiều generator đặt payload trong ?data= / ?chl=), hoặc JSON.
 */
export function parseRoomQrData(raw: string, depth = 0): ParsedRoomQr {
  if (depth > MAX_PARSE_DEPTH) return { kind: "unknown", raw: normalizeRaw(raw).slice(0, 120) };

  const t = normalizeRaw(raw);
  if (!t) return { kind: "unknown", raw: "" };

  // JSON từ API / công cụ khác
  if (t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as Record<string, unknown>;
      const tryKeys = [
        j.admin_qr_payload,
        j.adminQrPayload,
        j.admin_join_token,
        j.adminJoinToken,
        j.host_qr_payload,
        j.hostQrPayload,
        j.host_join_token,
        j.hostJoinToken,
        j.room_id,
        j.roomId,
        j.room_code,
        j.roomCode,
      ];
      for (const v of tryKeys) {
        if (typeof v === "string" && v.trim()) {
          const inner = parseRoomQrData(v.trim(), depth + 1);
          if (inner.kind !== "unknown") return inner;
        }
      }
    } catch {
      /* không phải JSON hợp lệ */
    }
  }

  // URL — ví dụ: api.qrserver.com/...?data=ADMIN_JOIN%3AADMIN_...
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      const qpCandidates = [
        u.searchParams.get("data"),
        u.searchParams.get("payload"),
        u.searchParams.get("text"),
        u.searchParams.get("chl"),
      ].filter(Boolean) as string[];

      for (const c of qpCandidates) {
        const inner = parseRoomQrData(safeDecode(c), depth + 1);
        if (inner.kind !== "unknown") return inner;
      }

      const rid = u.searchParams.get("room_id") ?? u.searchParams.get("roomId");
      if (rid) {
        const inner = parseRoomQrData(safeDecode(rid), depth + 1);
        if (inner.kind !== "unknown") return inner;
      }

      const pathSeg = u.pathname.split("/").filter(Boolean);
      const last = pathSeg[pathSeg.length - 1] || "";
      if (/^RM[A-Z0-9]+$/i.test(last)) {
        return { kind: "room_code", roomId: last.toUpperCase() };
      }
    } catch {
      /* URL lỗi */
    }
  }

  // Payload nhúng trong chuỗi dài (sao chép thừa ký tự, URL không parse được)
  const adminInText = t.match(/ADMIN_JOIN:([^\s&|'"<>]+)/i);
  if (adminInText?.[1]) {
    const tok = normalizeRaw(adminInText[1]);
    return { kind: "admin_host", value: `ADMIN_JOIN:${tok}` };
  }
  const hostInText = t.match(/HOST_JOIN:([^\s&|'"<>]+)/i);
  if (hostInText?.[1]) {
    const tok = normalizeRaw(hostInText[1]);
    return { kind: "host", token: `HOST_JOIN:${tok}` };
  }

  const u = t.toUpperCase();
  if (u.startsWith("HOST_JOIN:") || isBareHostToken(t)) {
    return { kind: "host", token: t };
  }
  if (u.startsWith("ADMIN_JOIN:") || isBareAdminToken(t)) {
    return { kind: "admin_host", value: t };
  }

  const rm = t.match(/^(RM[A-Z0-9]+)/i);
  if (rm) {
    return { kind: "room_code", roomId: rm[1].toUpperCase() };
  }

  return { kind: "unknown", raw: t };
}

export async function joinRoomFromParsedQr(parsed: ParsedRoomQr) {
  if (parsed.kind === "host") {
    return joinRoomByHostQr(parsed.token);
  }
  if (parsed.kind === "admin_host") {
    return joinRoomByAdminCode(parsed.value);
  }
  if (parsed.kind === "room_code") {
    return joinRoomByAdminCode(parsed.roomId);
  }
  const err = new Error("INVALID_QR");
  (err as any).code = "INVALID_QR";
  throw err;
}
