/**
 * Ánh xạ cameras.id → port Camera Service (MJPEG + model).
 * Ví dụ .env: CAMERA_AI_STREAM_PORTS=1:9001,2:9002
 * Khi camera có trong map, live-access trả stream_port và tắt asset bundle để app dùng MJPEG đúng tiến trình AI.
 */
function parsePortsMap() {
  const raw = (process.env.CAMERA_AI_STREAM_PORTS || "").trim();
  const map = new Map();
  if (!raw) return map;
  const parts = raw.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const [left, right] = part.split(":").map((s) => s.trim());
    const cameraId = parseInt(left, 10);
    const port = parseInt(right, 10);
    if (cameraId > 0 && port > 0) {
      map.set(cameraId, port);
    }
  }
  return map;
}

let _cached = null;
let _cachedRaw = null;

function getMap() {
  const raw = (process.env.CAMERA_AI_STREAM_PORTS || "").trim();
  if (_cached && _cachedRaw === raw) return _cached;
  _cachedRaw = raw;
  _cached = parsePortsMap();
  return _cached;
}

function getStreamPortForCameraId(cameraId) {
  if (!cameraId) return null;
  const p = getMap().get(Number(cameraId));
  return p != null && p > 0 ? p : null;
}

function isAiStreamRoutingEnabled() {
  return getMap().size > 0;
}

module.exports = {
  getStreamPortForCameraId,
  isAiStreamRoutingEnabled,
};
