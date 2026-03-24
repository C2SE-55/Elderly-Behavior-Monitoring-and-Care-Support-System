const pool = require("../config/database");

/**
 * Model FallEvent - Ghi nhận sự kiện té ngã vào bảng fall_events.
 * Mỗi dòng = 1 lần té; ảnh tại thời điểm té lưu tại image_url.
 */
class FallEvent {
  static async _firstUserId(connection) {
    try {
      const [rows] = await connection.execute("SELECT id FROM users ORDER BY id ASC LIMIT 1");
      return rows.length > 0 ? rows[0].id : null;
    } catch (_e) {
      return null;
    }
  }

  static async _createAutoCamera(connection) {
    const [cols] = await connection.execute(
      `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'cameras'
       ORDER BY ORDINAL_POSITION`
    );
    if (!cols || cols.length === 0) {
      throw new Error("Không tìm thấy bảng cameras trong database hiện tại");
    }

    const requiredCols = cols
      .filter((c) => {
        const extra = (c.EXTRA || "").toLowerCase();
        const isAutoInc = extra.includes("auto_increment");
        return !isAutoInc && c.IS_NULLABLE === "NO" && c.COLUMN_DEFAULT == null;
      })
      .map((c) => c.COLUMN_NAME);

    const userId = await FallEvent._firstUserId(connection);
    const valueByName = {
      user_id: userId,
      camera_name: "Auto Camera",
      name: "Auto Camera",
      location: "Unknown",
      stream_url: "camera_service_auto",
      rtsp_url: "camera_service_auto",
      url: "camera_service_auto",
      status: "active",
      state: "active",
      is_active: 1,
      enabled: 1,
    };

    const insertCols = [];
    const insertVals = [];
    for (const colName of requiredCols) {
      if (colName === "id") continue;
      if (Object.prototype.hasOwnProperty.call(valueByName, colName)) {
        const val = valueByName[colName];
        if (val == null) {
          throw new Error(`Thiếu dữ liệu để tạo camera tự động: ${colName} (users trống hoặc FK bắt buộc)`);
        }
        insertCols.push(colName);
        insertVals.push(val);
      } else {
        throw new Error(`Không thể tự tạo camera: cột bắt buộc chưa được hỗ trợ (${colName})`);
      }
    }

    if (insertCols.length === 0) {
      // Trường hợp bảng chỉ có id + cột có default/nullable.
      const [insAny] = await connection.execute("INSERT INTO cameras () VALUES ()");
      return insAny.insertId;
    }

    const placeholders = insertCols.map(() => "?").join(", ");
    const sql = `INSERT INTO cameras (${insertCols.join(", ")}) VALUES (${placeholders})`;
    const [ins] = await connection.execute(sql, insertVals);
    return ins.insertId;
  }

  static async _resolveCameraId(connection, requestedCameraId) {
    if (requestedCameraId) {
      const [camRows] = await connection.execute(
        "SELECT id FROM cameras WHERE id = ? LIMIT 1",
        [requestedCameraId]
      );
      if (camRows.length > 0) return requestedCameraId;
    }

    const [firstCamRows] = await connection.execute(
      "SELECT id FROM cameras ORDER BY id ASC LIMIT 1"
    );
    if (firstCamRows.length > 0) return firstCamRows[0].id;

    // Auto-bootstrap camera mặc định khi bảng cameras trống.
    return FallEvent._createAutoCamera(connection);
  }

  static async _resolveProfileId(connection, requestedProfileId) {
    if (!requestedProfileId) return null;
    const [rows] = await connection.execute(
      "SELECT id FROM health_profiles WHERE id = ? LIMIT 1",
      [requestedProfileId]
    );
    return rows.length > 0 ? requestedProfileId : null;
  }

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

      if (image_url == null || image_url === "") {
        throw new Error("image_url là bắt buộc");
      }

      const severity = ["low", "medium", "high"].includes(severity_level)
        ? severity_level
        : "high";
      const validCameraId = await FallEvent._resolveCameraId(connection, camera_id);
      const validProfileId = await FallEvent._resolveProfileId(connection, profile_id);

      try {
        const [rows] = await connection.execute(
          `INSERT INTO fall_events (camera_id, profile_id, image_url, video_url, severity_level, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [validCameraId, validProfileId, image_url, video_url || null, severity, note || null]
        );
        return { insertId: rows.insertId };
      } catch (err) {
        if (err.code === "ER_BAD_FIELD_ERROR" || err.message?.includes("Unknown column")) {
          const [rows] = await connection.execute(
            `INSERT INTO fall_events (camera_id, image_url, video_url, severity_level)
             VALUES (?, ?, ?, ?)`,
            [validCameraId, image_url, video_url || null, severity]
          );
          return { insertId: rows.insertId };
        }
        throw err;
      }
    } finally {
      connection.release();
    }
  }

  static async listRecent(connection, options = {}) {
    const limit = Math.min(Math.max(Number(options.limit) || 20, 1), 100);
    const cameraId = options.camera_id ?? null;
    const hasCameraId = Number.isInteger(cameraId) && cameraId > 0;
    const whereClause = hasCameraId
      ? "WHERE image_url IS NOT NULL AND image_url <> '' AND camera_id = ?"
      : "WHERE image_url IS NOT NULL AND image_url <> ''";
    const params = hasCameraId ? [cameraId] : [];
    const safeLimit = String(limit);
    const run = (sql) => (hasCameraId ? connection.execute(sql, params) : connection.query(sql));

    try {
      const [rows] = await run(
        `SELECT id, camera_id, image_url, severity_level, created_at
         FROM fall_events
         ${whereClause}
         ORDER BY created_at DESC, id DESC
         LIMIT ${safeLimit}`
      );
      return rows.map((row) => ({ ...row, source_type: "fall_event" }));
    } catch (err) {
      if (err.code === "ER_BAD_FIELD_ERROR" || err.message?.includes("Unknown column")) {
        const [rows] = await run(
          `SELECT id, camera_id, image_url, severity_level
           FROM fall_events
           ${whereClause}
           ORDER BY id DESC
           LIMIT ${safeLimit}`
        );
        return rows.map((row) => ({
          ...row,
          created_at: null,
          source_type: "fall_event",
        }));
      }
      throw err;
    }
  }
}

module.exports = FallEvent;
