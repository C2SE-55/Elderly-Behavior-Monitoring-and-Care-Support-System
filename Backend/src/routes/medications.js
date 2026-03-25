const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const medicationController = require("../controllers/medicationController");

router.get("/", protect, medicationController.getMedications);
router.post("/", protect, medicationController.createMedication);
router.put("/:id", protect, medicationController.updateMedication);
router.delete("/:id", protect, medicationController.deleteMedication);

module.exports = router;
