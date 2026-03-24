const express = require("express");
const router = express.Router();
const fallEventController = require("../controllers/fallEventController");
const { uploadFallImage } = require("../middleware/upload");

// POST /api/left-safe-zone-events — Camera Service gửi ảnh khi rời vùng an toàn
router.post(
  "/",
  (req, res, next) => {
    uploadFallImage(req, res, (err) => {
      if (err) {
        const msg =
          err.code === "LIMIT_FILE_SIZE"
            ? "Ảnh tối đa 5MB"
            : (err.message || "Lỗi tải ảnh");
        return res.status(400).json({ status: "fail", message: msg });
      }
      next();
    });
  },
  fallEventController.createLeftSafeZoneEvent
);

module.exports = router;
