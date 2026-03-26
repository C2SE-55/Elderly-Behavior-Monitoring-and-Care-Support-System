const pool = require("../config/database");
const { getOrCreateRoomProfileId } = require("../services/roomProfile");

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

  static async ensureProfileExists(profileId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT id FROM health_profiles WHERE id = ? LIMIT 1",
        [profileId]
      );
      return !!rows[0];
    } finally {
      connection.release();
    }
  }

  static async getDefaultProfileIdByRoom(roomId, hostUserId) {
    return getOrCreateRoomProfileId(roomId, hostUserId);
  }

  static async getOrCreateDefaultProfileIdByRoom(roomId, hostUserId) {
    return getOrCreateRoomProfileId(roomId, hostUserId);
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

  static async findOwnedSchedule(profileId, id) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT ds.*
         FROM daily_schedules ds
         WHERE ds.id = ? AND ds.profile_id = ?
         LIMIT 1`,
        [id, profileId]
      );
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }
}

module.exports = { DailySchedule, VALID_DAYS, VALID_TYPES };
