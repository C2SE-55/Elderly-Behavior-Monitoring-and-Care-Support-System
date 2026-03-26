const pool = require("../config/database");

const ensureRoomProfileTable = async (connection) => {
  await connection.execute(
    `CREATE TABLE IF NOT EXISTS room_health_profiles (
      room_id INT PRIMARY KEY,
      profile_id INT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE CASCADE
    )`
  );
};

const getOrCreateRoomProfileId = async (roomId, hostUserId, connection = null) => {
  const ownConnection = !connection;
  const conn = connection || (await pool.getConnection());
  try {
    await ensureRoomProfileTable(conn);

    const [mappingRows] = await conn.execute(
      "SELECT profile_id FROM room_health_profiles WHERE room_id = ? LIMIT 1",
      [roomId]
    );
    if (mappingRows[0]?.profile_id) {
      return Number(mappingRows[0].profile_id);
    }

    const [userRows] = await conn.execute(
      "SELECT full_name, username FROM users WHERE id = ? LIMIT 1",
      [hostUserId]
    );
    const defaultName = userRows[0]?.full_name || userRows[0]?.username || `User ${hostUserId}`;

    const [profileResult] = await conn.execute(
      "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, ?)",
      [hostUserId, defaultName]
    );
    const profileId = Number(profileResult.insertId);

    try {
      await conn.execute(
        "INSERT INTO room_health_profiles (room_id, profile_id) VALUES (?, ?)",
        [roomId, profileId]
      );
      return profileId;
    } catch (error) {
      if (error?.code === "ER_DUP_ENTRY") {
        const [latestRows] = await conn.execute(
          "SELECT profile_id FROM room_health_profiles WHERE room_id = ? LIMIT 1",
          [roomId]
        );
        if (latestRows[0]?.profile_id) return Number(latestRows[0].profile_id);
      }
      throw error;
    }
  } finally {
    if (ownConnection) conn.release();
  }
};

module.exports = {
  getOrCreateRoomProfileId,
};
