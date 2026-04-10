const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const medicationController = require("../controllers/medicationController");
const { uploadPrescriptionImage } = require("../middleware/upload");

router.get("/", protect, medicationController.getMedications);
router.post("/", protect, medicationController.createMedication);
router.post(
  "/extract-from-image",
  protect,
  (req, res, next) => {
    uploadPrescriptionImage(req, res, (err) => {
      if (err) {
        const msg = err.code === "LIMIT_FILE_SIZE" ? "Ảnh tối đa 8MB" : err.message || "Lỗi tải ảnh";
        return res.status(400).json({
          status: "fail",
          message: msg,
          medicines: [],
          summary: { total_detected: 0, high_confidence_count: 0 },
        });
      }
      next();
    });
  },
  medicationController.extractFromImage
);
router.put("/:id", protect, medicationController.updateMedication);
router.delete("/:id", protect, medicationController.deleteMedication);

module.exports = router;
