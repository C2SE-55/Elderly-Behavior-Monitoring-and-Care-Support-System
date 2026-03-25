const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationSystem = require("../models/MedicationSystem");
const { resolveAccessContext } = require("../services/accessControl");

exports.markTaken = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.body?.schedule_id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "schedule_id không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.markSchedule(context.hostUserId, scheduleId, "taken");
    if (!ok) {
      return sendFail(res, "Không tìm thấy lịch uống để đánh dấu", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { schedule_id: scheduleId, status: "taken" }, "Đã đánh dấu uống thuốc", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi mark taken:", error);
    return sendError(res, "Không thể cập nhật trạng thái uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.markSkipped = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.body?.schedule_id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "schedule_id không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.markSchedule(context.hostUserId, scheduleId, "skipped");
    if (!ok) {
      return sendFail(res, "Không tìm thấy lịch uống để đánh dấu", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { schedule_id: scheduleId, status: "skipped" }, "Đã đánh dấu bỏ qua", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi mark skipped:", error);
    return sendError(res, "Không thể cập nhật trạng thái bỏ qua", HTTP_STATUS.INTERNAL_ERROR);
  }
};
