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
   * Khóa asset bundle trên app: video3 | videofall (từ stream_url trong DB hoặc room id).
   */
  static resolveAssetKey(cameraRow, numericRoomId) {
    const url = cameraRow?.stream_url ? String(cameraRow.stream_url).toLowerCase() : "";
    if (url.includes("videofall")) return "videofall";
    if (url.includes("video3")) return "video3";
    const rid = Number(numericRoomId);
    if (rid === 2) return "videofall";
    if (rid === 1) return "video3";
    return null;
  }
}

module.exports = { Camera };
