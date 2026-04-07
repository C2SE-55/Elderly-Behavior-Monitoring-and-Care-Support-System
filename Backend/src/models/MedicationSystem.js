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

  /** Ghi log uống thuốc; nếu DB chưa có cột acted_by_user_id thì INSERT không cột đó (không cần migration). */
  static async insertMedicationLogRow(connection, scheduleId, status, note, actorUserId) {
    try {
      await connection.execute(
        `INSERT INTO medication_logs (schedule_id, taken_time, status, note, acted_by_user_id)
         VALUES (?, NOW(), ?, ?, ?)`,
        [scheduleId, status, note, actorUserId]
      );
    } catch (e) {
      if (e?.code === "ER_BAD_FIELD_ERROR") {
        await connection.execute(
          `INSERT INTO medication_logs (schedule_id, taken_time, status, note)
           VALUES (?, NOW(), ?, ?)`,
          [scheduleId, status, note]
        );
      } else {
        throw e;
      }
    }
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
            ORDER BY
              CASE ml.status
                WHEN 'taken' THEN 1
                WHEN 'skipped' THEN 2
                WHEN 'missed' THEN 3
                ELSE 4
              END ASC,
              ml.taken_time DESC
            LIMIT 1
          ) AS today_status
        FROM medication_schedules s
        INNER JOIN medications m ON m.id = s.medication_id
        WHERE m.profile_id = ?
          AND (
            s.is_active = 1
            OR (
              s.repeat_type = 'once'
              AND EXISTS (
                SELECT 1 FROM medication_logs ml0
                WHERE ml0.schedule_id = s.id
                  AND DATE(ml0.taken_time) = CURDATE()
              )
            )
          )
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

  static async deleteSchedulesForSlot(hostUserId, roomId, alarmTimeRaw) {
    const normalizedTime = this.normalizeAlarmTime(alarmTimeRaw);
    if (!normalizedTime) {
      const error = new Error("INVALID_ALARM_TIME");
      error.code = "INVALID_ALARM_TIME";
      throw error;
    }
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [schedules] = await connection.execute(
        `SELECT s.id, s.medication_id
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE m.profile_id = ?
           AND TIME_FORMAT(s.alarm_time, '%H:%i') = TIME_FORMAT(?, '%H:%i')`,
        [profileId, normalizedTime]
      );
      if (!schedules.length) {
        return { deleted: 0, schedule_ids: [] };
      }

      await connection.beginTransaction();
      try {
        for (const row of schedules) {
          const scheduleId = row.id;
          const medId = row.medication_id;
          await connection.execute("DELETE FROM medication_logs WHERE schedule_id = ?", [scheduleId]);
          await connection.execute("DELETE FROM medication_schedules WHERE id = ?", [scheduleId]);
          const [remain] = await connection.execute(
            "SELECT COUNT(*) AS total FROM medication_schedules WHERE medication_id = ?",
            [medId]
          );
          if ((remain[0]?.total || 0) === 0) {
            await connection.execute("DELETE FROM medications WHERE id = ?", [medId]);
          }
        }
        await connection.commit();
      } catch (e) {
        await connection.rollback();
        throw e;
      }
      return {
        deleted: schedules.length,
        schedule_ids: schedules.map((r) => Number(r.id)),
      };
    } finally {
      connection.release();
    }
  }

  static async markSlot(hostUserId, roomId, alarmTimeRaw, status, actorUserId, dateYmdOpt) {
    const normalizedTime = this.normalizeAlarmTime(alarmTimeRaw);
    if (!normalizedTime) {
      return { ok: false, code: "INVALID_ALARM_TIME" };
    }
    const targetDate =
      dateYmdOpt && /^\d{4}-\d{2}-\d{2}$/.test(String(dateYmdOpt).trim().slice(0, 10))
        ? String(dateYmdOpt).trim().slice(0, 10)
        : null;

    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);

      const [schedules] = await connection.execute(
        `SELECT s.id, s.repeat_type
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE m.profile_id = ?
           AND TIME_FORMAT(s.alarm_time, '%H:%i') = TIME_FORMAT(?, '%H:%i')`,
        [profileId, normalizedTime]
      );

      if (!schedules.length) {
        return { ok: false, code: "SLOT_NOT_FOUND" };
      }

      const allIds = schedules.map((r) => Number(r.id));

      const needsMark = [];
      for (const row of schedules) {
        const sql = targetDate
          ? `SELECT 1 AS ok FROM medication_logs
             WHERE schedule_id = ? AND DATE(taken_time) = ? AND status IN ('taken','skipped') LIMIT 1`
          : `SELECT 1 AS ok FROM medication_logs
             WHERE schedule_id = ? AND DATE(taken_time) = CURDATE() AND status IN ('taken','skipped') LIMIT 1`;
        const params = targetDate ? [row.id, targetDate] : [row.id];
        const [done] = await connection.execute(sql, params);
        if (!done[0]) needsMark.push(row);
      }

      const [drow] = targetDate
        ? await connection.execute("SELECT ? AS d", [targetDate])
        : await connection.execute("SELECT DATE(NOW()) AS d", []);
      const intakeDate = String(drow[0]?.d || "").slice(0, 10);

      const [urows] = await connection.execute(
        "SELECT COALESCE(full_name, username) AS nm FROM users WHERE id = ? LIMIT 1",
        [actorUserId]
      );
      const actedByName = urows[0]?.nm ? String(urows[0].nm) : `User #${actorUserId}`;

      if (!needsMark.length) {
        const placeholders = allIds.map(() => "?").join(",");
        const sql = targetDate
          ? `SELECT ml.status
             FROM medication_logs ml
             WHERE ml.schedule_id IN (${placeholders})
               AND DATE(ml.taken_time) = ?
               AND ml.status IN ('taken','skipped')
             ORDER BY ml.taken_time DESC
             LIMIT 1`
          : `SELECT ml.status
             FROM medication_logs ml
             WHERE ml.schedule_id IN (${placeholders})
               AND DATE(ml.taken_time) = CURDATE()
               AND ml.status IN ('taken','skipped')
             ORDER BY ml.taken_time DESC
             LIMIT 1`;
        const params = targetDate ? [...allIds, targetDate] : allIds;
        const [st] = await connection.execute(sql, params);
        return {
          ok: true,
          inserted: false,
          schedule_ids: allIds,
          status: st[0] ? String(st[0].status) : status,
          intake_date: intakeDate,
          acted_by_user_id: null,
          acted_by_name: null,
          alarm_time: normalizedTime.slice(0, 5),
        };
      }

      await connection.beginTransaction();
      try {
        for (const row of needsMark) {
          await this.insertMedicationLogRow(
            connection,
            row.id,
            status,
            `Cập nhật từ app (slot): ${status}`,
            actorUserId
          );
          if (row.repeat_type === "once") {
            await connection.execute("UPDATE medication_schedules SET is_active = 0 WHERE id = ?", [row.id]);
          }
        }
        await connection.commit();
      } catch (e) {
        await connection.rollback();
        throw e;
      }

      return {
        ok: true,
        inserted: true,
        schedule_ids: allIds,
        status,
        intake_date: intakeDate,
        acted_by_user_id: actorUserId,
        acted_by_name: actedByName,
        alarm_time: normalizedTime.slice(0, 5),
      };
    } finally {
      connection.release();
    }
  }

  static resolveMedicationStatsRange(period, anchorYmd) {
    const raw = String(anchorYmd || "").trim().slice(0, 10);
    const parts = raw.split("-").map((x) => Number(x));
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
    const [y, mo, d] = parts;
    const anchor = new Date(y, mo - 1, d);
    if (Number.isNaN(anchor.getTime())) return null;
    const pad = (n) => String(n).padStart(2, "0");
    const toYmd = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;

    const p = String(period || "day").toLowerCase();
    if (p === "day") {
      const s = toYmd(anchor);
      return { start: s, end: s, period: "day" };
    }
    if (p === "week") {
      const day = anchor.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const start = new Date(anchor);
      start.setDate(start.getDate() + offset);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return { start: toYmd(start), end: toYmd(end), period: "week" };
    }
    if (p === "month") {
      const start = new Date(y, mo - 1, 1);
      const end = new Date(y, mo, 0);
      return { start: toYmd(start), end: toYmd(end), period: "month" };
    }
    return null;
  }

  static async listMedicationIntakeStats(hostUserId, roomId, period, anchorYmd) {
    const range = this.resolveMedicationStatsRange(period, anchorYmd);
    if (!range) {
      const err = new Error("INVALID_STATS_RANGE");
      err.code = "INVALID_STATS_RANGE";
      throw err;
    }
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const params = [profileId, range.start, range.end];
      const sqlWithActor = `SELECT
           ml.id AS log_id,
           ml.taken_time,
           ml.status,
           ml.acted_by_user_id,
           COALESCE(u.full_name, u.username) AS acted_by_name,
           s.id AS schedule_id,
           TIME_FORMAT(s.alarm_time, '%H:%i') AS alarm_time,
           m.name AS medication_name
         FROM medication_logs ml
         INNER JOIN medication_schedules s ON s.id = ml.schedule_id
         INNER JOIN medications m ON m.id = s.medication_id
         LEFT JOIN users u ON u.id = ml.acted_by_user_id
         WHERE m.profile_id = ?
           AND ml.status IN ('taken', 'skipped')
           AND DATE(ml.taken_time) >= ?
           AND DATE(ml.taken_time) <= ?
         ORDER BY ml.taken_time DESC`;
      const sqlNoActor = `SELECT
           ml.id AS log_id,
           ml.taken_time,
           ml.status,
           s.id AS schedule_id,
           TIME_FORMAT(s.alarm_time, '%H:%i') AS alarm_time,
           m.name AS medication_name
         FROM medication_logs ml
         INNER JOIN medication_schedules s ON s.id = ml.schedule_id
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE m.profile_id = ?
           AND ml.status IN ('taken', 'skipped')
           AND DATE(ml.taken_time) >= ?
           AND DATE(ml.taken_time) <= ?
         ORDER BY ml.taken_time DESC`;
      let rows;
      try {
        [rows] = await connection.execute(sqlWithActor, params);
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR") {
          [rows] = await connection.execute(sqlNoActor, params);
        } else {
          throw e;
        }
      }
      return {
        range: { start: range.start, end: range.end, period: range.period },
        items: rows.map((row) => ({
          log_id: Number(row.log_id),
          taken_time: row.taken_time,
          status: String(row.status || ""),
          schedule_id: Number(row.schedule_id),
          alarm_time: String(row.alarm_time || "").slice(0, 5),
          medication_name: row.medication_name ? String(row.medication_name) : "",
          acted_by_user_id: row.acted_by_user_id != null ? Number(row.acted_by_user_id) : null,
          acted_by_name: row.acted_by_name ? String(row.acted_by_name) : null,
        })),
      };
    } finally {
      connection.release();
    }
  }

  static async markSchedule(hostUserId, roomId, scheduleId, status, actorUserId) {
    const connection = await pool.getConnection();
    try {
      const profileId = await this.getOrCreateProfileIdByRoom(roomId, hostUserId, connection);
      const [rows] = await connection.execute(
        `SELECT s.id, s.repeat_type, m.name AS medication_name
         FROM medication_schedules s
         INNER JOIN medications m ON m.id = s.medication_id
         WHERE s.id = ? AND m.profile_id = ?
         LIMIT 1`,
        [scheduleId, profileId]
      );
      if (!rows[0]) return { ok: false };

      const [dup] = await connection.execute(
        `SELECT ml.status
         FROM medication_logs ml
         WHERE ml.schedule_id = ?
           AND DATE(ml.taken_time) = CURDATE()
           AND ml.status IN ('taken', 'skipped')
         ORDER BY ml.taken_time DESC
         LIMIT 1`,
        [scheduleId]
      );

      const [drow] = await connection.execute("SELECT DATE(NOW()) AS d");
      const intakeDate = String(drow[0]?.d || "").slice(0, 10);

      if (dup[0]) {
        return {
          ok: true,
          inserted: false,
          duplicate: true,
          schedule_id: scheduleId,
          status: String(dup[0].status),
          intake_date: intakeDate,
          acted_by_user_id: null,
          acted_by_name: null,
          medication_name: rows[0].medication_name ? String(rows[0].medication_name) : "",
        };
      }

      const [urows] = await connection.execute(
        "SELECT COALESCE(full_name, username) AS nm FROM users WHERE id = ? LIMIT 1",
        [actorUserId]
      );
      const actedByName = urows[0]?.nm ? String(urows[0].nm) : `User #${actorUserId}`;

      await this.insertMedicationLogRow(
        connection,
        scheduleId,
        status,
        `Cập nhật từ app: ${status}`,
        actorUserId
      );

      if (rows[0].repeat_type === "once") {
        await connection.execute("UPDATE medication_schedules SET is_active = 0 WHERE id = ?", [scheduleId]);
      }

      return {
        ok: true,
        inserted: true,
        duplicate: false,
        schedule_id: scheduleId,
        status,
        intake_date: intakeDate,
        acted_by_user_id: actorUserId,
        acted_by_name: actedByName,
        medication_name: rows[0].medication_name ? String(rows[0].medication_name) : "",
      };
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
