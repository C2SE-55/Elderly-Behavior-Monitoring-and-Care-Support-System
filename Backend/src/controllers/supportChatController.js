const { HTTP_STATUS } = require("../config/constants");
const { sendError, sendSuccess } = require("../utils/response");
const { SupportChat, sanitizeSupportMessage } = require("../models/SupportChat");
const {
  emitSupportMessageNew,
  emitSupportMessageSeen,
  emitSupportTyping,
} = require("../services/socketServer");

const MAX_MESSAGE_LENGTH = 2000;
const sendRateMap = new Map();

const resolveConversation = async (req, res) => {
  const targetUserId = Number(req.query.user_id || req.body?.user_id || 0);
  const conversation = await SupportChat.resolveConversationForRequest({
    requesterUserId: req.userId,
    requesterRole: req.userRole,
    targetUserId,
  });
  if (!conversation) {
    sendError(
      res,
      String(req.userRole || "").toLowerCase() === "admin"
        ? "Admin cần truyền user_id hợp lệ"
        : "Không thể khởi tạo hội thoại hỗ trợ",
      HTTP_STATUS.BAD_REQUEST
    );
    return null;
  }
  return conversation;
};

const getConversation = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const unread_count = await SupportChat.getUnreadCount(conversation.id, req.userId);
    return sendSuccess(res, { ...conversation, unread_count }, "Lấy hội thoại hỗ trợ thành công");
  } catch (error) {
    console.error("[support-chat] getConversation error:", error);
    return sendError(res, "Không thể lấy hội thoại hỗ trợ", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const listConversations = async (req, res) => {
  try {
    if (String(req.userRole || "").toLowerCase() !== "admin") {
      return sendError(res, "Chỉ admin được xem danh sách hội thoại hỗ trợ", HTTP_STATUS.FORBIDDEN);
    }
    const rows = await SupportChat.listConversationsForAdmin(req.userId);
    return sendSuccess(res, rows, "Lấy danh sách hội thoại hỗ trợ thành công");
  } catch (error) {
    console.error("[support-chat] listConversations error:", error);
    return sendError(res, "Không thể lấy danh sách hội thoại", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const listMessages = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const limit = Number(req.query.limit || 100);
    const beforeId = Number(req.query.before_id || 0);
    const data = await SupportChat.listMessages(conversation.id, req.userId, { limit, beforeId });
    return sendSuccess(res, { conversation, ...data }, "Lấy tin nhắn hỗ trợ thành công");
  } catch (error) {
    console.error("[support-chat] listMessages error:", error);
    return sendError(res, "Không thể lấy tin nhắn hỗ trợ", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const createMessage = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const bucketKey = `${req.userId}:${conversation.id}`;
    const now = Date.now();
    const hit = sendRateMap.get(bucketKey) || { count: 0, resetAt: now + 10_000 };
    const windowed = now > hit.resetAt ? { count: 0, resetAt: now + 10_000 } : hit;
    if (windowed.count >= 20) {
      return sendError(res, "Gửi tin quá nhanh, vui lòng thử lại sau", HTTP_STATUS.BAD_REQUEST);
    }

    const content = sanitizeSupportMessage(req.body?.content);
    if (!content) {
      return sendError(res, "Nội dung tin nhắn không được để trống", HTTP_STATUS.BAD_REQUEST);
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return sendError(res, "Tin nhắn vượt quá 2000 ký tự", HTTP_STATUS.BAD_REQUEST);
    }

    const message = await SupportChat.createMessage(conversation.id, req.userId, content);
    sendRateMap.set(bucketKey, { count: windowed.count + 1, resetAt: windowed.resetAt });
    await emitSupportMessageNew(conversation.id, message);
    return sendSuccess(res, message, "Gửi tin nhắn hỗ trợ thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("[support-chat] createMessage error:", error);
    return sendError(res, "Không thể gửi tin nhắn hỗ trợ", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const markMessagesRead = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const payload = {
      message_ids: Array.isArray(req.body?.message_ids) ? req.body.message_ids : [],
      read_until_id: Number(req.body?.read_until_id || 0),
    };
    const data = await SupportChat.markRead(conversation.id, req.userId, payload);
    for (const update of data.seen_updates) {
      await emitSupportMessageSeen(conversation.id, update);
    }
    return sendSuccess(res, data, "Đã cập nhật trạng thái đã xem");
  } catch (error) {
    console.error("[support-chat] markMessagesRead error:", error);
    return sendError(res, "Không thể cập nhật trạng thái xem", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const unread_count = await SupportChat.getUnreadCount(conversation.id, req.userId);
    return sendSuccess(
      res,
      { conversation_id: conversation.id, unread_count },
      "Lấy số tin chưa đọc hỗ trợ thành công"
    );
  } catch (error) {
    console.error("[support-chat] getUnreadCount error:", error);
    return sendError(res, "Không thể lấy số tin chưa đọc", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const emitTyping = async (req, res) => {
  try {
    const conversation = await resolveConversation(req, res);
    if (!conversation) return;
    const isTyping = !!req.body?.isTyping;
    const userName = String(req.body?.userName || "").trim().slice(0, 80);
    await emitSupportTyping(conversation.id, {
      conversationId: conversation.id,
      userId: Number(req.userId),
      userName,
      isTyping,
    });
    return sendSuccess(res, { ok: true }, "OK");
  } catch (error) {
    console.error("[support-chat] emitTyping error:", error);
    return sendError(res, "Không thể gửi trạng thái typing", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

module.exports = {
  getConversation,
  listConversations,
  listMessages,
  createMessage,
  markMessagesRead,
  getUnreadCount,
  emitTyping,
};
