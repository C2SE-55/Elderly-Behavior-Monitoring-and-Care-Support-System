const express = require("express");
const { protect } = require("../middleware/auth");
const cameraController = require("../controllers/cameraController");

const router = express.Router();

router.get("/live-access", protect, cameraController.getLiveAccess);

module.exports = router;
