const pool = require("../config/database");

class Role {
  // Lấy id role theo tên
  static async getRoleIdByName(name, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const query = "SELECT id FROM roles WHERE name = ? LIMIT 1";
      const [rows] = await conn.execute(query, [name]);
      return rows[0] ? rows[0].id : null;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  // Gán role cho user (mặc định thêm vào bảng user_roles)
  static async assignRole(userId, roleName, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const roleId = await Role.getRoleIdByName(roleName, conn);
      if (!roleId) {
        throw new Error(`Role \"${roleName}\" không tồn tại`);
      }
      const query = "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)";
      const [result] = await conn.execute(query, [userId, roleId]);
      return result;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async setRole(userId, roleName, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const roleId = await Role.getRoleIdByName(roleName, conn);
      if (!roleId) {
        throw new Error(`Role \"${roleName}\" không tồn tại`);
      }
      await conn.execute("DELETE FROM user_roles WHERE user_id = ?", [userId]);
      await conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, roleId]);
      return true;
    } finally {
      if (ownConnection) conn.release();
    }
  }

  static async getUserRole(userId, connection = null) {
    const ownConnection = !connection;
    const conn = connection || (await pool.getConnection());
    try {
      const [rows] = await conn.execute(
        `SELECT r.name
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = ?
         ORDER BY ur.role_id ASC
         LIMIT 1`,
        [userId]
      );
      return rows[0]?.name || null;
    } finally {
      if (ownConnection) conn.release();
    }
  }
}

module.exports = Role;
