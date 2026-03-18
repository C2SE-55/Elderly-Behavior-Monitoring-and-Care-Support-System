const pool = require("../config/database");

/**
 * Model FallEvent - Ghi nhận sự kiện té ngã vào bảng fall_events.
 * Mỗi dòng = 1 lần té; ảnh tại thời điểm té lưu tại image_url.
 */
class FallEvent {
  /**
   * Tạo bản ghi fall event (ảnh đã upload, lưu URL vào DB).
   * @param {Object} data - { camera_id, profile_id?, image_url, video_url?, severity_level?, note? }
   * @returns {Promise<{ insertId: number }>}
   */
  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const {
        camera_id,
        profile_id = null,
        image_url,
        video_url = null,
        severity_level = "high",
        note = null,
      } = data;

      if (!camera_id || image_url == null || image_url === "") {
        throw new Error("camera_id và image_url là bắt buộc");
      }

      const severity = ["low", "medium", "high"].includes(severity_level)
        ? severity_level
        : "high";

      try {
        const [rows] = await connection.execute(
          `INSERT INTO fall_events (camera_id, profile_id, image_url, video_url, severity_level, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [camera_id, profile_id || null, image_url, video_url || null, severity, note || null]
        );
        return { insertId: rows.insertId };
      } catch (err) {
        if (err.code === "ER_BAD_FIELD_ERROR" || err.message?.includes("Unknown column")) {
          const [rows] = await connection.execute(
            `INSERT INTO fall_events (camera_id, image_url, video_url, severity_level)
             VALUES (?, ?, ?, ?)`,
            [camera_id, image_url, video_url || null, severity]
          );
          return { insertId: rows.insertId };
        }
        throw err;
      }
    } finally {
      connection.release();
    }
  }
}

module.exports = FallEvent;
