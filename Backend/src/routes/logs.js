const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const logController = require("../controllers/logController");

router.patch("/mark-taken", protect, logController.markTaken);
router.patch("/mark-skipped", protect, logController.markSkipped);
router.patch("/mark-slot-taken", protect, logController.markSlotTaken);
router.patch("/mark-slot-skipped", protect, logController.markSlotSkipped);

module.exports = router;
