const pool = require("../config/database");
const FallEvent = require("./FallEvent");

/**
 * Ghi sự kiện rời khỏi vùng an toàn vào bảng left_safe_zone_events.
 */
class LeftSafeZoneEvent {
  static async _resolveZoneId(connection, requestedZoneId, cameraId) {
    if (requestedZoneId) {
      const [rows] = await connection.execute(
        "SELECT id FROM safe_zones WHERE id = ? LIMIT 1",
        [requestedZoneId]
      );
      if (rows.length > 0) return requestedZoneId;
    }

    if (cameraId) {
      const [rows] = await connection.execute(
        "SELECT id FROM safe_zones WHERE camera_id = ? ORDER BY id ASC LIMIT 1",
        [cameraId]
      );
      if (rows.length > 0) return rows[0].id;
    }

    return null;
  }

  static async create(data) {
    const connection = await pool.getConnection();
    try {
      const {
        camera_id = null,
        zone_id = null,
        image_url,
        severity_level = "medium",
      } = data;

      if (!image_url) {
        throw new Error("image_url là bắt buộc");
      }

      const validCameraId = await FallEvent._resolveCameraId(connection, camera_id);
      const validZoneId = await LeftSafeZoneEvent._resolveZoneId(
        connection,
        zone_id,
        validCameraId
      );
      const severity = ["low", "medium", "high"].includes(severity_level)
        ? severity_level
        : "medium";

      try {
        const [rows] = await connection.execute(
          `INSERT INTO left_safe_zone_events (camera_id, zone_id, image_url, severity_level)
           VALUES (?, ?, ?, ?)`,
          [validCameraId, validZoneId, image_url, severity]
        );
        return { insertId: rows.insertId };
      } catch (err) {
        if (err.code === "ER_BAD_FIELD_ERROR" || err.message?.includes("Unknown column")) {
          const [rows] = await connection.execute(
            `INSERT INTO left_safe_zone_events (camera_id, zone_id, image_url)
             VALUES (?, ?, ?)`,
            [validCameraId, validZoneId, image_url]
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

module.exports = LeftSafeZoneEvent;
