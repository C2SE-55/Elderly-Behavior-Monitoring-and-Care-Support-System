const { HTTP_STATUS } = require("../config/constants");
const { sendError, sendSuccess } = require("../utils/response");
const { RoomChat, sanitizeMessage } = require("../models/RoomChat");
const { emitMessageNew, emitMessageSeen, emitNoteChanged } = require("../services/socketServer");

const parseRoomId = (req) => Number(req.params.roomId || 0);
const sendRateMap = new Map();

const requireRoomMember = async (req, res) => {
  const roomId = parseRoomId(req);
  if (!roomId || Number.isNaN(roomId)) {
    sendError(res, "roomId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    return null;
  }
  const access = await RoomChat.getRoomAccess(roomId, req.userId);
  if (!access) {
    sendError(res, "Bạn không thuộc room này", HTTP_STATUS.FORBIDDEN);
    return null;
  }
  return { roomId, access };
};

const requireHost = async (req, res) => {
  const resolved = await requireRoomMember(req, res);
  if (!resolved) return null;
  if (resolved.access.room_role !== "host") {
    sendError(res, "Chỉ host mới được thao tác note", HTTP_STATUS.FORBIDDEN);
    return null;
  }
  return resolved;
};

const listMessages = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const limit = Number(req.query.limit || 100);
    const beforeId = Number(req.query.before_id || 0);
    const data = await RoomChat.listMessages(resolved.roomId, req.userId, { limit, beforeId });
    return sendSuccess(res, data, "Lấy tin nhắn thành công");
  } catch (error) {
    console.error("[room-chat] listMessages error:", error);
    return sendError(res, "Không thể lấy tin nhắn", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const createMessage = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const bucketKey = `${req.userId}:${resolved.roomId}`;
    const now = Date.now();
    const hit = sendRateMap.get(bucketKey) || { count: 0, resetAt: now + 10_000 };
    const windowed = now > hit.resetAt ? { count: 0, resetAt: now + 10_000 } : hit;
    if (windowed.count >= 20) {
      return sendError(res, "Gửi tin quá nhanh, vui lòng thử lại sau", HTTP_STATUS.BAD_REQUEST);
    }
    const content = sanitizeMessage(req.body?.content);
    if (!content) {
      return sendError(res, "Nội dung tin nhắn không được để trống", HTTP_STATUS.BAD_REQUEST);
    }
    if (content.length > 2000) {
      return sendError(res, "Tin nhắn vượt quá 2000 ký tự", HTTP_STATUS.BAD_REQUEST);
    }
    const message = await RoomChat.createMessage(resolved.roomId, req.userId, content);
    sendRateMap.set(bucketKey, { count: windowed.count + 1, resetAt: windowed.resetAt });
    await emitMessageNew(resolved.roomId, message);
    return sendSuccess(res, message, "Gửi tin nhắn thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("[room-chat] createMessage error:", error);
    return sendError(res, "Không thể gửi tin nhắn", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const markMessagesRead = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const payload = {
      message_ids: Array.isArray(req.body?.message_ids) ? req.body.message_ids : [],
      read_until_id: Number(req.body?.read_until_id || 0),
    };
    const data = await RoomChat.markRead(resolved.roomId, req.userId, payload);
    for (const update of data.seen_updates) {
      await emitMessageSeen(resolved.roomId, update);
    }
    return sendSuccess(res, data, "Đã cập nhật trạng thái đã xem");
  } catch (error) {
    console.error("[room-chat] markMessagesRead error:", error);
    return sendError(res, "Không thể cập nhật trạng thái xem", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const unread_count = await RoomChat.getUnreadCount(resolved.roomId, req.userId);
    return sendSuccess(res, { room_id: resolved.roomId, unread_count }, "Lấy số tin chưa đọc thành công");
  } catch (error) {
    console.error("[room-chat] getUnreadCount error:", error);
    return sendError(res, "Không thể lấy số tin chưa đọc", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const getUnreadSummary = async (req, res) => {
  try {
    const rows = await RoomChat.getUnreadSummary(req.userId);
    return sendSuccess(res, rows, "Lấy tổng hợp thông báo room thành công");
  } catch (error) {
    console.error("[room-chat] getUnreadSummary error:", error);
    return sendError(res, "Không thể lấy tổng hợp thông báo", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const getNotes = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const data = await RoomChat.listNotes(resolved.roomId);
    return sendSuccess(res, data, "Lấy note thành công");
  } catch (error) {
    console.error("[room-chat] getNotes error:", error);
    return sendError(res, "Không thể lấy note", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const createNote = async (req, res) => {
  try {
    const resolved = await requireHost(req, res);
    if (!resolved) return;
    const content = String(req.body?.content || "").trim().slice(0, 4000);
    if (!content) {
      return sendError(res, "Nội dung note không được để trống", HTTP_STATUS.BAD_REQUEST);
    }
    const note = await RoomChat.createNote(resolved.roomId, req.userId, req.body);
    await emitNoteChanged(resolved.roomId, "note:created", note);
    return sendSuccess(res, note, "Tạo note thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("[room-chat] createNote error:", error);
    return sendError(res, "Không thể tạo note", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const updateNote = async (req, res) => {
  try {
    const resolved = await requireHost(req, res);
    if (!resolved) return;
    const noteId = Number(req.params.noteId || 0);
    if (!noteId || Number.isNaN(noteId)) {
      return sendError(res, "noteId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const note = await RoomChat.updateNote(resolved.roomId, noteId, req.body || {});
    if (!note) {
      return sendError(res, "Không tìm thấy note", HTTP_STATUS.NOT_FOUND);
    }
    await emitNoteChanged(resolved.roomId, "note:updated", note);
    return sendSuccess(res, note, "Cập nhật note thành công");
  } catch (error) {
    console.error("[room-chat] updateNote error:", error);
    return sendError(res, "Không thể cập nhật note", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const deleteNote = async (req, res) => {
  try {
    const resolved = await requireHost(req, res);
    if (!resolved) return;
    const noteId = Number(req.params.noteId || 0);
    if (!noteId || Number.isNaN(noteId)) {
      return sendError(res, "noteId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await RoomChat.deleteNote(resolved.roomId, noteId);
    if (!ok) return sendError(res, "Không tìm thấy note", HTTP_STATUS.NOT_FOUND);
    await emitNoteChanged(resolved.roomId, "note:deleted", { id: noteId });
    return sendSuccess(res, { id: noteId }, "Xóa note thành công");
  } catch (error) {
    console.error("[room-chat] deleteNote error:", error);
    return sendError(res, "Không thể xóa note", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const listChatNotificationPrefs = async (req, res) => {
  try {
    const rows = await RoomChat.listChatNotificationPrefsForUser(req.userId);
    return sendSuccess(res, rows, "Lấy cài đặt thông báo chat theo phòng thành công");
  } catch (error) {
    console.error("[room-chat] listChatNotificationPrefs error:", error);
    return sendError(res, "Không thể lấy cài đặt thông báo", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const getChatNotificationPref = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const data = await RoomChat.getChatNotificationPref(resolved.roomId, req.userId);
    return sendSuccess(res, data, "OK");
  } catch (error) {
    console.error("[room-chat] getChatNotificationPref error:", error);
    return sendError(res, "Không thể lấy cài đặt", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

const setChatNotificationPref = async (req, res) => {
  try {
    const resolved = await requireRoomMember(req, res);
    if (!resolved) return;
    const enabled = req.body?.enabled !== undefined ? !!req.body.enabled : undefined;
    if (enabled === undefined) {
      return sendError(res, "Thiếu trường enabled (boolean)", HTTP_STATUS.BAD_REQUEST);
    }
    const data = await RoomChat.setChatNotificationPref(resolved.roomId, req.userId, enabled);
    return sendSuccess(res, data, "Đã cập nhật thông báo chat phòng");
  } catch (error) {
    console.error("[room-chat] setChatNotificationPref error:", error);
    return sendError(res, "Không thể cập nhật cài đặt", HTTP_STATUS.INTERNAL_ERROR, error.message);
  }
};

module.exports = {
  listMessages,
  createMessage,
  markMessagesRead,
  getUnreadCount,
  getUnreadSummary,
  getNotes,
  createNote,
  updateNote,
  deleteNote,
  listChatNotificationPrefs,
  getChatNotificationPref,
  setChatNotificationPref,
};
