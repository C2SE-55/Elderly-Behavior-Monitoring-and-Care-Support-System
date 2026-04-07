const pool = require("../config/database");

const sanitizeMessage = (text) => String(text || "").trim().replace(/\s+\n/g, "\n").slice(0, 2000);
let schemaReady = false;
let schemaEnsuring = null;

const ensureIndex = async (conn, tableName, indexName, ddl) => {
  const [rows] = await conn.execute(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await conn.execute(ddl);
};

const ensureChatSchema = async (connection = null) => {
  if (schemaReady) return;
  if (schemaEnsuring) {
    await schemaEnsuring;
    return;
  }
  const run = async () => {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS room_messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          room_id INT NOT NULL,
          sender_user_id INT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS room_message_reads (
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES room_messages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS room_notes (
          id INT PRIMARY KEY AUTO_INCREMENT,
          room_id INT NOT NULL,
          created_by_user_id INT NOT NULL,
          title VARCHAR(150) NULL,
          content TEXT NOT NULL,
          is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
          FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await ensureIndex(
        conn,
        "room_messages",
        "idx_room_messages_room_id_id",
        "CREATE INDEX idx_room_messages_room_id_id ON room_messages(room_id, id)"
      );
      await ensureIndex(
        conn,
        "room_messages",
        "idx_room_messages_created_at",
        "CREATE INDEX idx_room_messages_created_at ON room_messages(created_at)"
      );
      await ensureIndex(
        conn,
        "room_message_reads",
        "idx_reads_user_message",
        "CREATE INDEX idx_reads_user_message ON room_message_reads(user_id, message_id)"
      );
      await ensureIndex(
        conn,
        "room_notes",
        "idx_room_notes_room_id",
        "CREATE INDEX idx_room_notes_room_id ON room_notes(room_id)"
      );
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS room_chat_notification_prefs (
          room_id INT NOT NULL,
          user_id INT NOT NULL,
          chat_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (room_id, user_id),
          FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await ensureIndex(
        conn,
        "room_chat_notification_prefs",
        "idx_room_chat_notif_user",
        "CREATE INDEX idx_room_chat_notif_user ON room_chat_notification_prefs(user_id)"
      );
      schemaReady = true;
    } finally {
      if (ownConnection) conn.release();
    }
  };

  schemaEnsuring = run();
  try {
    await schemaEnsuring;
  } finally {
    schemaEnsuring = null;
  }
};

class RoomChat {
  static async listRoomParticipantUserIds(roomId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await ensureChatSchema(conn);
      const [rows] = await conn.execute(
        `SELECT DISTINCT user_id
         FROM (
           SELECT host_user_id AS user_id
           FROM rooms
           WHERE id = ?
             AND host_user_id IS NOT NULL
           UNION ALL
           SELECT user_id
           FROM room_members
           WHERE room_id = ?
         ) t`,
        [roomId, roomId]
      );
      return rows.map((x) => Number(x.user_id)).filter((x) => x > 0);
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async getRoomAccess(roomId, userId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await ensureChatSchema(conn);
      const [rows] = await conn.execute(
        `SELECT
           r.id AS room_id,
           r.room_id AS room_code,
           CASE
             WHEN r.host_user_id = ? THEN 'host'
             ELSE rm.member_role
           END AS room_role
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE r.id = ?
           AND (r.host_user_id = ? OR rm.user_id IS NOT NULL)
         LIMIT 1`,
        [userId, userId, roomId, userId]
      );
      return rows[0] || null;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async listMessages(roomId, userId, options = {}) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const limitRaw = Number(options.limit || 100);
      const limit = Number.isNaN(limitRaw) ? 100 : Math.max(1, Math.min(100, limitRaw));
      const beforeId = Number(options.beforeId || 0);
      const safeRoomId = Number(roomId || 0);
      const safeLimit = Number(limit || 100);
      const safeBeforeId = Number(beforeId || 0);

      let sql = `SELECT
                   m.id,
                   m.room_id,
                   m.sender_user_id,
                   u.full_name,
                   u.username,
                   m.content,
                   m.created_at
                 FROM room_messages m
                 INNER JOIN users u ON u.id = m.sender_user_id
                 WHERE m.room_id = ?
                   AND m.deleted_at IS NULL`;
      const params = [safeRoomId];
      if (safeBeforeId > 0) {
        sql += ` AND m.id < ${safeBeforeId}`;
      }
      sql += ` ORDER BY m.id DESC LIMIT ${safeLimit}`;

      const [rowsDesc] = await connection.execute(sql, params);
      const rows = [...rowsDesc].reverse();
      if (!rows.length) {
        return { items: [], has_more: false, next_before_id: null };
      }

      const ids = rows.map((x) => Number(x.id)).filter((x) => x > 0);
      const placeholders = ids.map(() => "?").join(", ");
      const [readRows] = await connection.execute(
        `SELECT
           r.message_id,
           r.user_id,
           r.read_at,
           u.full_name,
           u.username
         FROM room_message_reads r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.message_id IN (${placeholders})
         ORDER BY r.read_at ASC`,
        ids
      );

      const readMap = new Map();
      for (const read of readRows) {
        const key = Number(read.message_id);
        if (!readMap.has(key)) readMap.set(key, []);
        readMap.get(key).push({
          user_id: Number(read.user_id),
          user_name: read.full_name || read.username || `User #${read.user_id}`,
          read_at: read.read_at,
        });
      }

      const items = rows.map((row) => ({
        id: Number(row.id),
        room_id: Number(row.room_id),
        sender_user_id: Number(row.sender_user_id),
        sender_name: row.full_name || row.username || `User #${row.sender_user_id}`,
        content: row.content,
        created_at: row.created_at,
        seen_by: readMap.get(Number(row.id)) || [],
        is_mine: Number(row.sender_user_id) === Number(userId),
      }));

      const nextBeforeId = Number(items[0]?.id || 0) || null;
      return {
        items,
        has_more: rowsDesc.length === limit,
        next_before_id: nextBeforeId,
      };
    } finally {
      connection.release();
    }
  }

  static async createMessage(roomId, senderUserId, content) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const normalized = sanitizeMessage(content);
      const [result] = await connection.execute(
        "INSERT INTO room_messages (room_id, sender_user_id, content) VALUES (?, ?, ?)",
        [roomId, senderUserId, normalized]
      );
      const messageId = Number(result.insertId);
      await connection.execute(
        "INSERT IGNORE INTO room_message_reads (message_id, user_id, read_at) VALUES (?, ?, NOW())",
        [messageId, senderUserId]
      );

      const [rows] = await connection.execute(
        `SELECT
           m.id,
           m.room_id,
           m.sender_user_id,
           u.full_name,
           u.username,
           m.content,
           m.created_at
         FROM room_messages m
         INNER JOIN users u ON u.id = m.sender_user_id
         WHERE m.id = ?
         LIMIT 1`,
        [messageId]
      );
      const row = rows[0];
      return {
        id: Number(row.id),
        room_id: Number(row.room_id),
        sender_user_id: Number(row.sender_user_id),
        sender_name: row.full_name || row.username || `User #${row.sender_user_id}`,
        content: row.content,
        created_at: row.created_at,
        seen_by: [
          {
            user_id: Number(senderUserId),
            user_name: row.full_name || row.username || `User #${row.sender_user_id}`,
            read_at: row.created_at,
          },
        ],
      };
    } finally {
      connection.release();
    }
  }

  static async markRead(roomId, userId, payload = {}) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const messageIdsRaw = Array.isArray(payload.message_ids) ? payload.message_ids : [];
      const messageIds = messageIdsRaw
        .map((x) => Number(x))
        .filter((x) => !Number.isNaN(x) && x > 0);
      const readUntilId = Number(payload.read_until_id || 0);

      if (!messageIds.length && !readUntilId) {
        return { read_count: 0, seen_updates: [] };
      }

      let idsToMark = messageIds;
      if (readUntilId > 0) {
        const [rows] = await connection.execute(
          `SELECT id
           FROM room_messages
           WHERE room_id = ?
             AND id <= ?
             AND deleted_at IS NULL`,
          [roomId, readUntilId]
        );
        const untilIds = rows.map((x) => Number(x.id));
        idsToMark = Array.from(new Set([...idsToMark, ...untilIds]));
      }
      if (!idsToMark.length) {
        return { read_count: 0, seen_updates: [] };
      }

      const placeholders = idsToMark.map(() => "(?, ?, NOW())").join(", ");
      const values = [];
      idsToMark.forEach((id) => values.push(id, userId));
      await connection.execute(
        `INSERT IGNORE INTO room_message_reads (message_id, user_id, read_at) VALUES ${placeholders}`,
        values
      );

      const inClause = idsToMark.map(() => "?").join(", ");
      const [seenRows] = await connection.execute(
        `SELECT
           r.message_id,
           r.user_id,
           r.read_at,
           u.full_name,
           u.username
         FROM room_message_reads r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.message_id IN (${inClause})
         ORDER BY r.read_at ASC`,
        idsToMark
      );

      const grouped = new Map();
      for (const row of seenRows) {
        const messageId = Number(row.message_id);
        if (!grouped.has(messageId)) grouped.set(messageId, []);
        grouped.get(messageId).push({
          user_id: Number(row.user_id),
          user_name: row.full_name || row.username || `User #${row.user_id}`,
          read_at: row.read_at,
        });
      }

      return {
        read_count: idsToMark.length,
        seen_updates: Array.from(grouped.entries()).map(([message_id, seen_by]) => ({
          message_id,
          seen_by,
        })),
      };
    } finally {
      connection.release();
    }
  }

  static async getUnreadCount(roomId, userId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        `SELECT COUNT(*) AS total
         FROM room_messages m
         LEFT JOIN room_message_reads r
           ON r.message_id = m.id
          AND r.user_id = ?
         WHERE m.room_id = ?
           AND m.sender_user_id <> ?
           AND m.deleted_at IS NULL
           AND r.message_id IS NULL`,
        [userId, roomId, userId]
      );
      return Number(rows[0]?.total || 0);
    } finally {
      connection.release();
    }
  }

  static async getUnreadSummary(userId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        `SELECT
           ar.id AS room_id,
           ar.room_id AS room_name,
           COALESCE(uc.unread_count, 0) AS unread_count,
           lm.id AS last_message_id,
           lm.sender_user_id AS last_sender_user_id,
           lu.full_name AS last_sender_full_name,
           lu.username AS last_sender_username,
           lm.content AS last_content,
           lm.created_at AS last_sent_at
         FROM (
           SELECT DISTINCT r.id, r.room_id
           FROM rooms r
           LEFT JOIN room_members rm
             ON rm.room_id = r.id
            AND rm.user_id = ?
           WHERE r.host_user_id = ? OR rm.user_id IS NOT NULL
         ) ar
         LEFT JOIN (
           SELECT m1.*
           FROM room_messages m1
           INNER JOIN (
             SELECT room_id, MAX(id) AS max_id
             FROM room_messages
             WHERE deleted_at IS NULL
             GROUP BY room_id
           ) latest
             ON latest.room_id = m1.room_id
            AND latest.max_id = m1.id
           WHERE m1.deleted_at IS NULL
         ) lm
           ON lm.room_id = ar.id
         LEFT JOIN users lu
           ON lu.id = lm.sender_user_id
         LEFT JOIN (
           SELECT
             m.room_id,
             COUNT(*) AS unread_count
           FROM room_messages m
           LEFT JOIN room_message_reads rr
             ON rr.message_id = m.id
            AND rr.user_id = ?
           WHERE m.deleted_at IS NULL
             AND m.sender_user_id <> ?
             AND rr.message_id IS NULL
           GROUP BY m.room_id
         ) uc
           ON uc.room_id = ar.id
         ORDER BY lm.created_at DESC, ar.id DESC`,
        [userId, userId, userId, userId]
      );
      return rows.map((row) => ({
        room_id: Number(row.room_id),
        room_name: row.room_name,
        unread_count: Number(row.unread_count || 0),
        last_message_id: row.last_message_id ? Number(row.last_message_id) : null,
        last_sender_user_id: row.last_sender_user_id ? Number(row.last_sender_user_id) : null,
        last_sender_name: row.last_sender_user_id
          ? row.last_sender_full_name || row.last_sender_username || `User #${row.last_sender_user_id}`
          : null,
        last_content: row.last_content ? String(row.last_content) : null,
        last_sent_at: row.last_sent_at || null,
      }));
    } finally {
      connection.release();
    }
  }

  static async listChatNotificationPrefsForUser(userId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        `SELECT
           ar.id AS room_id,
           COALESCE(p.chat_notifications_enabled, 1) AS chat_notifications_enabled
         FROM (
           SELECT DISTINCT r.id
           FROM rooms r
           LEFT JOIN room_members rm
             ON rm.room_id = r.id
            AND rm.user_id = ?
           WHERE r.host_user_id = ? OR rm.user_id IS NOT NULL
         ) ar
         LEFT JOIN room_chat_notification_prefs p
           ON p.room_id = ar.id
          AND p.user_id = ?`,
        [userId, userId, userId]
      );
      return rows.map((row) => ({
        room_id: Number(row.room_id),
        chat_notifications_enabled: !!Number(row.chat_notifications_enabled ?? 1),
      }));
    } finally {
      connection.release();
    }
  }

  static async getChatNotificationPref(roomId, userId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        `SELECT chat_notifications_enabled
         FROM room_chat_notification_prefs
         WHERE room_id = ? AND user_id = ?
         LIMIT 1`,
        [roomId, userId]
      );
      if (!rows[0]) {
        return { chat_notifications_enabled: true };
      }
      return { chat_notifications_enabled: !!Number(rows[0].chat_notifications_enabled) };
    } finally {
      connection.release();
    }
  }

  static async setChatNotificationPref(roomId, userId, enabled) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const flag = enabled ? 1 : 0;
      await connection.execute(
        `INSERT INTO room_chat_notification_prefs (room_id, user_id, chat_notifications_enabled)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE chat_notifications_enabled = VALUES(chat_notifications_enabled), updated_at = CURRENT_TIMESTAMP`,
        [roomId, userId, flag]
      );
      return { chat_notifications_enabled: !!flag };
    } finally {
      connection.release();
    }
  }

  static async listNotes(roomId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        `SELECT
           n.id,
           n.room_id,
           n.created_by_user_id,
           u.full_name,
           u.username,
           n.title,
           n.content,
           n.is_pinned,
           n.created_at,
           n.updated_at
         FROM room_notes n
         INNER JOIN users u ON u.id = n.created_by_user_id
         WHERE n.room_id = ?
           AND n.deleted_at IS NULL
         ORDER BY n.is_pinned DESC, n.updated_at DESC, n.id DESC`,
        [roomId]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        room_id: Number(row.room_id),
        created_by_user_id: Number(row.created_by_user_id),
        created_by_name: row.full_name || row.username || `User #${row.created_by_user_id}`,
        title: row.title || "",
        content: row.content || "",
        is_pinned: !!row.is_pinned,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } finally {
      connection.release();
    }
  }

  static async createNote(roomId, userId, payload = {}) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const title = String(payload.title || "").trim().slice(0, 150) || null;
      const content = String(payload.content || "").trim().slice(0, 4000);
      const isPinned = payload.is_pinned ? 1 : 0;
      const [result] = await connection.execute(
        "INSERT INTO room_notes (room_id, created_by_user_id, title, content, is_pinned) VALUES (?, ?, ?, ?, ?)",
        [roomId, userId, title, content, isPinned]
      );
      const noteId = Number(result.insertId);
      const rows = await this.listNotes(roomId);
      return rows.find((x) => x.id === noteId) || null;
    } finally {
      connection.release();
    }
  }

  static async updateNote(roomId, noteId, payload = {}) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [rows] = await connection.execute(
        "SELECT id FROM room_notes WHERE id = ? AND room_id = ? AND deleted_at IS NULL LIMIT 1",
        [noteId, roomId]
      );
      if (!rows[0]) return null;

      const fields = [];
      const values = [];
      if (payload.title !== undefined) {
        fields.push("title = ?");
        values.push(String(payload.title || "").trim().slice(0, 150) || null);
      }
      if (payload.content !== undefined) {
        fields.push("content = ?");
        values.push(String(payload.content || "").trim().slice(0, 4000));
      }
      if (payload.is_pinned !== undefined) {
        fields.push("is_pinned = ?");
        values.push(payload.is_pinned ? 1 : 0);
      }
      if (!fields.length) return null;
      values.push(noteId, roomId);

      await connection.execute(
        `UPDATE room_notes
         SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND room_id = ?`,
        values
      );
      const notes = await this.listNotes(roomId);
      return notes.find((x) => x.id === Number(noteId)) || null;
    } finally {
      connection.release();
    }
  }

  static async deleteNote(roomId, noteId) {
    const connection = await pool.getConnection();
    try {
      await ensureChatSchema(connection);
      const [result] = await connection.execute(
        "UPDATE room_notes SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND room_id = ? AND deleted_at IS NULL",
        [noteId, roomId]
      );
      return Number(result.affectedRows || 0) > 0;
    } finally {
      connection.release();
    }
  }
}

module.exports = {
  RoomChat,
  sanitizeMessage,
};
