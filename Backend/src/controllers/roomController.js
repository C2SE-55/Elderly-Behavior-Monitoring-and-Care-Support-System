const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const { Room } = require("../models/Room");
const { resolveAccessContext } = require("../services/accessControl");

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
    const roomId = String(req.body?.room_id || "").trim();
    if (!roomId) {
      return sendFail(res, "room_id là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await Room.promoteUserToHostByAdminRoomCode(req.userId, roomId);
    return sendSuccess(
      res,
      {
        room_id: result.room_id,
        role_in_room: "host",
        host_join_token: result.host_join_token,
        host_qr_payload: `HOST_JOIN:${result.host_join_token}`,
      },
      "Join room thành công, tài khoản đã nâng cấp thành HOST",
      HTTP_STATUS.OK
    );
  } catch (error) {
    if (error?.code === "ROOM_NOT_FOUND") {
      return sendFail(res, "room_id không hợp lệ", HTTP_STATUS.NOT_FOUND);
    }
    if (error?.code === "ROOM_ALREADY_HAS_HOST") {
      return sendFail(res, "Room này đã có HOST", HTTP_STATUS.CONFLICT);
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return sendFail(
        res,
        "CSDL hiện tại còn ràng buộc UNIQUE theo user ở room_members/rooms. Vui lòng cập nhật schema để cho phép 1 user ở nhiều room.",
        HTTP_STATUS.CONFLICT
      );
    }
    console.error("Lỗi join room bằng room_id admin:", error);
    return sendError(res, "Không thể join room", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.joinByHostQr = async (req, res) => {
  try {
    const hostJoinToken = String(req.body?.host_join_token || "").trim();
    if (!hostJoinToken) {
      return sendFail(res, "host_join_token là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const result = await Room.joinAsCaretakerByHostToken(req.userId, hostJoinToken);
    return sendSuccess(
      res,
      {
        room_id: result.room_id,
        role_in_room: "caretaker",
      },
      "Join room thành công, tài khoản đã trở thành CARETAKER",
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
      return sendFail(res, "HOST không thể tự quét QR của chính mình", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "ALREADY_HOST_IN_ROOM") {
      return sendFail(res, "Bạn đã là HOST trong room này", HTTP_STATUS.CONFLICT);
    }
    if (error?.code === "ER_DUP_ENTRY") {
      return sendFail(
        res,
        "CSDL hiện tại còn ràng buộc UNIQUE theo user ở room_members/rooms. Vui lòng cập nhật schema để cho phép 1 user ở nhiều room.",
        HTTP_STATUS.CONFLICT
      );
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
