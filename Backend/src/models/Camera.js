const pool = require("../config/database");

class Camera {
  /**
   * Camera active theo rooms.id (khóa số).
   */
  static async findActiveByRoomId(roomId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, room_id, stream_url, status
         FROM cameras
         WHERE room_id = ? AND status = 'active'
         ORDER BY id ASC
         LIMIT 1`,
        [roomId]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Khóa asset bundle trên app: video3 | videofall (chỉ khi stream_url trỏ file demo trong app).
   * Webcam / file khác / đường dẫn tuyệt đối không chứa tên demo → null (dùng MJPEG từ Camera Service).
   */
  static resolveAssetKey(cameraRow, numericRoomId) {
    const raw = cameraRow?.stream_url != null ? String(cameraRow.stream_url).trim() : "";
    const url = raw.toLowerCase();
    if (url.includes("videofall")) return "videofall";
    if (url.includes("video3")) return "video3";
    if (!raw) {
      const rid = Number(numericRoomId);
      if (rid === 2) return "videofall";
      if (rid === 1) return "video3";
      return null;
    }
    if (/^\d+$/.test(raw)) return null;
    if (url.includes("webcam") || url.includes("device:") || url.includes("camera:")) {
      return null;
    }
    if (/\.(mp4|avi|mkv|mov)(\?|$)/i.test(raw) || raw.includes("\\") || /^[a-z]:/i.test(raw)) {
      return null;
    }
    return null;
  }
}

module.exports = { Camera };
