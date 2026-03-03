const pool = require("../config/database");

class Role {
  // Lấy id role theo tên
  static async getRoleIdByName(name) {
    const connection = await pool.getConnection();
    try {
      const query = "SELECT id FROM roles WHERE name = ? LIMIT 1";
      const [rows] = await connection.execute(query, [name]);
      return rows[0] ? rows[0].id : null;
    } finally {
      connection.release();
    }
  }

  // Gán role cho user (mặc định thêm vào bảng user_roles)
  static async assignRole(userId, roleName) {
    const connection = await pool.getConnection();
    try {
      const roleId = await Role.getRoleIdByName(roleName);
      if (!roleId) {
        throw new Error(`Role \"${roleName}\" không tồn tại`);
      }
      const query = "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)";
      const [result] = await connection.execute(query, [userId, roleId]);
      return result;
    } finally {
      connection.release();
    }
  }
}

module.exports = Role;
