const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const { Room } = require("../models/Room");
const MedicationSystem = require("../models/MedicationSystem");
const { resolveAccessContext } = require("../services/accessControl");
const { emitMedicationSchedulesChanged } = require("../services/socketServer");

/**
 * Chuẩn hoá nội dung từ QR / OCR (dấu hai chấm Unicode, BOM, khoảng trắng quanh ":").
 * Tránh: ADMIN_JOIN：... không khớp regex ASCII → nhánh startsWith("ADMIN_") gửi nhầm cả chuỗi vào CSDL.
 */
const normalizeRoomJoinPayload = (raw) => {
  let s = String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/\u200b/g, "")
    .replace(/\r|\n/g, "")
    .trim()
    .replace(/[\uFF1A\uFE55\u02F8]/g, ":");
  s = s.replace(/\s*:\s*/g, ":");
  return s.trim();
};

/** Token lưu trong DB: ADMIN_<hex> — không dùng startsWith("ADMIN_") vì trùng tiền tố "ADMIN_JOIN". */
const isBareAdminJoinToken = (s) => /^ADMIN_[a-f0-9]+$/i.test(s);

exports.adminCreateRoom = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return sendFail(res, "Chỉ admin có quyền tạo room", HTTP_STATUS.FORBIDDEN);
    }

    const room = await Room.createByAdmin(req.userId);
    return sendSuccess(
      res,
      {
        id: room.id,
        room_id: room.room_id,
        admin_join_token: room.admin_join_token,
        admin_qr_payload: `ADMIN_JOIN:${room.admin_join_token}`,
      },
      "Tạo room thành công",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Lỗi admin tạo room:", error);
    return sendError(res, "Không thể tạo room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.adminGetAllRooms = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return sendFail(res, "Chỉ admin có quyền xem danh sách room", HTTP_STATUS.FORBIDDEN);
    }
    const rooms = await Room.listByAdmin(null);
    const mapped = rooms.map((room) => ({
      ...room,
      admin_qr_payload: room.admin_join_token ? `ADMIN_JOIN:${room.admin_join_token}` : null,
      host_qr_payload: room.host_join_token ? `HOST_JOIN:${room.host_join_token}` : null,
    }));
    return sendSuccess(res, mapped, "Lấy danh sách room thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy danh sách room:", error);
    return sendError(res, "Không thể lấy danh sách room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.adminDeleteRoom = async (req, res) => {
  try {
    if (req.userRole !== "admin") {
      return sendFail(res, "Chỉ admin có quyền xóa room", HTTP_STATUS.FORBIDDEN);
    }
    const roomId = Number(req.params.roomId);
    if (!roomId || Number.isNaN(roomId)) {
      return sendFail(res, "roomId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await Room.deleteRoomByAdmin(roomId);
    return sendSuccess(res, result, "Xóa room thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "ROOM_NOT_FOUND") {
      return sendFail(res, "Không tìm thấy room", HTTP_STATUS.NOT_FOUND);
    }
    console.error("Lỗi xóa room:", error);
    return sendError(res, "Không thể xóa room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.joinByAdminRoomCode = async (req, res) => {
  try {
    const raw = normalizeRoomJoinPayload(String(req.body?.room_id || ""));
    if (!raw) {
      return sendFail(res, "room_id là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const adminJoinFromQr = raw.match(/^ADMIN_JOIN:(.+)$/i);
    let result;
    if (adminJoinFromQr) {
      const token = normalizeRoomJoinPayload(String(adminJoinFromQr[1] || ""));
      if (!token) {
        return sendFail(res, "Mã QR admin không hợp lệ", HTTP_STATUS.BAD_REQUEST);
      }
      result = await Room.promoteUserToHostByAdminJoinToken(req.userId, token);
    } else if (isBareAdminJoinToken(raw)) {
      result = await Room.promoteUserToHostByAdminJoinToken(req.userId, raw);
    } else {
      result = await Room.promoteUserToHostByAdminRoomCode(req.userId, raw);
    }
    const alreadyHost = result.already_host === true;
    return sendSuccess(
      res,
      {
        room_id: result.room_id,
        role_in_room: "host",
        host_join_token: result.host_join_token,
        host_qr_payload: `HOST_JOIN:${result.host_join_token}`,
        already_in_room: alreadyHost,
      },
      alreadyHost
        ? "Bạn đã là chủ phòng (HOST) của phòng này rồi."
        : "Join room thành công, tài khoản đã nâng cấp thành HOST",
      HTTP_STATUS.OK
    );
  } catch (error) {
    if (error?.code === "ROOM_NOT_FOUND") {
      const raw = normalizeRoomJoinPayload(String(req.body?.room_id || ""));
      const isAdminQr = /^ADMIN_JOIN:/i.test(raw) || isBareAdminJoinToken(raw);
      return sendFail(
        res,
        isAdminQr
          ? "Mã QR admin không đúng hoặc phòng đã bị xóa. Hãy nhờ admin làm mới QR."
          : "room_id không hợp lệ hoặc không tồn tại trên hệ thống.",
        HTTP_STATUS.NOT_FOUND
      );
    }
    if (error?.code === "ROOM_ALREADY_HAS_HOST") {
      return sendFail(res, "Room này đã có HOST", HTTP_STATUS.CONFLICT);
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return sendFail(res, "Bạn đã có trong phòng này rồi.", HTTP_STATUS.CONFLICT);
    }
    console.error("Lỗi join room bằng room_id admin:", error);
    return sendError(res, "Không thể join room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.joinByHostQr = async (req, res) => {
  try {
    let hostJoinToken = normalizeRoomJoinPayload(String(req.body?.host_join_token || ""));
    const fromQr = hostJoinToken.match(/^HOST_JOIN:(.+)$/i);
    if (fromQr) {
      hostJoinToken = normalizeRoomJoinPayload(String(fromQr[1] || ""));
    }
    if (!hostJoinToken) {
      return sendFail(res, "host_join_token là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await Room.joinAsCaretakerByHostToken(req.userId, hostJoinToken);
    const alreadyIn = result.already_member === true || result.already_host === true;
    const asHost = result.already_host === true;
    let message = "Join room thành công, tài khoản đã trở thành CARETAKER";
    if (asHost) {
      message = "Bạn là chủ phòng (HOST) của phòng này rồi — không cần quét mã dành cho người chăm sóc.";
    } else if (result.already_member === true) {
      message = "Bạn đã có sẵn trong phòng này (vai trò người chăm sóc).";
    }
    return sendSuccess(
      res,
      {
        room_id: result.room_id,
        role_in_room: asHost ? "host" : "caretaker",
        already_in_room: alreadyIn,
        already_host: asHost,
      },
      message,
      HTTP_STATUS.OK
    );
  } catch (error) {
    if (error?.code === "HOST_QR_INVALID") {
      return sendFail(res, "QR host không hợp lệ", HTTP_STATUS.NOT_FOUND);
    }
    if (error?.code === "ROOM_HAS_NO_HOST") {
      return sendFail(res, "Room chưa có HOST", HTTP_STATUS.CONFLICT);
    }
    if (error?.code === "HOST_CANNOT_JOIN_SELF") {
      return sendFail(res, "Bạn là chủ phòng này rồi — không cần quét mã dành cho người chăm sóc.", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "ALREADY_HOST_IN_ROOM") {
      return sendFail(
        res,
        "Bạn đã có trong phòng này với vai trò chủ phòng (HOST). Không cần quét mã người chăm sóc.",
        HTTP_STATUS.CONFLICT
      );
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return sendFail(res, "Bạn đã có trong phòng này rồi.", HTTP_STATUS.CONFLICT);
    }
    console.error("Lỗi join room bằng host QR:", error);
    return sendError(res, "Không thể join room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getMyRoom = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId) {
      return sendSuccess(res, null, "Chưa chọn room hoặc không có quyền trong room", HTTP_STATUS.OK);
    }
    const rows = await Room.listRoomsByUser(req.userId);
    const data = rows.find((row) => Number(row.id) === Number(context.roomId)) || null;
    return sendSuccess(res, data, "Lấy thông tin room thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy room hiện tại:", error);
    return sendError(res, "Không thể lấy thông tin room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getMyRooms = async (req, res) => {
  try {
    const rows = await Room.listRoomsByUser(req.userId);
    return sendSuccess(res, rows, "Lấy danh sách room thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy danh sách room của user:", error);
    return sendError(res, "Không thể lấy danh sách room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getMembers = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (context.roomRole !== "host" || !context.roomId) {
      return sendFail(res, "Chỉ HOST mới có quyền xem và quản lý thành viên", HTTP_STATUS.FORBIDDEN);
    }
    const members = await Room.listMembers(context.roomId);
    return sendSuccess(res, members, "Lấy danh sách thành viên thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy thành viên room:", error);
    return sendError(res, "Không thể lấy danh sách thành viên", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateCaretakerPermissions = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (context.roomRole !== "host" || !context.roomId) {
      return sendFail(res, "Chỉ HOST mới có quyền cập nhật quyền", HTTP_STATUS.FORBIDDEN);
    }
    const targetUserId = Number(req.params.userId);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return sendFail(res, "userId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    await Room.updateCaretakerPermissions(context.roomId, targetUserId, req.body || {});
    return sendSuccess(res, { user_id: targetUserId }, "Cập nhật quyền thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "CARETAKER_NOT_FOUND") {
      return sendFail(res, "Không tìm thấy CARETAKER trong room", HTTP_STATUS.NOT_FOUND);
    }
    if (error?.code === "NO_PERMISSION_CHANGE") {
      return sendFail(res, "Không có thay đổi quyền nào được gửi", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi cập nhật quyền caretaker:", error);
    return sendError(res, "Không thể cập nhật quyền", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.kickCaretaker = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (context.roomRole !== "host" || !context.roomId) {
      return sendFail(res, "Chỉ HOST mới có quyền kick thành viên", HTTP_STATUS.FORBIDDEN);
    }
    const targetUserId = Number(req.params.userId);
    if (!targetUserId || Number.isNaN(targetUserId)) {
      return sendFail(res, "userId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    await Room.removeCaretaker(context.roomId, targetUserId);
    return sendSuccess(res, { user_id: targetUserId }, "Kick CARETAKER thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "CARETAKER_NOT_FOUND") {
      return sendFail(res, "Không tìm thấy CARETAKER trong room", HTTP_STATUS.NOT_FOUND);
    }
    console.error("Lỗi kick caretaker:", error);
    return sendError(res, "Không thể kick thành viên", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getRoomPatient = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canReadRoomData || !context.roomId) {
      return sendFail(res, "Bạn không có quyền xem thông tin bệnh nhân trong room", HTTP_STATUS.FORBIDDEN);
    }
    const patient = await Room.getRoomPatient(context.roomId);
    return sendSuccess(res, patient, "Lấy thông tin bệnh nhân thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy thông tin bệnh nhân room:", error);
    return sendError(res, "Không thể lấy thông tin bệnh nhân", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateRoomPatient = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (context.roomRole !== "host" || !context.roomId) {
      return sendFail(res, "Chỉ HOST mới có quyền cập nhật thông tin bệnh nhân", HTTP_STATUS.FORBIDDEN);
    }
    const row = await Room.upsertRoomPatient(context.roomId, req.body || {});
    return sendSuccess(res, row, "Cập nhật thông tin bệnh nhân thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "PATIENT_NAME_REQUIRED") {
      return sendFail(res, "full_name là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "ROOM_PATIENT_NOT_AVAILABLE") {
      return sendFail(
        res,
        "CSDL hiện tại chưa có bảng room_patients. Chức năng này tạm thời không khả dụng.",
        HTTP_STATUS.BAD_REQUEST
      );
    }
    console.error("Lỗi cập nhật thông tin bệnh nhân room:", error);
    return sendError(res, "Không thể cập nhật thông tin bệnh nhân", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateMedicationDailyReminders = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (context.roomRole !== "host" || !context.roomId) {
      return sendFail(res, "Chỉ HOST mới bật/tắt nhắc thuốc lặp hằng ngày", HTTP_STATUS.FORBIDDEN);
    }
    const raw = req.body?.enabled;
    if (raw === undefined || raw === null) {
      return sendFail(res, "enabled là bắt buộc (true/false)", HTTP_STATUS.BAD_REQUEST);
    }
    const on = raw === true || raw === 1 || raw === "1" || raw === "true";
    await Room.setMedicationDailyRemindersEnabled(context.roomId, on);
    void emitMedicationSchedulesChanged(context.roomId).catch(() => {});
    return sendSuccess(
      res,
      { medication_daily_reminders_enabled: on ? 1 : 0 },
      on ? "Đã bật nhắc thuốc hằng ngày trên thiết bị" : "Đã tắt nhắc thuốc hằng ngày trên thiết bị",
      HTTP_STATUS.OK
    );
  } catch (error) {
    if (error?.code === "MEDICATION_DAILY_COLUMN_MISSING") {
      return sendFail(
        res,
        "CSDL chưa có cột cài đặt. Chạy migration 006_rooms_medication_daily_reminders.sql.",
        HTTP_STATUS.BAD_REQUEST
      );
    }
    console.error("Lỗi cập nhật nhắc thuốc hằng ngày:", error);
    return sendError(res, "Không thể cập nhật cài đặt", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getMedicationIntakeStats = async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    if (!roomId || Number.isNaN(roomId)) {
      return sendFail(res, "roomId không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId || Number(context.roomId) !== roomId) {
      return sendFail(res, "Room không khớp với ngữ cảnh tài khoản", HTTP_STATUS.FORBIDDEN);
    }
    if (context.roomRole !== "host") {
      return sendFail(res, "Chỉ người thân (host) xem được thống kê", HTTP_STATUS.FORBIDDEN);
    }

    const hostProfileUserId = context.hostUserId || req.userId;
    const from = String(req.query.from || "").trim().slice(0, 10);
    const to = String(req.query.to || "").trim().slice(0, 10);
    const iso = /^\d{4}-\d{2}-\d{2}$/;

    let data;
    if (iso.test(from) && iso.test(to)) {
      data = await MedicationSystem.listMedicationIntakeStatsForDateRange(hostProfileUserId, roomId, from, to);
    } else {
      const period = String(req.query.period || "day").toLowerCase();
      if (!["day", "week", "month"].includes(period)) {
        return sendFail(res, "period phải là day, week hoặc month", HTTP_STATUS.BAD_REQUEST);
      }

      const pad2 = (n) => String(n).padStart(2, "0");
      const now = new Date();
      const defaultAnchor = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
      const anchor = String(req.query.anchor || defaultAnchor).trim().slice(0, 10);

      data = await MedicationSystem.listMedicationIntakeStats(hostProfileUserId, roomId, period, anchor);
    }
    return sendSuccess(res, data, "Lấy thống kê uống thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "INVALID_STATS_RANGE") {
      return sendFail(res, "Tham số anchor hoặc period không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "STATS_RANGE_TOO_LARGE") {
      return sendFail(res, "Khoảng thời gian quá dài (tối đa 400 ngày)", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi thống kê uống thuốc:", error);
    return sendError(res, "Không thể lấy thống kê uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};
