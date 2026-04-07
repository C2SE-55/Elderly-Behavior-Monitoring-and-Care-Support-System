const express = require("express");
const { protect } = require("../middleware/auth");
const roomController = require("../controllers/roomController");
const roomChatController = require("../controllers/roomChatController");

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
router.put("/medication-daily-reminders", protect, roomController.updateMedicationDailyReminders);
router.get("/messages/unread-summary", protect, roomChatController.getUnreadSummary);
router.get("/chat-notification-prefs", protect, roomChatController.listChatNotificationPrefs);
router.get("/:roomId/medication-intake-stats", protect, roomController.getMedicationIntakeStats);
router.get("/:roomId/chat-notification-pref", protect, roomChatController.getChatNotificationPref);
router.put("/:roomId/chat-notification-pref", protect, roomChatController.setChatNotificationPref);
router.get("/:roomId/messages", protect, roomChatController.listMessages);
router.post("/:roomId/messages", protect, roomChatController.createMessage);
router.post("/:roomId/messages/read", protect, roomChatController.markMessagesRead);
router.get("/:roomId/messages/unread-count", protect, roomChatController.getUnreadCount);
router.get("/:roomId/notes", protect, roomChatController.getNotes);
router.post("/:roomId/notes", protect, roomChatController.createNote);
router.put("/:roomId/notes/:noteId", protect, roomChatController.updateNote);
router.delete("/:roomId/notes/:noteId", protect, roomChatController.deleteNote);

module.exports = router;
