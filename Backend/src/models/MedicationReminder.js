const pool = require("../config/database");
const { getOrCreateRoomProfileId } = require("../services/roomProfile");

class MedicationReminder {
  static async getProfileIdByRoom(roomId, hostUserId) {
    return getOrCreateRoomProfileId(roomId, hostUserId);
  }

  static async getOrCreateProfileIdByRoom(roomId, hostUserId) {
    return getOrCreateRoomProfileId(roomId, hostUserId);
  }

  static normalizeTime(timeText) {
    if (!timeText || typeof timeText !== "string") return null;
    const trimmed = timeText.trim();
    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const hhmmss = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;

    if (hhmmss.test(trimmed)) return trimmed;
    if (hhmm.test(trimmed)) return `${trimmed}:00`;
    return null;
  }

  static async createMedicationForUser(hostUserId, roomId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId);
      const name = String(payload?.name || "").trim();
      if (!name) {
        const err = new Error("MEDICINE_NAME_REQUIRED");
        err.code = "MEDICINE_NAME_REQUIRED";
        throw err;
      }
      const dosage = payload?.dosage ? String(payload.dosage).trim() : null;
      const note = payload?.note ? String(payload.note).trim() : null;

      const [result] = await connection.execute(
        "INSERT INTO medications (profile_id, name, dosage, note) VALUES (?, ?, ?, ?)",
        [profileId, name, dosage, note]
      );
      return {
        id: result.insertId,
        profile_id: profileId,
        name,
        dosage,
        note,
      };
    } finally {
      connection.release();
    }
  }

  static async getMedicationsByUser(hostUserId, roomId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getProfileIdByRoom(roomId, hostUserId);
      if (!profileId) return [];

      const [rows] = await connection.execute(
        `SELECT id, profile_id, name, dosage, note, created_at
         FROM medications
         WHERE profile_id = ?
         ORDER BY id DESC`,
        [profileId]
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async createForUser(hostUserId, roomId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId);

      const medicineName = String(payload.medicine_name || "").trim();
      if (!medicineName) {
        const err = new Error("MEDICINE_NAME_REQUIRED");
        err.code = "MEDICINE_NAME_REQUIRED";
        throw err;
      }

      const normalizedTime = this.normalizeTime(payload.reminder_time);
      if (!normalizedTime) {
        const err = new Error("INVALID_REMINDER_TIME");
        err.code = "INVALID_REMINDER_TIME";
        throw err;
      }

      const dosage = payload.dosage ? String(payload.dosage).trim() : null;
      const note = payload.note ? String(payload.note).trim() : null;
      const repeatType = payload.reminder_date ? "once" : "daily";

      const [medicationResult] = await connection.execute(
        "INSERT INTO medications (profile_id, name, dosage, note) VALUES (?, ?, ?, ?)",
        [profileId, medicineName, dosage, note]
      );

      const medicationId = medicationResult.insertId;
      const [scheduleResult] = await connection.execute(
        "INSERT INTO medication_schedules (medication_id, alarm_time, repeat_type, is_active) VALUES (?, ?, ?, 1)",
        [medicationId, normalizedTime, repeatType]
      );

      return {
        id: scheduleResult.insertId,
        medication_id: medicationId,
        medicine_name: medicineName,
        dosage,
        note,
        reminder_time: normalizedTime,
        reminder_date: payload.reminder_date || null,
        status: "pending",
      };
    } finally {
      connection.release();
    }
  }

  static async getAllByUser(hostUserId, roomId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getProfileIdByRoom(roomId, hostUserId);
      if (!profileId) return [];

      const query = `
        SELECT
          s.id,
          m.id AS medication_id,
          m.name AS medicine_name,
          m.dosage,
          m.note,
          s.alarm_time AS reminder_time,
          s.repeat_type,
          s.is_active,
          CASE
            WHEN EXISTS (
              SELECT 1 FROM medication_logs ml
              WHERE ml.schedule_id = s.id AND ml.status = 'taken'
            ) THEN 'done'
            ELSE 'pending'
          END AS status
        FROM medication_schedules s
        INNER JOIN medications m ON m.id = s.medication_id
        WHERE m.profile_id = ?
        ORDER BY s.alarm_time ASC, s.id DESC
      `;

      const [rows] = await connection.execute(query, [profileId]);
      return rows.map((row) => ({
        id: row.id,
        medication_id: row.medication_id,
        medicine_name: row.medicine_name,
        dosage: row.dosage,
        note: row.note,
        reminder_time: row.reminder_time,
        reminder_date: null,
        status: row.status === "done" ? "done" : "pending",
      }));
    } finally {
      connection.release();
    }
  }

  static async markDone(hostUserId, roomId, scheduleId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getProfileIdByRoom(roomId, hostUserId);
      const [rows] = await connection.execute(
        `SELECT s.id
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );

      if (!rows[0]) return false;

      await connection.execute(
        "INSERT INTO medication_logs (schedule_id, taken_time, status, note) VALUES (?, NOW(), 'taken', ?)",
        [scheduleId, "Đánh dấu đã uống từ ứng dụng"]
      );

      return true;
    } finally {
      connection.release();
    }
  }

  static async updateStatus(hostUserId, roomId, scheduleId, status) {
    if (status !== "done") {
      return false;
    }
    return this.markDone(hostUserId, roomId, scheduleId);
  }

  static async deleteById(hostUserId, roomId, scheduleId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getProfileIdByRoom(roomId, hostUserId);
      const [rows] = await connection.execute(
        `SELECT s.id, s.medication_id
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );

      const found = rows[0];
      if (!found) return false;

      await connection.execute("DELETE FROM medication_logs WHERE schedule_id = ?", [scheduleId]);
      await connection.execute("DELETE FROM medication_schedules WHERE id = ?", [scheduleId]);

      const [remain] = await connection.execute(
        "SELECT COUNT(*) AS total FROM medication_schedules WHERE medication_id = ?",
        [found.medication_id]
      );
      if ((remain[0]?.total || 0) === 0) {
        await connection.execute("DELETE FROM medications WHERE id = ?", [found.medication_id]);
      }

      return true;
    } finally {
      connection.release();
    }
  }
}

module.exports = MedicationReminder;
