const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const medicationReminderController = require("../controllers/medicationReminderController");

router.get("/", protect, medicationReminderController.getReminders);
router.get("/profile/:profileId", protect, medicationReminderController.getReminders);
router.post("/", protect, medicationReminderController.createReminder);
router.put("/:id", protect, medicationReminderController.updateReminder);
router.patch("/:id/status", protect, medicationReminderController.updateStatus);
router.patch("/:id/mark-done", protect, medicationReminderController.markDone);
router.delete("/:id", protect, medicationReminderController.deleteReminder);

module.exports = router;
