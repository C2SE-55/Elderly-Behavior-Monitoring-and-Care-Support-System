const pool = require("../config/database");
const { getOrCreateRoomProfileId } = require("../services/roomProfile");

class MedicationSystem {
  static async getOrCreateProfileIdByRoom(roomId, hostUserId, connection = null) {
    return getOrCreateRoomProfileId(roomId, hostUserId, connection);
  }

  static normalizeAlarmTime(alarmTime) {
    const value = String(alarmTime || "").trim();
    if (!value) return null;
    const hhmm = /^([01]\d|2[0-3]):([0-5]\d)$/;
    const hhmmss = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/;
    if (hhmmss.test(value)) return value;
    if (hhmm.test(value)) return `${value}:00`;
    return null;
  }

  static async createMedication(hostUserId, roomId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const name = String(payload?.name || "").trim();
      if (!name) {
        const error = new Error("MEDICATION_NAME_REQUIRED");
        error.code = "MEDICATION_NAME_REQUIRED";
        throw error;
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

  static async getMedications(hostUserId, roomId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
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

  static async updateMedication(hostUserId, roomId, medicationId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT m.id, m.profile_id
         FROM medications m
         WHERE m.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [medicationId, profileId]
      );
      if (!rows[0]) return false;

      const fields = [];
      const values = [];
      if (payload?.name !== undefined) {
        const name = String(payload.name || "").trim();
        if (!name) {
          const error = new Error("MEDICATION_NAME_REQUIRED");
          error.code = "MEDICATION_NAME_REQUIRED";
          throw error;
        }
        fields.push("name = ?");
        values.push(name);
      }
      if (payload?.dosage !== undefined) {
        fields.push("dosage = ?");
        values.push(String(payload.dosage || "").trim() || null);
      }
      if (payload?.note !== undefined) {
        fields.push("note = ?");
        values.push(String(payload.note || "").trim() || null);
      }
      if (!fields.length) return true;

      values.push(medicationId);
      await connection.execute(`UPDATE medications SET ${fields.join(", ")} WHERE id = ?`, values);
      return true;
    } finally {
      connection.release();
    }
  }

  static async deleteMedication(hostUserId, roomId, medicationId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT m.id
         FROM medications m
         WHERE m.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [medicationId, profileId]
      );
      if (!rows[0]) return false;

      const [scheduleRows] = await connection.execute(
        "SELECT id FROM medication_schedules WHERE medication_id = ?",
        [medicationId]
      );
      for (const schedule of scheduleRows) {
        await connection.execute("DELETE FROM medication_logs WHERE schedule_id = ?", [schedule.id]);
      }
      await connection.execute("DELETE FROM medication_schedules WHERE medication_id = ?", [medicationId]);
      await connection.execute("DELETE FROM medications WHERE id = ?", [medicationId]);
      return true;
    } finally {
      connection.release();
    }
  }

  static async createSchedules(hostUserId, roomId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const normalizedTime = this.normalizeAlarmTime(payload?.alarm_time);
      if (!normalizedTime) {
        const error = new Error("INVALID_ALARM_TIME");
        error.code = "INVALID_ALARM_TIME";
        throw error;
      }
      const repeatType = payload?.repeat_type === "once" ? "once" : "daily";
      const medicationItems = Array.isArray(payload?.medications) ? payload.medications : [];
      if (!medicationItems.length) {
        const error = new Error("SCHEDULE_MEDICATIONS_REQUIRED");
        error.code = "SCHEDULE_MEDICATIONS_REQUIRED";
        throw error;
      }

      const createdSchedules = [];

      for (const item of medicationItems) {
        let medicationId = item?.medication_id ? Number(item.medication_id) : null;
        let medicationName = null;

        if (medicationId) {
          const [rows] = await connection.execute(
            `SELECT m.id, m.name, m.dosage, m.note
             FROM medications m
             WHERE m.id = ? AND m.profile_id = ?
             LIMIT 1`,
            [medicationId, profileId]
          );
          if (!rows[0]) {
            const error = new Error("MEDICATION_NOT_FOUND");
            error.code = "MEDICATION_NOT_FOUND";
            throw error;
          }

          const overrideDosage = item?.dosage ? String(item.dosage).trim() : null;
          const overrideNote = item?.note ? String(item.note).trim() : null;
          const baseName = rows[0].name;
          const baseDosage = rows[0].dosage || null;
          const baseNote = rows[0].note || null;

          // Nếu cần liều/ghi chú riêng cho lần uống này, tạo bản ghi medication riêng.
          if ((overrideDosage && overrideDosage !== baseDosage) || (overrideNote && overrideNote !== baseNote)) {
            const [newMedication] = await connection.execute(
              "INSERT INTO medications (profile_id, name, dosage, note) VALUES (?, ?, ?, ?)",
              [profileId, baseName, overrideDosage || baseDosage, overrideNote || baseNote]
            );
            medicationId = newMedication.insertId;
            medicationName = baseName;
          } else {
            medicationName = baseName;
          }
        } else {
          const name = String(item?.name || "").trim();
          if (!name) {
            const error = new Error("MEDICATION_NAME_REQUIRED");
            error.code = "MEDICATION_NAME_REQUIRED";
            throw error;
          }
          const dosage = item?.dosage ? String(item.dosage).trim() : null;
          const note = item?.note ? String(item.note).trim() : null;
          const [newMedication] = await connection.execute(
            "INSERT INTO medications (profile_id, name, dosage, note) VALUES (?, ?, ?, ?)",
            [profileId, name, dosage, note]
          );
          medicationId = newMedication.insertId;
          medicationName = name;
        }

        const [scheduleResult] = await connection.execute(
          `INSERT INTO medication_schedules (medication_id, alarm_time, repeat_type, is_active)
           VALUES (?, ?, ?, 1)`,
          [medicationId, normalizedTime, repeatType]
        );

        createdSchedules.push({
          id: scheduleResult.insertId,
          medication_id: medicationId,
          alarm_time: normalizedTime,
          repeat_type: repeatType,
          medicine_name: medicationName,
        });
      }

      return createdSchedules;
    } finally {
      connection.release();
    }
  }

  static async getTodaySchedules(hostUserId, roomId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const query = `
        SELECT
          s.id,
          s.alarm_time,
          s.repeat_type,
          s.is_active,
          m.id AS medication_id,
          m.name,
          m.dosage,
          m.note,
          (
            SELECT ml.status
            FROM medication_logs ml
            WHERE ml.schedule_id = s.id AND DATE(ml.taken_time) = CURDATE()
            ORDER BY ml.taken_time DESC
            LIMIT 1
          ) AS today_status
        FROM medication_schedules s
        INNER JOIN medications m ON m.id = s.medication_id
        WHERE m.profile_id = ? AND s.is_active = 1
        ORDER BY s.alarm_time ASC, s.id ASC
      `;
      const [rows] = await connection.execute(query, [profileId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  static async updateSchedule(hostUserId, roomId, scheduleId, payload) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT s.id, s.medication_id
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );
      if (!rows[0]) return false;

      const fields = [];
      const values = [];
      if (payload?.alarm_time !== undefined) {
        const normalizedTime = this.normalizeAlarmTime(payload.alarm_time);
        if (!normalizedTime) {
          const error = new Error("INVALID_ALARM_TIME");
          error.code = "INVALID_ALARM_TIME";
          throw error;
        }
        fields.push("alarm_time = ?");
        values.push(normalizedTime);
      }
      if (payload?.repeat_type !== undefined) {
        const repeatType = payload.repeat_type === "once" ? "once" : "daily";
        fields.push("repeat_type = ?");
        values.push(repeatType);
      }
      if (payload?.is_active !== undefined) {
        fields.push("is_active = ?");
        values.push(payload.is_active ? 1 : 0);
      }
      if (fields.length) {
        values.push(scheduleId);
        await connection.execute(
          `UPDATE medication_schedules SET ${fields.join(", ")} WHERE id = ?`,
          values
        );
      }

      if (payload?.dosage !== undefined || payload?.note !== undefined) {
        const medFields = [];
        const medValues = [];
        if (payload?.dosage !== undefined) {
          medFields.push("dosage = ?");
          medValues.push(String(payload.dosage || "").trim() || null);
        }
        if (payload?.note !== undefined) {
          medFields.push("note = ?");
          medValues.push(String(payload.note || "").trim() || null);
        }
        if (medFields.length) {
          medValues.push(rows[0].medication_id);
          await connection.execute(
            `UPDATE medications SET ${medFields.join(", ")} WHERE id = ?`,
            medValues
          );
        }
      }

      return true;
    } finally {
      connection.release();
    }
  }

  static async deleteSchedule(hostUserId, roomId, scheduleId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT s.id, s.medication_id
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );
      if (!rows[0]) return false;

      await connection.execute("DELETE FROM medication_logs WHERE schedule_id = ?", [scheduleId]);
      await connection.execute("DELETE FROM medication_schedules WHERE id = ?", [scheduleId]);

      const [remain] = await connection.execute(
        "SELECT COUNT(*) AS total FROM medication_schedules WHERE medication_id = ?",
        [rows[0].medication_id]
      );
      if ((remain[0]?.total || 0) === 0) {
        await connection.execute("DELETE FROM medications WHERE id = ?", [rows[0].medication_id]);
      }
      return true;
    } finally {
      connection.release();
    }
  }

  static async markSchedule(hostUserId, roomId, scheduleId, status) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT s.id, s.repeat_type
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );
      if (!rows[0]) return false;

      await connection.execute(
        "INSERT INTO medication_logs (schedule_id, taken_time, status, note) VALUES (?, NOW(), ?, ?)",
        [scheduleId, status, `Cập nhật từ app: ${status}`]
      );

      if (rows[0].repeat_type === "once") {
        await connection.execute("UPDATE medication_schedules SET is_active = 0 WHERE id = ?", [scheduleId]);
      }
      return true;
    } finally {
      connection.release();
    }
  }

  static async autoMarkMissed() {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT s.id, s.repeat_type
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.is_active = 1
           AND TIME(s.alarm_time) <= CURTIME()
           AND NOT EXISTS (
             SELECT 1
             FROM medication_logs ml
             WHERE ml.schedule_id = s.id
               AND DATE(ml.taken_time) = CURDATE()
           )`
      );

      for (const row of rows) {
        await connection.execute(
          "INSERT INTO medication_logs (schedule_id, taken_time, status, note) VALUES (?, NOW(), 'missed', ?)",
          [row.id, "Tự động đánh dấu quá giờ"]
        );
        if (row.repeat_type === "once") {
          await connection.execute("UPDATE medication_schedules SET is_active = 0 WHERE id = ?", [row.id]);
        }
      }

      return rows.length;
    } finally {
      connection.release();
    }
  }
}

module.exports = MedicationSystem;
