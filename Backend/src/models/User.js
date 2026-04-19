const pool = require("../config/database");
const bcrypt = require("bcrypt");

// Model User - Quản lý các thao tác với bảng users
class User {
  // Tạo người dùng mới
  static async create(userData) {
    const connection = await pool.getConnection();
    try {
      const { username, email, password, phone, fullName, dateOfBirth } = userData;
      const hashedPassword = await bcrypt.hash(password, 10);

      const query =
        "INSERT INTO users (username, email, password, phone, full_name, date_of_birth) VALUES (?, ?, ?, ?, ?, ?)";
      const [result] = await connection.execute(query, [
        username,
        email,
        hashedPassword,
        phone || null,
        fullName || null,
        dateOfBirth || null,
      ]);

      return result;
    } finally {
      connection.release();
    }
  }

  // Tìm người dùng bằng email (với role)
  static async findByEmail(email) {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT u.*, r.name as role
                     FROM users u
                     LEFT JOIN user_roles ur ON u.id = ur.user_id
                     LEFT JOIN roles r ON ur.role_id = r.id
                     WHERE u.email = ?`;
      const [rows] = await connection.execute(query, [email]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Tìm người dùng bằng ID (với role)
  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT u.*, r.name as role
                     FROM users u
                     LEFT JOIN user_roles ur ON u.id = ur.user_id
                     LEFT JOIN roles r ON ur.role_id = r.id
                     WHERE u.id = ?`;
      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Tìm người dùng bằng tên đăng nhập (với role)
  static async findByUsername(username) {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT u.*, r.name as role
                     FROM users u
                     LEFT JOIN user_roles ur ON u.id = ur.user_id
                     LEFT JOIN roles r ON ur.role_id = r.id
                     WHERE u.username = ?`;
      const [rows] = await connection.execute(query, [username]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả người dùng
  static async getAll() {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT u.id, u.username, u.email, u.phone, u.full_name AS fullName, u.date_of_birth AS dateOfBirth, u.created_at AS createdAt, r.name as role
                     FROM users u
                     LEFT JOIN user_roles ur ON u.id = ur.user_id
                     LEFT JOIN roles r ON ur.role_id = r.id`;
      const [rows] = await connection.execute(query);
      return rows;
    } finally {
      connection.release();
    }
  }

  /**
   * Thống kê admin dashboard:
   * - registeredTotal: mọi dòng `users`
   * - admin: số user có role admin (DISTINCT)
   * - user: tài khoản không phải admin = registeredTotal - admin (tránh lệch do NOT EXISTS / dữ liệu user_roles)
   * - rooms: max(bảng `rooms`, DISTINCT room_id trong `room_members`) để vẫn thấy phòng khi dữ liệu lệch
   */
  static async getAdminAccountOverview() {
    const connection = await pool.getConnection();
    try {
      const [totalRows] = await connection.execute(`SELECT COUNT(*) AS c FROM users`);
      const registeredTotal = Number(totalRows[0]?.c || 0);

      const [adminRows] = await connection.execute(
        `SELECT COUNT(DISTINCT ur.user_id) AS c
         FROM user_roles ur
         INNER JOIN roles r ON r.id = ur.role_id
         WHERE LOWER(TRIM(r.name)) = 'admin'`
      );
      const admin = Number(adminRows[0]?.c || 0);

      const user = Math.max(0, registeredTotal - admin);

      const [roomTableRows] = await connection.execute(`SELECT COUNT(*) AS c FROM rooms`);
      const roomsFromTable = Number(roomTableRows[0]?.c || 0);

      const [memberRows] = await connection.execute(
        `SELECT COUNT(DISTINCT room_id) AS c FROM room_members`
      );
      const roomsFromMembers = Number(memberRows[0]?.c || 0);

      const rooms = Math.max(roomsFromTable, roomsFromMembers);

      return {
        user,
        rooms,
        admin,
        other: 0,
        registeredTotal,
      };
    } finally {
      connection.release();
    }
  }

  // Tìm kiếm người dùng theo tên (username hoặc full_name)
  static async searchByName(keyword) {
    const connection = await pool.getConnection();
    try {
      const searchPattern = `%${keyword}%`;
      const query = `SELECT u.id, u.username, u.email, u.phone, u.full_name AS fullName, u.date_of_birth AS dateOfBirth, u.created_at AS createdAt, r.name as role
                     FROM users u
                     LEFT JOIN user_roles ur ON u.id = ur.user_id
                     LEFT JOIN roles r ON ur.role_id = r.id
                     WHERE u.username LIKE ? OR u.full_name LIKE ?
                     ORDER BY u.full_name ASC`;
      const [rows] = await connection.execute(query, [searchPattern, searchPattern]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Cập nhật thông tin người dùng (chỉ cập nhật các trường được cung cấp)
  static async update(id, userData) {
    const connection = await pool.getConnection();
    try {
      const fields = [];
      const values = [];

      // Chỉ cập nhật các trường được cung cấp (không phải undefined)
      if (userData.phone !== undefined) {
        fields.push("phone = ?");
        values.push(userData.phone);
      }
      if (userData.fullName !== undefined) {
        fields.push("full_name = ?");
        values.push(userData.fullName);
      }
      if (userData.email !== undefined) {
        fields.push("email = ?");
        values.push(userData.email);
      }
      if (userData.dateOfBirth !== undefined) {
        fields.push("date_of_birth = ?");
        values.push(userData.dateOfBirth);
      }
      if (userData.password !== undefined) {
        const hashedPassword = await bcrypt.hash(String(userData.password), 10);
        fields.push("password = ?");
        values.push(hashedPassword);
      }

      // Nếu không có trường nào cần cập nhật, trả về kết quả rỗng
      if (fields.length === 0) {
        return { affectedRows: 0 };
      }

      values.push(id);
      const query = `UPDATE users SET ${fields.join(", ")} WHERE id = ?`;
      const [result] = await connection.execute(query, values);
      return result;
    } finally {
      connection.release();
    }
  }

  // Xóa người dùng
  static async delete(id) {
    const connection = await pool.getConnection();
    try {
      const query = "DELETE FROM users WHERE id = ?";
      const [result] = await connection.execute(query, [id]);
      return result;
    } finally {
      connection.release();
    }
  }

  // So sánh mật khẩu
  static async comparePassword(password, hashedPassword) {
    return await bcrypt.compare(password, hashedPassword);
  }
}

module.exports = User;
