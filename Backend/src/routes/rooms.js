const express = require("express");
const { protect } = require("../middleware/auth");
const roomController = require("../controllers/roomController");

const router = express.Router();

router.post("/admin/create", protect, roomController.adminCreateRoom);
router.get("/admin/all", protect, roomController.adminGetAllRooms);
router.delete("/admin/:roomId", protect, roomController.adminDeleteRoom);
router.post("/join/admin-room", protect, roomController.joinByAdminRoomCode);
router.post("/join/host-qr", protect, roomController.joinByHostQr);
router.get("/me", protect, roomController.getMyRoom);
router.get("/my-rooms", protect, roomController.getMyRooms);
router.get("/members", protect, roomController.getMembers);
router.patch("/members/:userId/permissions", protect, roomController.updateCaretakerPermissions);
router.delete("/members/:userId", protect, roomController.kickCaretaker);
router.get("/patient", protect, roomController.getRoomPatient);
router.put("/patient", protect, roomController.updateRoomPatient);

module.exports = router;
