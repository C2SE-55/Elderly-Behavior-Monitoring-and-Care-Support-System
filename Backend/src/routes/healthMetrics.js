const express = require("express");
const router = express.Router();
const healthMetricController = require("../controllers/healthMetricController");
const { protect } = require("../middleware/auth");

// Tạo chỉ số sức khỏe mới (Bắt buộc đăng nhập)
router.post("/", protect, healthMetricController.createMetric);

// Lấy danh sách loại chỉ số có sẵn
router.get("/available-types", healthMetricController.getAvailableMetricTypes);

// Lấy tất cả chỉ số sức khỏe theo profile ID
router.get("/profile/:profileId", healthMetricController.getMetricsByProfile);

// Lấy tất cả chỉ số gần nhất theo profile ID
router.get("/profile/:profileId/latest-all", healthMetricController.getAllLatestMetrics);

// Lấy chỉ số theo loại
router.get("/profile/:profileId/type/:metricType", healthMetricController.getMetricsByType);

// Lấy chỉ số gần nhất theo loại
router.get("/profile/:profileId/type/:metricType/latest", healthMetricController.getLatestMetricByType);

// Lấy thống kê chỉ số sức khỏe
router.get("/profile/:profileId/type/:metricType/statistics", healthMetricController.getMetricStatistics);

// Lấy chi tiết một chỉ số theo ID
router.get("/:id", healthMetricController.getMetricById);

// Cập nhật chỉ số sức khỏe (Bắt buộc đăng nhập)
router.put("/:id", protect, healthMetricController.updateMetric);

// Xóa chỉ số sức khỏe (Bắt buộc đăng nhập)
router.delete("/:id", protect, healthMetricController.deleteMetric);

module.exports = router;
