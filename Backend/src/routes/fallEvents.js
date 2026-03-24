const express = require("express");
const router = express.Router();
const fallEventController = require("../controllers/fallEventController");
const { uploadFallImage } = require("../middleware/upload");

// GET /api/fall-events/history — Lấy lịch sử cảnh báo cho màn Camera Live
router.get("/history", fallEventController.getEventHistory);

// POST /api/fall-events — Camera Service gửi ảnh té ngã + camera_id (multipart)
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
  fallEventController.createFallEvent
);

module.exports = router;
