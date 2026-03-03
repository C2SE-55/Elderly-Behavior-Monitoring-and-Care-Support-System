const express = require("express");
const authRoutes = require("./auth");

const router = express.Router();

// Routes API
router.use("/api/auth", authRoutes);

// Kiểm tra trạng thái server
router.get("/health", (req, res) => {
  res.json({ status: "healthy", message: "API đang chạy" });
});

module.exports = router;
