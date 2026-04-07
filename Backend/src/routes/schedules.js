const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const scheduleController = require("../controllers/scheduleController");

router.post("/", protect, scheduleController.createSchedules);
router.get("/today-schedules", protect, scheduleController.getTodaySchedules);
router.delete("/slot", protect, scheduleController.deleteSchedulesForSlot);
router.put("/:id", protect, scheduleController.updateSchedule);
router.delete("/:id", protect, scheduleController.deleteSchedule);

module.exports = router;
