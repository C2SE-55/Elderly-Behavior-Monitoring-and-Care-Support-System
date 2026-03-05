const pool = require("../config/database");

// Model HealthMetric - Quản lý các thao tác với bảng health_metrics
class HealthMetric {
  // Tạo chỉ số sức khỏe mới
  static async create(metricData) {
    const connection = await pool.getConnection();
    try {
      const {
        profileId,
        metricType,
        valueNumeric,
        valueText,
        unit,
        status,
        notes,
        recordedBy,
      } = metricData;

      const query = `
        INSERT INTO health_metrics (
          profile_id, metric_type, value_numeric, value_text, unit, status, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(query, [
        profileId,
        metricType,
        valueNumeric || null,
        valueText || null,
        unit || null,
        status || "normal",
        notes || null,
        recordedBy || null,
      ]);

      return result;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả chỉ số sức khỏe theo profile ID
  static async getByProfileId(profileId, limit = 100, offset = 0) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT hm.*, u.full_name as recorded_by_name
        FROM health_metrics hm
        LEFT JOIN users u ON hm.recorded_by = u.id
        WHERE hm.profile_id = ?
        ORDER BY hm.recorded_at DESC
        LIMIT ? OFFSET ?
      `;

      const [rows] = await connection.execute(query, [
        profileId,
        limit,
        offset,
      ]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Lấy chỉ số sức khỏe theo loại và profile ID
  static async getByMetricType(profileId, metricType, limit = 50) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT hm.*, u.full_name as recorded_by_name
        FROM health_metrics hm
        LEFT JOIN users u ON hm.recorded_by = u.id
        WHERE hm.profile_id = ? AND hm.metric_type = ?
        ORDER BY hm.recorded_at DESC
        LIMIT ?
      `;

      const [rows] = await connection.execute(query, [
        profileId,
        metricType,
        limit,
      ]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Lấy chỉ số sức khỏe theo ID
  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT hm.*, u.full_name as recorded_by_name
        FROM health_metrics hm
        LEFT JOIN users u ON hm.recorded_by = u.id
        WHERE hm.id = ?
      `;

      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Cập nhật chỉ số sức khỏe
  static async update(id, updateData) {
    const connection = await pool.getConnection();
    try {
      const { valueNumeric, valueText, unit, status, notes } = updateData;

      const query = `
        UPDATE health_metrics 
        SET value_numeric = ?, value_text = ?, unit = ?, status = ?, notes = ?, updated_at = NOW()
        WHERE id = ?
      `;

      const [result] = await connection.execute(query, [
        valueNumeric || null,
        valueText || null,
        unit || null,
        status || "normal",
        notes || null,
        id,
      ]);

      return result;
    } finally {
      connection.release();
    }
  }

  // Xóa chỉ số sức khỏe
  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      const query = "DELETE FROM health_metrics WHERE id = ?";
      const [result] = await connection.execute(query, [id]);
      return result;
    } finally {
      connection.release();
    }
  }

  // Lấy thống kê chỉ số sức khỏe (trung bình, min, max)
  static async getStatistics(profileId, metricType, days = 7) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT 
          metric_type,
          COUNT(*) as count,
          AVG(value_numeric) as avg_value,
          MIN(value_numeric) as min_value,
          MAX(value_numeric) as max_value,
          unit
        FROM health_metrics
        WHERE profile_id = ? 
          AND metric_type = ?
          AND recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY metric_type, unit
      `;

      const [rows] = await connection.execute(query, [
        profileId,
        metricType,
        days,
      ]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Lấy chỉ số sức khỏe gần nhất theo loại
  static async getLatestByMetricType(profileId, metricType) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT hm.*, u.full_name as recorded_by_name
        FROM health_metrics hm
        LEFT JOIN users u ON hm.recorded_by = u.id
        WHERE hm.profile_id = ? AND hm.metric_type = ?
        ORDER BY hm.recorded_at DESC
        LIMIT 1
      `;

      const [rows] = await connection.execute(query, [
        profileId,
        metricType,
      ]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả chỉ số gần nhất
  static async getLatestAllMetrics(profileId) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT hm.*, u.full_name as recorded_by_name
        FROM health_metrics hm
        LEFT JOIN users u ON hm.recorded_by = u.id
        WHERE hm.profile_id = ? 
          AND hm.recorded_at = (
            SELECT MAX(recorded_at) 
            FROM health_metrics 
            WHERE profile_id = hm.profile_id AND metric_type = hm.metric_type
          )
        ORDER BY hm.recorded_at DESC
      `;

      const [rows] = await connection.execute(query, [profileId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Đếm số lượng chỉ số sức khỏe theo profile
  static async countByProfileId(profileId) {
    const connection = await pool.getConnection();
    try {
      const query = "SELECT COUNT(*) as count FROM health_metrics WHERE profile_id = ?";
      const [rows] = await connection.execute(query, [profileId]);
      return rows[0]?.count || 0;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả các loại metric có sẵn
  static async getAvailableMetricTypes() {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT DISTINCT metric_type 
        FROM health_metrics 
        ORDER BY metric_type
      `;
      const [rows] = await connection.execute(query);
      return rows;
    } finally {
      connection.release();
    }
  }
}

module.exports = HealthMetric;
