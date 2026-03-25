const express = require("express");
const authRoutes = require("./auth");
const healthMetricsRoutes = require("./healthMetrics");
const fallEventsRoutes = require("./fallEvents");
const leftSafeZoneEventsRoutes = require("./leftSafeZoneEvents");
const medicationRemindersRoutes = require("./medicationReminders");
const medicationsRoutes = require("./medications");
const schedulesRoutes = require("./schedules");
const logsRoutes = require("./logs");

const router = express.Router();

// Routes API
router.use("/api/auth", authRoutes);
router.use("/api/health-metrics", healthMetricsRoutes);
router.use("/api/fall-events", fallEventsRoutes);
router.use("/api/left-safe-zone-events", leftSafeZoneEventsRoutes);
router.use("/api/medication-reminders", medicationRemindersRoutes);
router.use("/api/medications", medicationsRoutes);
router.use("/api/schedules", schedulesRoutes);
router.use("/api/logs", logsRoutes);

// Kiểm tra trạng thái server
router.get("/health", (req, res) => {
  res.json({ status: "healthy", message: "API đang chạy" });
});

module.exports = router;
