const crypto = require("crypto");
const pool = require("../config/database");

const createRoomCode = () =>
  `RM${Date.now().toString(36).toUpperCase()}${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

const createQrToken = (prefix) => `${prefix}_${crypto.randomBytes(16).toString("hex")}`;

class Room {
  static async createByAdmin(adminUserId) {
    const connection = await pool.getConnection();
    try {
      let roomId = createRoomCode();
      for (let i = 0; i < 5; i += 1) {
        const [rows] = await connection.execute("SELECT id FROM rooms WHERE room_id = ? LIMIT 1", [roomId]);
        if (!rows[0]) break;
        roomId = createRoomCode();
      }

      const adminJoinToken = createQrToken("ADMIN");
      const [result] = await connection.execute(
        "INSERT INTO rooms (room_id, admin_user_id, admin_join_token) VALUES (?, ?, ?)",
        [roomId, adminUserId, adminJoinToken]
      );
      return {
        id: result.insertId,
        room_id: roomId,
        admin_user_id: adminUserId,
        admin_join_token: adminJoinToken,
      };
    } finally {
      connection.release();
    }
  }

  static async listByAdmin(adminUserId = null) {
    const connection = await pool.getConnection();
    try {
      const whereClause = adminUserId ? "WHERE r.admin_user_id = ?" : "";
      const params = adminUserId ? [adminUserId] : [];
      const [rows] = await connection.execute(
        `SELECT
           r.id,
           r.room_id,
           r.admin_user_id,
           r.host_user_id,
           r.admin_join_token,
           r.host_join_token,
           r.created_at,
           COALESCE(m.total_members, 0) AS total_members
         FROM rooms r
         LEFT JOIN (
           SELECT room_id, COUNT(*) AS total_members
           FROM room_members
           GROUP BY room_id
         ) m ON m.room_id = r.id
         ${whereClause}
         ORDER BY r.id DESC`,
        params
      );
      return rows;
    } finally {
      connection.release();
    }
  }

  static async findByRoomCode(roomCode) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute("SELECT * FROM rooms WHERE room_id = ? LIMIT 1", [roomCode]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  static async findByHostJoinToken(token) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute("SELECT * FROM rooms WHERE host_join_token = ? LIMIT 1", [token]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  static async countMembers(roomId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const [rows] = await conn.execute("SELECT COUNT(*) AS total FROM room_members WHERE room_id = ?", [roomId]);
      return Number(rows[0]?.total || 0);
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async getMemberByRoomAndUser(roomId, userId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const [rows] = await conn.execute(
        "SELECT * FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
        [roomId, userId]
      );
      return rows[0] || null;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async promoteUserToHostByAdminRoomCode(userId, roomCode) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rooms] = await connection.execute("SELECT * FROM rooms WHERE room_id = ? LIMIT 1 FOR UPDATE", [roomCode]);
      const room = rooms[0];
      if (!room) {
        const error = new Error("ROOM_NOT_FOUND");
        error.code = "ROOM_NOT_FOUND";
        throw error;
      }
      if (room.host_user_id) {
        const error = new Error("ROOM_ALREADY_HAS_HOST");
        error.code = "ROOM_ALREADY_HAS_HOST";
        throw error;
      }

      const existing = await Room.getMemberByRoomAndUser(room.id, userId, connection);
      if (existing && existing.member_role === "caretaker") {
        await connection.execute(
          `UPDATE room_members
           SET member_role = 'host',
               can_manage_medication = 1,
               can_receive_schedule_notifications = 1,
               can_receive_medication_notifications = 1,
               can_view_live = 1
           WHERE room_id = ? AND user_id = ?`,
          [room.id, userId]
        );
      } else if (!existing) {
        await connection.execute(
          `INSERT INTO room_members
           (room_id, user_id, member_role, can_manage_medication, can_receive_schedule_notifications, can_receive_medication_notifications, can_view_live)
           VALUES (?, ?, 'host', 1, 1, 1, 1)`,
          [room.id, userId]
        );
      }
      const hostJoinToken = createQrToken("HOST");
      await connection.execute("UPDATE rooms SET host_user_id = ?, host_join_token = ? WHERE id = ?", [
        userId,
        hostJoinToken,
        room.id,
      ]);
      await connection.commit();
      return { room_id: room.room_id, host_join_token: hostJoinToken };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async joinAsCaretakerByHostToken(userId, hostJoinToken) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rooms] = await connection.execute(
        "SELECT * FROM rooms WHERE host_join_token = ? LIMIT 1 FOR UPDATE",
        [hostJoinToken]
      );
      const room = rooms[0];
      if (!room) {
        const error = new Error("HOST_QR_INVALID");
        error.code = "HOST_QR_INVALID";
        throw error;
      }
      if (!room.host_user_id) {
        const error = new Error("ROOM_HAS_NO_HOST");
        error.code = "ROOM_HAS_NO_HOST";
        throw error;
      }
      if (room.host_user_id === userId) {
        const error = new Error("HOST_CANNOT_JOIN_SELF");
        error.code = "HOST_CANNOT_JOIN_SELF";
        throw error;
      }

      const existing = await Room.getMemberByRoomAndUser(room.id, userId, connection);
      if (!existing) {
        await connection.execute(
          `INSERT INTO room_members
           (room_id, user_id, member_role, can_manage_medication, can_receive_schedule_notifications, can_receive_medication_notifications, can_view_live)
           VALUES (?, ?, 'caretaker', 0, 1, 1, 1)`,
          [room.id, userId]
        );
      } else if (existing.member_role === "caretaker") {
        // already caretaker in this room
      } else {
        const error = new Error("ALREADY_HOST_IN_ROOM");
        error.code = "ALREADY_HOST_IN_ROOM";
        throw error;
      }
      await connection.commit();
      return { room_id: room.room_id, host_user_id: room.host_user_id };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async listRoomsByUser(userId) {
    const connection = await pool.getConnection();
    const sqlWithLive = `SELECT
           r.id,
           r.room_id,
           r.admin_user_id,
           r.host_user_id,
           r.admin_join_token,
           r.host_join_token,
           CASE
             WHEN r.host_user_id = ? THEN 'host'
             ELSE rm.member_role
           END AS member_role,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_manage_medication
           END AS can_manage_medication,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_receive_schedule_notifications
           END AS can_receive_schedule_notifications,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_receive_medication_notifications
           END AS can_receive_medication_notifications,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_view_live, 1)
           END AS can_view_live,
           r.created_at
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE rm.user_id IS NOT NULL OR r.host_user_id = ?
         ORDER BY r.id DESC`;
    const sqlNoLive = `SELECT
           r.id,
           r.room_id,
           r.admin_user_id,
           r.host_user_id,
           r.admin_join_token,
           r.host_join_token,
           CASE
             WHEN r.host_user_id = ? THEN 'host'
             ELSE rm.member_role
           END AS member_role,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_manage_medication
           END AS can_manage_medication,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_receive_schedule_notifications
           END AS can_receive_schedule_notifications,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE rm.can_receive_medication_notifications
           END AS can_receive_medication_notifications,
           r.created_at
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE rm.user_id IS NOT NULL OR r.host_user_id = ?
         ORDER BY r.id DESC`;
    const paramsWithLive = [userId, userId, userId, userId, userId, userId, userId];
    const paramsNoLive = [userId, userId, userId, userId, userId, userId];
    try {
      try {
        const [rows] = await connection.execute(sqlWithLive, paramsWithLive);
        return rows;
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR" && String(e.sqlMessage || "").includes("can_view_live")) {
          const [rows] = await connection.execute(sqlNoLive, paramsNoLive);
          return rows.map((row) => ({ ...row, can_view_live: 1 }));
        }
        throw e;
      }
    } finally {
      connection.release();
    }
  }

  static async listMembers(roomId) {
    const connection = await pool.getConnection();
    const sqlWithLive = `SELECT
           rm.user_id,
           u.username,
           u.full_name AS fullName,
           u.email,
           rm.member_role,
           rm.can_manage_medication,
           rm.can_receive_schedule_notifications,
           rm.can_receive_medication_notifications,
           COALESCE(rm.can_view_live, 1) AS can_view_live
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY FIELD(rm.member_role, 'host', 'caretaker'), rm.user_id ASC`;
    const sqlNoLive = `SELECT
           rm.user_id,
           u.username,
           u.full_name AS fullName,
           u.email,
           rm.member_role,
           rm.can_manage_medication,
           rm.can_receive_schedule_notifications,
           rm.can_receive_medication_notifications
         FROM room_members rm
         INNER JOIN users u ON u.id = rm.user_id
         WHERE rm.room_id = ?
         ORDER BY FIELD(rm.member_role, 'host', 'caretaker'), rm.user_id ASC`;
    try {
      try {
        const [rows] = await connection.execute(sqlWithLive, [roomId]);
        return rows;
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR" && String(e.sqlMessage || "").includes("can_view_live")) {
          const [rows] = await connection.execute(sqlNoLive, [roomId]);
          return rows.map((row) => ({ ...row, can_view_live: 1 }));
        }
        throw e;
      }
    } finally {
      connection.release();
    }
  }

  static async updateCaretakerPermissions(roomId, targetUserId, payload) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT member_role FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
        [roomId, targetUserId]
      );
      const roleNorm = String(rows[0]?.member_role || "")
        .trim()
        .toLowerCase();
      if (!rows[0] || roleNorm !== "caretaker") {
        const error = new Error("CARETAKER_NOT_FOUND");
        error.code = "CARETAKER_NOT_FOUND";
        throw error;
      }

      const canManageMedication =
        payload.can_manage_medication !== undefined ? (payload.can_manage_medication ? 1 : 0) : undefined;
      const canScheduleNotify =
        payload.can_receive_schedule_notifications !== undefined
          ? payload.can_receive_schedule_notifications
            ? 1
            : 0
          : undefined;
      const canMedicationNotify =
        payload.can_receive_medication_notifications !== undefined
          ? payload.can_receive_medication_notifications
            ? 1
            : 0
          : undefined;
      const rawViewLive =
        payload.can_view_live !== undefined
          ? payload.can_view_live
          : payload.canViewLive !== undefined
            ? payload.canViewLive
            : undefined;
      const canViewLive = rawViewLive !== undefined ? (rawViewLive ? 1 : 0) : undefined;

      const fields = [];
      const values = [];
      if (canManageMedication !== undefined) {
        fields.push("can_manage_medication = ?");
        values.push(canManageMedication);
      }
      if (canScheduleNotify !== undefined) {
        fields.push("can_receive_schedule_notifications = ?");
        values.push(canScheduleNotify);
      }
      if (canMedicationNotify !== undefined) {
        fields.push("can_receive_medication_notifications = ?");
        values.push(canMedicationNotify);
      }
      if (canViewLive !== undefined) {
        fields.push("can_view_live = ?");
        values.push(canViewLive);
      }

      if (!fields.length) {
        const error = new Error("NO_PERMISSION_CHANGE");
        error.code = "NO_PERMISSION_CHANGE";
        throw error;
      }

      values.push(roomId, targetUserId);
      try {
        await connection.execute(
          `UPDATE room_members
         SET ${fields.join(", ")}
         WHERE room_id = ? AND user_id = ?`,
          values
        );
      } catch (e) {
        if (e?.code === "ER_BAD_FIELD_ERROR" && String(e.sqlMessage || "").includes("can_view_live")) {
          const idx = fields.findIndex((f) => f.startsWith("can_view_live"));
          const wherePair = values.splice(-2, 2);
          if (idx >= 0) {
            fields.splice(idx, 1);
            values.splice(idx, 1);
          }
          if (!fields.length) {
            const err = new Error("NO_PERMISSION_CHANGE");
            err.code = "NO_PERMISSION_CHANGE";
            throw err;
          }
          values.push(...wherePair);
          await connection.execute(
            `UPDATE room_members
         SET ${fields.join(", ")}
         WHERE room_id = ? AND user_id = ?`,
            values
          );
        } else {
          throw e;
        }
      }
      return true;
    } finally {
      connection.release();
    }
  }

  static async removeCaretaker(roomId, caretakerUserId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.execute(
        "SELECT member_role FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
        [roomId, caretakerUserId]
      );
      if (!rows[0] || rows[0].member_role !== "caretaker") {
        const error = new Error("CARETAKER_NOT_FOUND");
        error.code = "CARETAKER_NOT_FOUND";
        throw error;
      }

      await connection.execute("DELETE FROM room_members WHERE room_id = ? AND user_id = ?", [roomId, caretakerUserId]);
      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async deleteRoomByAdmin(roomId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [roomRows] = await connection.execute("SELECT id FROM rooms WHERE id = ? LIMIT 1 FOR UPDATE", [roomId]);
      if (!roomRows[0]) {
        const error = new Error("ROOM_NOT_FOUND");
        error.code = "ROOM_NOT_FOUND";
        throw error;
      }

      const [memberRows] = await connection.execute("SELECT user_id FROM room_members WHERE room_id = ?", [roomId]);
      const memberUserIds = memberRows.map((m) => Number(m.user_id)).filter((id) => id > 0);

      await connection.execute("DELETE FROM rooms WHERE id = ?", [roomId]);

      await connection.commit();
      return { id: roomId, affected_users: memberUserIds.length };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getRoomPatient(roomId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT room_id, full_name, gender, date_of_birth, note, updated_at
         FROM room_patients
         WHERE room_id = ?
         LIMIT 1`,
        [roomId]
      );
      return rows[0] || null;
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE") return null;
      throw error;
    } finally {
      connection.release();
    }
  }

  static async upsertRoomPatient(roomId, payload) {
    const connection = await pool.getConnection();
    try {
      const fullName = String(payload?.full_name || "").trim();
      const gender = String(payload?.gender || "").trim() || null;
      const dateOfBirth = payload?.date_of_birth || null;
      const note = String(payload?.note || "").trim() || null;
      if (!fullName) {
        const error = new Error("PATIENT_NAME_REQUIRED");
        error.code = "PATIENT_NAME_REQUIRED";
        throw error;
      }

      await connection.execute(
        `INSERT INTO room_patients (room_id, full_name, gender, date_of_birth, note)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           full_name = VALUES(full_name),
           gender = VALUES(gender),
           date_of_birth = VALUES(date_of_birth),
           note = VALUES(note),
           updated_at = CURRENT_TIMESTAMP`,
        [roomId, fullName, gender, dateOfBirth, note]
      );

      return { room_id: roomId, full_name: fullName, gender, date_of_birth: dateOfBirth, note };
    } catch (error) {
      if (error?.code === "ER_NO_SUCH_TABLE") {
        const notAvailable = new Error("ROOM_PATIENT_NOT_AVAILABLE");
        notAvailable.code = "ROOM_PATIENT_NOT_AVAILABLE";
        throw notAvailable;
      }
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = {
  Room,
};
