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

  // Tìm người dùng bằng email
  static async findByEmail(email) {
    const connection = await pool.getConnection();
    try {
      const query = "SELECT * FROM users WHERE email = ?";
      const [rows] = await connection.execute(query, [email]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Tìm người dùng bằng ID
  static async findById(id) {
    const connection = await pool.getConnection();
    try {
      const query = "SELECT * FROM users WHERE id = ?";
      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;
    } finally {
      connection.release();
    }
  }

  // Tìm người dùng bằng tên đăng nhập
  static async findByUsername(username) {
    const connection = await pool.getConnection();
    try {
      const query = "SELECT * FROM users WHERE username = ?";
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
      const query = "SELECT id, username, email, phone, full_name AS fullName, date_of_birth AS dateOfBirth, created_at AS createdAt FROM users";
      const [rows] = await connection.execute(query);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Cập nhật thông tin người dùng
  static async update(id, userData) {
    const connection = await pool.getConnection();
    try {
      const { phone, fullName, email, dateOfBirth } = userData;
      const query = "UPDATE users SET email = ?, phone = ?, full_name = ?, date_of_birth = ? WHERE id = ?";
      const [result] = await connection.execute(query, [email, phone, fullName, dateOfBirth, id]);
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
