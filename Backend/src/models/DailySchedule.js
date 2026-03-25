const pool = require("../config/database");

const VALID_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const VALID_TYPES = ["exercise", "meal", "rest", "other"];

class DailySchedule {
  static normalizeTime(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const hhmmss = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (hhmmss.test(text)) return text;
    if (hhmm.test(text)) return `${text}:00`;
    return null;
  }

  static async ensureProfileBelongsUser(userId, profileId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT id FROM health_profiles WHERE id = ? AND user_id = ? LIMIT 1",
        [profileId, userId]
      );
      return !!rows[0];
    } finally {
      connection.release();
    }
  }

  static async getDefaultProfileIdByUserId(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? ORDER BY id ASC LIMIT 1",
        [userId]
      );
      return rows[0]?.id || null;
    } finally {
      connection.release();
    }
  }

  static async getOrCreateDefaultProfileIdByUserId(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? ORDER BY id ASC LIMIT 1",
        [userId]
      );
      if (rows[0]?.id) return rows[0].id;

      const [userRows] = await connection.execute(
        "SELECT full_name, username FROM users WHERE id = ? LIMIT 1",
        [userId]
      );
      const elderlyName = userRows[0]?.full_name || userRows[0]?.username || `User ${userId}`;
      const [insertResult] = await connection.execute(
        "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, ?)",
        [userId, elderlyName]
      );
      return insertResult.insertId;
    } finally {
      connection.release();
    }
  }

  static async getByProfileId(profileId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT id, profile_id, day_of_week, title, description, start_time, end_time, type, created_at
         FROM daily_schedules
         WHERE profile_id = ?
         ORDER BY FIELD(day_of_week, 'mon','tue','wed','thu','fri','sat','sun'), start_time ASC, id ASC`,
        [profileId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async create(payload) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO daily_schedules
         (profile_id, day_of_week, title, description, start_time, end_time, type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          payload.profile_id,
          payload.day_of_week,
          payload.title,
          payload.description || null,
          payload.start_time,
          payload.end_time,
          payload.type,
        ]
      );
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  static async update(id, payload) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];
      const allowed = ["day_of_week", "title", "description", "start_time", "end_time", "type"];
      for (const key of allowed) {
        if (payload[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(payload[key]);
        }
      }
      if (!fields.length) return 0;
      values.push(id);
      const [result] = await connection.execute(
        `UPDATE daily_schedules SET ${fields.join(", ")} WHERE id = ?`,
        values
      );
      return result.affectedRows;
    } finally {
      connection.release();
    }
  }

  static async remove(id) {
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute("DELETE FROM daily_schedules WHERE id = ?", [id]);
      return result.affectedRows;
    } finally {
      connection.release();
    }
  }

  static async findOwnedSchedule(userId, id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT ds.*
         FROM daily_schedules ds
         INNER JOIN health_profiles hp ON hp.id = ds.profile_id
         WHERE ds.id = ? AND hp.user_id = ?
         LIMIT 1`,
        [id, userId]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }
}

module.exports = { DailySchedule, VALID_DAYS, VALID_TYPES };
