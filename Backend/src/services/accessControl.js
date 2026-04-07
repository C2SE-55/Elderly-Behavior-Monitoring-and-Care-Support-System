const pool = require("../config/database");
const Role = require("../models/Role");

const ROOM_ROLE = {
  HOST: "host",
  CARETAKER: "caretaker",
};

const resolveRequestedRoomId = (req) => {
  // Ưu tiên query/body (gửi rõ room) trước header — tránh header axios cũ lệch với ?room_id
  const raw =
    req?.query?.room_id ??
    req?.body?.room_id ??
    req?.headers?.["x-room-id"] ??
    req?.params?.roomId ??
    null;
  const roomId = Number(raw);
  return roomId && !Number.isNaN(roomId) ? roomId : null;
};

async function getRoomMemberContext(userId, roomId) {
  const connection = await pool.getConnection();
  const hasRoomId = !!roomId;
  const queryWithLive = hasRoomId
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
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_view_live, 1)
           END AS can_view_live,
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
           CASE
             WHEN r.host_user_id = ? THEN 1
             ELSE COALESCE(rm.can_view_live, 1)
           END AS can_view_live,
           r.host_user_id
         FROM rooms r
         LEFT JOIN room_members rm
           ON rm.room_id = r.id
          AND rm.user_id = ?
         WHERE rm.user_id IS NOT NULL OR r.host_user_id = ?
         ORDER BY r.id DESC
         LIMIT 1`;
  const paramsWithLive = hasRoomId
    ? [userId, userId, userId, userId, userId, userId, roomId, userId]
    : [userId, userId, userId, userId, userId, userId, userId];

  const queryNoLive = hasRoomId
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
  const paramsNoLive = hasRoomId
    ? [userId, userId, userId, userId, userId, roomId, userId]
    : [userId, userId, userId, userId, userId, userId];

  try {
    const [rows] = await connection.execute(queryWithLive, paramsWithLive);
    return rows[0] || null;
  } catch (e) {
    if (e?.code === "ER_BAD_FIELD_ERROR" && String(e.sqlMessage || "").includes("can_view_live")) {
      const [rows] = await connection.execute(queryNoLive, paramsNoLive);
      const row = rows[0] || null;
      if (row) row.can_view_live = 1;
      return row;
    }
    throw e;
  } finally {
    connection.release();
  }
}

async function resolveAccessContext(req, userId) {
  const systemRole = (await Role.getUserRole(userId)) || "user";
  const requestedRoomId = resolveRequestedRoomId(req);
  const room = await getRoomMemberContext(userId, requestedRoomId);
  const roomRole = room?.member_role != null ? String(room.member_role).trim().toLowerCase() : null;
  const isAdmin = systemRole === "admin";
  const canReadRoomData = roomRole === ROOM_ROLE.HOST || roomRole === ROOM_ROLE.CARETAKER;
  const canManageRoomData = roomRole === ROOM_ROLE.HOST;
  // Caregiver luôn chỉ xem dữ liệu thuốc/lịch uống; không có quyền write.
  const canManageMedication = roomRole === ROOM_ROLE.HOST;
  const canReceiveScheduleNotifications =
    roomRole === ROOM_ROLE.HOST || (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_receive_schedule_notifications);
  const canReceiveMedicationNotifications =
    roomRole === ROOM_ROLE.HOST || (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_receive_medication_notifications);
  const canMarkMedicationIntake =
    roomRole === ROOM_ROLE.HOST ||
    (roomRole === ROOM_ROLE.CARETAKER && !!room?.can_receive_medication_notifications);
  const canViewLive =
    roomRole === ROOM_ROLE.HOST ||
    (roomRole === ROOM_ROLE.CARETAKER &&
      (room?.can_view_live === undefined || room?.can_view_live === null ? true : !!room.can_view_live));

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
    canMarkMedicationIntake,
    canViewLive,
  };
}

module.exports = {
  ROOM_ROLE,
  resolveAccessContext,
};
