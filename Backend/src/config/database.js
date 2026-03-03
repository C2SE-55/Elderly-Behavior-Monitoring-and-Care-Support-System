const mysql = require("mysql2/promise");

// Tạo connection pool để kết nối cơ sở dữ liệu
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  user: process.env.DB_USER || "root",
  // support both DB_PASSWORD and DB_PASS variable names
  password: process.env.DB_PASSWORD || process.env.DB_PASS || "",
  database: process.env.DB_NAME || "elderly_care",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Kiểm tra kết nối một lần khi khởi tạo pool
(async () => {
  try {
    const conn = await pool.getConnection();
    console.log("✅ Đã kết nối tới cơ sở dữ liệu MySQL thành công");
    conn.release();
  } catch (err) {
    console.error("❌ Lỗi kết nối cơ sở dữ liệu:", err.message);
  }
})();

module.exports = pool;
