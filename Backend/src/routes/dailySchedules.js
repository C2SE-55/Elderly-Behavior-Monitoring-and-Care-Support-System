const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const dailyScheduleController = require("../controllers/dailyScheduleController");

router.get("/", protect, dailyScheduleController.getDailySchedules);
router.post("/", protect, dailyScheduleController.createDailySchedule);
router.put("/:id", protect, dailyScheduleController.updateDailySchedule);
router.delete("/:id", protect, dailyScheduleController.deleteDailySchedule);

module.exports = router;
