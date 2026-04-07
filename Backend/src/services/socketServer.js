const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { JWT_SECRET } = require("../config/constants");
const { RoomChat } = require("../models/RoomChat");

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

module.exports = {
  initSocketServer,
  emitMessageNew,
  emitMessageSeen,
  emitNoteChanged,
  emitMedicationIntake,
};
