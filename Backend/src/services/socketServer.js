const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { JWT_SECRET } = require("../config/constants");
const { RoomChat } = require("../models/RoomChat");
const { SupportChat } = require("../models/SupportChat");

let io = null;

const getTokenFromSocket = (socket) => {
  const authToken = socket.handshake?.auth?.token;
  if (authToken) return String(authToken).replace(/^Bearer\s+/i, "");
  const headerAuth = socket.handshake?.headers?.authorization;
  if (headerAuth) return String(headerAuth).replace(/^Bearer\s+/i, "");
  return null;
};

const roomChannel = (roomId) => `room:${Number(roomId)}`;
const userChannel = (userId) => `user:${Number(userId)}`;
const supportChannel = (conversationId) => `support:${Number(conversationId)}`;

const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    try {
      const token = getTokenFromSocket(socket);
      if (!token) return next(new Error("UNAUTHORIZED"));
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.data.userId = Number(decoded.id);
      socket.data.userRole = decoded.role;
      return next();
    } catch (_error) {
      return next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const userId = Number(socket.data.userId);
    if (userId > 0) {
      socket.join(userChannel(userId));
    }

    socket.on("room:join", async (payload = {}) => {
      const userId = Number(socket.data.userId);
      const roomId = Number(payload.roomId || 0);
      if (!roomId || Number.isNaN(roomId) || !userId) return;
      const access = await RoomChat.getRoomAccess(roomId, userId);
      if (!access) return;
      socket.join(roomChannel(roomId));
      socket.emit("room:joined", { roomId });
    });

    socket.on("message:typing", async (payload = {}) => {
      const userId = Number(socket.data.userId);
      const roomId = Number(payload.roomId || 0);
      if (!roomId || Number.isNaN(roomId) || !userId) return;
      const access = await RoomChat.getRoomAccess(roomId, userId);
      if (!access) return;
      await emitToRoomMembers(roomId, "message:typing", {
        roomId,
        userId,
        userName: String(payload.userName || "").trim().slice(0, 80),
        isTyping: !!payload.isTyping,
      });
    });

    socket.on("support:join", async (payload = {}) => {
      const userId = Number(socket.data.userId);
      const userRole = String(socket.data.userRole || "").toLowerCase();
      const conversationId = Number(payload.conversationId || 0);
      if (!conversationId || Number.isNaN(conversationId) || !userId) return;
      const canAccess = await SupportChat.canAccessConversation(conversationId, userId, userRole);
      if (!canAccess) return;
      socket.join(supportChannel(conversationId));
      socket.emit("support:joined", { conversationId });
    });

    socket.on("support:typing", async (payload = {}) => {
      const userId = Number(socket.data.userId);
      const userRole = String(socket.data.userRole || "").toLowerCase();
      const conversationId = Number(payload.conversationId || 0);
      if (!conversationId || Number.isNaN(conversationId) || !userId) return;
      const canAccess = await SupportChat.canAccessConversation(conversationId, userId, userRole);
      if (!canAccess) return;
      await emitSupportTyping(conversationId, {
        conversationId,
        userId,
        userName: String(payload.userName || "").trim().slice(0, 80),
        isTyping: !!payload.isTyping,
      });
    });
  });

  return io;
};

const emitToRoomMembers = async (roomId, eventName, payload) => {
  if (!io) return;
  const memberIds = await RoomChat.listRoomParticipantUserIds(roomId);
  memberIds.forEach((uid) => {
    io.to(userChannel(uid)).emit(eventName, payload);
  });
};

const emitMessageNew = async (roomId, message) => {
  await emitToRoomMembers(roomId, "message:new", { roomId, message });
};

const emitMessageSeen = async (roomId, update) => {
  await emitToRoomMembers(roomId, "message:seen", { roomId, ...update });
};

const emitNoteChanged = async (roomId, eventName, note) => {
  await emitToRoomMembers(roomId, eventName, { roomId, note });
};

const emitMedicationIntake = async (roomId, payload) => {
  await emitToRoomMembers(roomId, "medication:intake", { roomId: Number(roomId), ...payload });
};

const getSupportParticipantUserIds = async (conversationId) => {
  const conversation = await SupportChat.getConversationById(conversationId);
  if (!conversation) return [];
  const adminIds = await SupportChat.listAdminUserIds();
  return Array.from(new Set([Number(conversation.user_id), ...adminIds])).filter((x) => x > 0);
};

const emitSupportToParticipants = async (conversationId, eventName, payload) => {
  if (!io) return;
  const participantIds = await getSupportParticipantUserIds(conversationId);
  participantIds.forEach((uid) => {
    io.to(userChannel(uid)).emit(eventName, payload);
  });
  io.to(supportChannel(conversationId)).emit(eventName, payload);
};

const emitSupportMessageNew = async (conversationId, message) => {
  await emitSupportToParticipants(conversationId, "support:message:new", { conversationId, message });
};

const emitSupportMessageSeen = async (conversationId, update) => {
  await emitSupportToParticipants(conversationId, "support:message:seen", { conversationId, ...update });
};

const emitSupportTyping = async (conversationId, payload) => {
  await emitSupportToParticipants(conversationId, "support:typing", payload);
};

module.exports = {
  initSocketServer,
  emitMessageNew,
  emitMessageSeen,
  emitNoteChanged,
  emitMedicationIntake,
  emitSupportMessageNew,
  emitSupportMessageSeen,
  emitSupportTyping,
};
