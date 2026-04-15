const pool = require("../config/database");

const sanitizeMessage = (text) => String(text || "").trim().replace(/\s+\n/g, "\n").slice(0, 2000);

let schemaReady = false;
let schemaEnsuring = null;

const ensureIndex = async (conn, tableName, indexName, ddl) => {
  const [rows] = await conn.execute(`SHOW INDEX FROM ${tableName} WHERE Key_name = ?`, [indexName]);
  if (Array.isArray(rows) && rows.length > 0) return;
  await conn.execute(ddl);
};

const ensureSupportSchema = async (connection = null) => {
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
        `CREATE TABLE IF NOT EXISTS support_conversations (
          id INT PRIMARY KEY AUTO_INCREMENT,
          user_id INT NOT NULL UNIQUE,
          assigned_admin_user_id INT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (assigned_admin_user_id) REFERENCES users(id) ON DELETE SET NULL
        )`
      );
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS support_messages (
          id INT PRIMARY KEY AUTO_INCREMENT,
          conversation_id INT NOT NULL,
          sender_user_id INT NOT NULL,
          content TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          deleted_at DATETIME NULL,
          FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE,
          FOREIGN KEY (sender_user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await conn.execute(
        `CREATE TABLE IF NOT EXISTS support_message_reads (
          message_id INT NOT NULL,
          user_id INT NOT NULL,
          read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (message_id, user_id),
          FOREIGN KEY (message_id) REFERENCES support_messages(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )`
      );
      await ensureIndex(
        conn,
        "support_messages",
        "idx_support_messages_conversation_id_id",
        "CREATE INDEX idx_support_messages_conversation_id_id ON support_messages(conversation_id, id)"
      );
      await ensureIndex(
        conn,
        "support_message_reads",
        "idx_support_reads_user_message",
        "CREATE INDEX idx_support_reads_user_message ON support_message_reads(user_id, message_id)"
      );
      await ensureIndex(
        conn,
        "support_conversations",
        "idx_support_conversations_updated_at",
        "CREATE INDEX idx_support_conversations_updated_at ON support_conversations(updated_at)"
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

class SupportChat {
  static async listAdminUserIds(connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await ensureSupportSchema(conn);
      const [rows] = await conn.execute(
        `SELECT DISTINCT ur.user_id
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE r.name = 'admin'`
      );
      return rows.map((x) => Number(x.user_id)).filter((x) => x > 0);
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async ensureConversationForUser(userId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await ensureSupportSchema(conn);
      const uid = Number(userId || 0);
      await conn.execute(
        `INSERT INTO support_conversations (user_id)
         VALUES (?)
         ON DUPLICATE KEY UPDATE updated_at = updated_at`,
        [uid]
      );
      const [rows] = await conn.execute(
        `SELECT
           c.id,
           c.user_id,
           c.assigned_admin_user_id,
           c.created_at,
           c.updated_at,
           u.full_name,
           u.username
         FROM support_conversations c
         INNER JOIN users u ON u.id = c.user_id
         WHERE c.user_id = ?
         LIMIT 1`,
        [uid]
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        user_id: Number(row.user_id),
        user_name: row.full_name || row.username || `User #${row.user_id}`,
        assigned_admin_user_id: row.assigned_admin_user_id ? Number(row.assigned_admin_user_id) : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async getConversationById(conversationId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      await ensureSupportSchema(conn);
      const cid = Number(conversationId || 0);
      const [rows] = await conn.execute(
        `SELECT
           c.id,
           c.user_id,
           c.assigned_admin_user_id,
           c.created_at,
           c.updated_at,
           u.full_name,
           u.username
         FROM support_conversations c
         INNER JOIN users u ON u.id = c.user_id
         WHERE c.id = ?
         LIMIT 1`,
        [cid]
      );
      const row = rows[0];
      if (!row) return null;
      return {
        id: Number(row.id),
        user_id: Number(row.user_id),
        user_name: row.full_name || row.username || `User #${row.user_id}`,
        assigned_admin_user_id: row.assigned_admin_user_id ? Number(row.assigned_admin_user_id) : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async resolveConversationForRequest({ requesterUserId, requesterRole, targetUserId }) {
    const role = String(requesterRole || "").toLowerCase();
    if (role === "admin") {
      const uid = Number(targetUserId || 0);
      if (!uid) return null;
      return this.ensureConversationForUser(uid);
    }
    return this.ensureConversationForUser(requesterUserId);
  }

  static async canAccessConversation(conversationId, userId, role) {
    const conv = await this.getConversationById(conversationId);
    if (!conv) return false;
    if (String(role || "").toLowerCase() === "admin") return true;
    return Number(conv.user_id) === Number(userId);
  }

  static async listMessages(conversationId, userId, options = {}) {
    const conn = await pool.getConnection();
    try {
      await ensureSupportSchema(conn);
      const cid = Number(conversationId || 0);
      const limitRaw = Number(options.limit || 100);
      const limit = Number.isNaN(limitRaw) ? 100 : Math.max(1, Math.min(100, limitRaw));
      const beforeId = Number(options.beforeId || 0);

      let sql = `SELECT
                   m.id,
                   m.conversation_id,
                   m.sender_user_id,
                   u.full_name,
                   u.username,
                   m.content,
                   m.created_at
                 FROM support_messages m
                 INNER JOIN users u ON u.id = m.sender_user_id
                 WHERE m.conversation_id = ?
                   AND m.deleted_at IS NULL`;
      if (beforeId > 0) sql += ` AND m.id < ${beforeId}`;
      sql += ` ORDER BY m.id DESC LIMIT ${limit}`;
      const [rowsDesc] = await conn.execute(sql, [cid]);
      const rows = [...rowsDesc].reverse();
      if (!rows.length) {
        return { items: [], has_more: false, next_before_id: null };
      }

      const ids = rows.map((x) => Number(x.id)).filter((x) => x > 0);
      const placeholders = ids.map(() => "?").join(", ");
      const [readRows] = await conn.execute(
        `SELECT
           r.message_id,
           r.user_id,
           r.read_at,
           u.full_name,
           u.username
         FROM support_message_reads r
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
        conversation_id: Number(row.conversation_id),
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
      conn.release();
    }
  }

  static async createMessage(conversationId, senderUserId, content) {
    const conn = await pool.getConnection();
    try {
      await ensureSupportSchema(conn);
      const cid = Number(conversationId || 0);
      const sender = Number(senderUserId || 0);
      const normalized = sanitizeMessage(content);
      const [result] = await conn.execute(
        "INSERT INTO support_messages (conversation_id, sender_user_id, content) VALUES (?, ?, ?)",
        [cid, sender, normalized]
      );
      const messageId = Number(result.insertId);
      await conn.execute(
        "INSERT IGNORE INTO support_message_reads (message_id, user_id, read_at) VALUES (?, ?, NOW())",
        [messageId, sender]
      );
      await conn.execute("UPDATE support_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [cid]);

      const [rows] = await conn.execute(
        `SELECT
           m.id,
           m.conversation_id,
           m.sender_user_id,
           u.full_name,
           u.username,
           m.content,
           m.created_at
         FROM support_messages m
         INNER JOIN users u ON u.id = m.sender_user_id
         WHERE m.id = ?
         LIMIT 1`,
        [messageId]
      );
      const row = rows[0];
      return {
        id: Number(row.id),
        conversation_id: Number(row.conversation_id),
        sender_user_id: Number(row.sender_user_id),
        sender_name: row.full_name || row.username || `User #${row.sender_user_id}`,
        content: row.content,
        created_at: row.created_at,
        seen_by: [
          {
            user_id: sender,
            user_name: row.full_name || row.username || `User #${row.sender_user_id}`,
            read_at: row.created_at,
          },
        ],
      };
    } finally {
      conn.release();
    }
  }

  static async markRead(conversationId, userId, payload = {}) {
    const conn = await pool.getConnection();
    try {
      await ensureSupportSchema(conn);
      const cid = Number(conversationId || 0);
      const uid = Number(userId || 0);
      const messageIdsRaw = Array.isArray(payload.message_ids) ? payload.message_ids : [];
      const messageIds = messageIdsRaw
        .map((x) => Number(x))
        .filter((x) => !Number.isNaN(x) && x > 0);
      const readUntilId = Number(payload.read_until_id || 0);

      if (!messageIds.length && !readUntilId) return { read_count: 0, seen_updates: [] };

      let idsToMark = messageIds;
      if (readUntilId > 0) {
        const [rows] = await conn.execute(
          `SELECT id
           FROM support_messages
           WHERE conversation_id = ?
             AND id <= ?
             AND deleted_at IS NULL`,
          [cid, readUntilId]
        );
        const untilIds = rows.map((x) => Number(x.id));
        idsToMark = Array.from(new Set([...idsToMark, ...untilIds]));
      }
      if (!idsToMark.length) return { read_count: 0, seen_updates: [] };

      const placeholders = idsToMark.map(() => "(?, ?, NOW())").join(", ");
      const values = [];
      idsToMark.forEach((id) => values.push(id, uid));
      await conn.execute(
        `INSERT IGNORE INTO support_message_reads (message_id, user_id, read_at) VALUES ${placeholders}`,
        values
      );

      const inClause = idsToMark.map(() => "?").join(", ");
      const [seenRows] = await conn.execute(
        `SELECT
           r.message_id,
           r.user_id,
           r.read_at,
           u.full_name,
           u.username
         FROM support_message_reads r
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
        seen_updates: Array.from(grouped.entries()).map(([message_id, seen_by]) => ({ message_id, seen_by })),
      };
    } finally {
      conn.release();
    }
  }

  static async getUnreadCount(conversationId, userId) {
    const conn = await pool.getConnection();
    try {
      await ensureSupportSchema(conn);
      const [rows] = await conn.execute(
        `SELECT COUNT(*) AS total
         FROM support_messages m
         LEFT JOIN support_message_reads r
           ON r.message_id = m.id
          AND r.user_id = ?
         WHERE m.conversation_id = ?
           AND m.sender_user_id <> ?
           AND m.deleted_at IS NULL
           AND r.message_id IS NULL`,
        [userId, conversationId, userId]
      );
      return Number(rows[0]?.total || 0);
    } finally {
      conn.release();
    }
  }

  static async listConversationsForAdmin(adminUserId) {
    const conn = await pool.getConnection();
    try {
      await ensureSupportSchema(conn);
      const adminId = Number(adminUserId || 0);
      const [rows] = await conn.execute(
        `SELECT
           c.id,
           c.user_id,
           c.assigned_admin_user_id,
           c.created_at,
           c.updated_at,
           u.full_name,
           u.username,
           lm.id AS last_message_id,
           lm.sender_user_id AS last_sender_user_id,
           su.full_name AS last_sender_full_name,
           su.username AS last_sender_username,
           lm.content AS last_content,
           lm.created_at AS last_sent_at,
           COALESCE(uc.unread_count, 0) AS unread_count
         FROM support_conversations c
         INNER JOIN users u ON u.id = c.user_id
         LEFT JOIN (
           SELECT sm1.*
           FROM support_messages sm1
           INNER JOIN (
             SELECT conversation_id, MAX(id) AS max_id
             FROM support_messages
             WHERE deleted_at IS NULL
             GROUP BY conversation_id
           ) latest
             ON latest.conversation_id = sm1.conversation_id
            AND latest.max_id = sm1.id
           WHERE sm1.deleted_at IS NULL
         ) lm ON lm.conversation_id = c.id
         LEFT JOIN users su ON su.id = lm.sender_user_id
         LEFT JOIN (
           SELECT
             m.conversation_id,
             COUNT(*) AS unread_count
           FROM support_messages m
           LEFT JOIN support_message_reads r
             ON r.message_id = m.id
            AND r.user_id = ?
           WHERE m.deleted_at IS NULL
             AND m.sender_user_id <> ?
             AND r.message_id IS NULL
           GROUP BY m.conversation_id
         ) uc ON uc.conversation_id = c.id
         ORDER BY lm.created_at DESC, c.updated_at DESC, c.id DESC`,
        [adminId, adminId]
      );
      return rows.map((row) => ({
        id: Number(row.id),
        user_id: Number(row.user_id),
        user_name: row.full_name || row.username || `User #${row.user_id}`,
        assigned_admin_user_id: row.assigned_admin_user_id ? Number(row.assigned_admin_user_id) : null,
        unread_count: Number(row.unread_count || 0),
        last_message_id: row.last_message_id ? Number(row.last_message_id) : null,
        last_sender_user_id: row.last_sender_user_id ? Number(row.last_sender_user_id) : null,
        last_sender_name: row.last_sender_user_id
          ? row.last_sender_full_name || row.last_sender_username || `User #${row.last_sender_user_id}`
          : null,
        last_content: row.last_content ? String(row.last_content) : null,
        last_sent_at: row.last_sent_at || null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
    } finally {
      conn.release();
    }
  }
}

module.exports = {
  SupportChat,
  sanitizeSupportMessage: sanitizeMessage,
};
