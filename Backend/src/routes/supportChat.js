const express = require("express");
const { protect } = require("../middleware/auth");
const supportChatController = require("../controllers/supportChatController");

const router = express.Router();

router.get("/conversations", protect, supportChatController.listConversations);
router.get("/conversation", protect, supportChatController.getConversation);
router.get("/conversation/messages", protect, supportChatController.listMessages);
router.post("/conversation/messages", protect, supportChatController.createMessage);
router.post("/conversation/messages/read", protect, supportChatController.markMessagesRead);
router.get("/conversation/unread-count", protect, supportChatController.getUnreadCount);
router.post("/conversation/typing", protect, supportChatController.emitTyping);

module.exports = router;
