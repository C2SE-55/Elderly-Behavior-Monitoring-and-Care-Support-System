const pool = require("../config/database");
const Role = require("../models/Role");

const ROOM_ROLE = {
  HOST: "host",
  CARETAKER: "caretaker",
};

const resolveRequestedRoomId = (req) => {
  const raw =
    req?.headers?.["x-room-id"] ||
    req?.query?.room_id ||
    req?.body?.room_id ||
    req?.params?.roomId ||
    null;
  const roomId = Number(raw);
  return roomId && !Number.isNaN(roomId) ? roomId : null;
};

async function getRoomMemberContext(userId, roomId) {
  const connection = await pool.getConnection();
  try {
    const hasRoomId = !!roomId;
    const query = hasRoomId
      ? `SELECT
           rm.room_id,
           rm.member_role,
           rm.can_manage_medication,
           rm.can_receive_schedule_notifications,
           rm.can_receive_medication_notifications,
           r.host_user_id
         FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE rm.user_id = ? AND rm.room_id = ?
         LIMIT 1`
      : `SELECT
           rm.room_id,
           rm.member_role,
           rm.can_manage_medication,
           rm.can_receive_schedule_notifications,
           rm.can_receive_medication_notifications,
           r.host_user_id
         FROM room_members rm
         INNER JOIN rooms r ON r.id = rm.room_id
         WHERE rm.user_id = ?
         ORDER BY rm.id DESC
         LIMIT 1`;
    const params = hasRoomId ? [userId, roomId] : [userId];
    const [rows] = await connection.execute(query, params);
    return rows[0] || null;
  } finally {
    connection.release();
  }
}

async function resolveAccessContext(req, userId) {
  const systemRole = (await Role.getUserRole(userId)) || "user";
  const requestedRoomId = resolveRequestedRoomId(req);
  const room = await getRoomMemberContext(userId, requestedRoomId);
  const roomRole = room?.member_role || null;
  const isAdmin = systemRole === "admin";
  const canReadRoomData = roomRole === ROOM_ROLE.HOST || roomRole === ROOM_ROLE.CARETAKER;
  const canManageRoomData = roomRole === ROOM_ROLE.HOST;
  const canManageMedication =
    roomRole === ROOM_ROLE.HOST || (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_manage_medication);

  return {
    userId,
    systemRole,
    isAdmin,
    requestedRoomId,
    room,
    roomId: room?.room_id || null,
    roomRole,
    hostUserId: roomRole === ROOM_ROLE.HOST ? userId : room?.host_user_id || null,
    canReadRoomData,
    canManageRoomData,
    canManageMedication,
  };
}

module.exports = {
  ROOM_ROLE,
  resolveAccessContext,
};
