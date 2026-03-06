const express = require("express");
const authRoutes = require("./auth");
const healthMetricsRoutes = require("./healthMetrics");

const router = express.Router();

// Routes API
router.use("/api/auth", authRoutes);
router.use("/api/health-metrics", healthMetricsRoutes);

// Kiểm tra trạng thái server
router.get("/health", (req, res) => {
  res.json({ status: "healthy", message: "API đang chạy" });
});

module.exports = router;
