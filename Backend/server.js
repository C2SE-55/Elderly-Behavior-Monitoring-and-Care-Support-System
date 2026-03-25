require("dotenv").config();
const express = require("express");
const cors = require("cors");
const routes = require("./src/routes");
const errorHandler = require("./src/middleware/errorHandler");
const { startMedicationReminderJob } = require("./src/jobs/medicationReminderJob");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Thư mục ảnh upload (ảnh đại diện / khuôn mặt cho nhận diện)
const path = require("path");
const uploadsDir = path.join(__dirname, "uploads");
app.use("/uploads", express.static(uploadsDir));

// Routes
app.use("/", routes);

// Xử lý lỗi 404
app.use((req, res) => {
  res.status(404).json({
    status: "error",
    message: "Không tìm thấy route",
  });
});

// Xử lý lỗi (phải để cuối cùng)
app.use(errorHandler);

// Khởi động server
app.listen(PORT, () => {
  console.log(`\n✓ Server đang chạy trên cổng ${PORT}`);
  console.log(`✓ Môi trường: ${process.env.NODE_ENV || "development"}`);
  console.log(`✓ API Health: http://localhost:${PORT}/health\n`);
  startMedicationReminderJob();
});