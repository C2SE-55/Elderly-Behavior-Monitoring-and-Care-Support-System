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
           r.id AS room_id,
           CASE
             WHEN r.host_user_id = ? THEN 'host'
             ELSE rm.member_role
           END AS member_role,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_manage_medication, 0)
           END AS can_manage_medication,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_receive_schedule_notifications, 0)
           END AS can_receive_schedule_notifications,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_receive_medication_notifications, 0)
           END AS can_receive_medication_notifications,
           r.host_user_id
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE r.id = ?
           AND (rm.user_id IS NOT NULL OR r.host_user_id = ?)
         LIMIT 1`
      : `SELECT
           r.id AS room_id,
           CASE
             WHEN r.host_user_id = ? THEN 'host'
             ELSE rm.member_role
           END AS member_role,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_manage_medication, 0)
           END AS can_manage_medication,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_receive_schedule_notifications, 0)
           END AS can_receive_schedule_notifications,
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_receive_medication_notifications, 0)
           END AS can_receive_medication_notifications,
           r.host_user_id
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE rm.user_id IS NOT NULL OR r.host_user_id = ?
         ORDER BY r.id DESC
         LIMIT 1`;
    const params = hasRoomId
      ? [userId, userId, userId, userId, userId, roomId, userId]
      : [userId, userId, userId, userId, userId, userId];
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
  // Caregiver luôn chỉ xem dữ liệu thuốc/lịch uống; không có quyền write.
  const canManageMedication = roomRole === ROOM_ROLE.HOST;
  const canReceiveScheduleNotifications =
    roomRole === ROOM_ROLE.HOST || (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_receive_schedule_notifications);
  const canReceiveMedicationNotifications =
    roomRole === ROOM_ROLE.HOST || (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_receive_medication_notifications);

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
    canReceiveScheduleNotifications,
    canReceiveMedicationNotifications,
  };
}

module.exports = {
  ROOM_ROLE,
  resolveAccessContext,
};
