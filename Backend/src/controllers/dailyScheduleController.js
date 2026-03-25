const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const { DailySchedule, VALID_DAYS, VALID_TYPES } = require("../models/DailySchedule");
const { resolveAccessContext } = require("../services/accessControl");

const normalizeType = (value) => String(value || "").trim().toLowerCase();

const validateCommonPayload = (payload, partial = false) => {
  const output = {};

  if (!partial || payload.day_of_week !== undefined) {
    const day = String(payload.day_of_week || "").trim().toLowerCase();
    if (!VALID_DAYS.includes(day)) return { error: "day_of_week không hợp lệ" };
    output.day_of_week = day;
  }
  if (!partial || payload.title !== undefined) {
    const title = String(payload.title || "").trim();
    if (!title) return { error: "title là bắt buộc" };
    output.title = title;
  }
  if (payload.description !== undefined) {
    output.description = String(payload.description || "").trim() || null;
  } else if (!partial) {
    output.description = null;
  }

  if (!partial || payload.start_time !== undefined) {
    const startTime = DailySchedule.normalizeTime(payload.start_time);
    if (!startTime) return { error: "start_time không hợp lệ (HH:mm hoặc HH:mm:ss)" };
    output.start_time = startTime;
  }
  if (!partial || payload.end_time !== undefined) {
    const endTime = DailySchedule.normalizeTime(payload.end_time);
    if (!endTime) return { error: "end_time không hợp lệ (HH:mm hoặc HH:mm:ss)" };
    output.end_time = endTime;
  }

  if ((output.start_time || output.end_time) && output.start_time && output.end_time) {
    if (output.start_time >= output.end_time) {
      return { error: "start_time phải nhỏ hơn end_time" };
    }
  }

  if (!partial || payload.type !== undefined) {
    const type = normalizeType(payload.type);
    if (!VALID_TYPES.includes(type)) return { error: "type không hợp lệ" };
    output.type = type;
  }

  return { data: output };
};

exports.getDailySchedules = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canReadRoomData || !context.hostUserId) {
      return sendFail(res, "Bạn không có quyền xem dữ liệu trong room", HTTP_STATUS.FORBIDDEN);
    }
    const userId = context.hostUserId;
    const rawProfileId = req.query.profile_id;
    let profileId = rawProfileId ? Number(rawProfileId) : null;

    if (!profileId) {
      profileId = await DailySchedule.getDefaultProfileIdByUserId(userId);
    }
    if (!profileId || Number.isNaN(profileId)) {
      return sendSuccess(res, [], "Chưa có hồ sơ sức khỏe", HTTP_STATUS.OK);
    }

    const ownsProfile = await DailySchedule.ensureProfileBelongsUser(userId, profileId);
    if (!ownsProfile) {
      return sendFail(res, "Không có quyền truy cập profile này", HTTP_STATUS.FORBIDDEN);
    }

    const data = await DailySchedule.getByProfileId(profileId);
    return sendSuccess(res, data, "Lấy lịch sinh hoạt thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy lịch sinh hoạt:", error);
    return sendError(res, "Không thể lấy lịch sinh hoạt", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.createDailySchedule = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageRoomData || !context.hostUserId) {
      return sendFail(res, "Chỉ HOST mới có quyền chỉnh sửa dữ liệu room", HTTP_STATUS.FORBIDDEN);
    }
    const userId = context.hostUserId;
    const rawProfileId = req.body?.profile_id;
    let profileId = rawProfileId ? Number(rawProfileId) : null;
    if (!profileId || Number.isNaN(profileId)) {
      profileId = await DailySchedule.getOrCreateDefaultProfileIdByUserId(userId);
    }

    const ownsProfile = await DailySchedule.ensureProfileBelongsUser(userId, profileId);
    if (!ownsProfile) {
      return sendFail(res, "Không có quyền truy cập profile này", HTTP_STATUS.FORBIDDEN);
    }

    const { data, error } = validateCommonPayload(req.body || {}, false);
    if (error) {
      return sendFail(res, error, HTTP_STATUS.BAD_REQUEST);
    }

    const id = await DailySchedule.create({ ...data, profile_id: profileId });
    return sendSuccess(res, { id, profile_id: profileId, ...data }, "Tạo lịch sinh hoạt thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    console.error("Lỗi tạo lịch sinh hoạt:", error);
    return sendError(res, "Không thể tạo lịch sinh hoạt", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateDailySchedule = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageRoomData || !context.hostUserId) {
      return sendFail(res, "Chỉ HOST mới có quyền chỉnh sửa dữ liệu room", HTTP_STATUS.FORBIDDEN);
    }
    const userId = context.hostUserId;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return sendFail(res, "ID lịch không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await DailySchedule.findOwnedSchedule(userId, id);
    if (!existing) {
      return sendFail(res, "Không tìm thấy lịch hoặc không có quyền", HTTP_STATUS.NOT_FOUND);
    }

    const { data, error } = validateCommonPayload(req.body || {}, true);
    if (error) {
      return sendFail(res, error, HTTP_STATUS.BAD_REQUEST);
    }

    if (data.start_time === undefined) data.start_time = existing.start_time;
    if (data.end_time === undefined) data.end_time = existing.end_time;
    if (data.start_time >= data.end_time) {
      return sendFail(res, "start_time phải nhỏ hơn end_time", HTTP_STATUS.BAD_REQUEST);
    }

    const affected = await DailySchedule.update(id, data);
    if (!affected) {
      return sendFail(res, "Không có thay đổi nào", HTTP_STATUS.BAD_REQUEST);
    }
    return sendSuccess(res, { id, ...data }, "Cập nhật lịch sinh hoạt thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi cập nhật lịch sinh hoạt:", error);
    return sendError(res, "Không thể cập nhật lịch sinh hoạt", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.deleteDailySchedule = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageRoomData || !context.hostUserId) {
      return sendFail(res, "Chỉ HOST mới có quyền chỉnh sửa dữ liệu room", HTTP_STATUS.FORBIDDEN);
    }
    const userId = context.hostUserId;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return sendFail(res, "ID lịch không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const existing = await DailySchedule.findOwnedSchedule(userId, id);
    if (!existing) {
      return sendFail(res, "Không tìm thấy lịch hoặc không có quyền", HTTP_STATUS.NOT_FOUND);
    }

    await DailySchedule.remove(id);
    return sendSuccess(res, { id }, "Xóa lịch sinh hoạt thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi xóa lịch sinh hoạt:", error);
    return sendError(res, "Không thể xóa lịch sinh hoạt", HTTP_STATUS.INTERNAL_ERROR);
  }
};
