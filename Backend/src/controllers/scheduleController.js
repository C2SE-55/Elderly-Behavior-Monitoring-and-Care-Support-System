const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationSystem = require("../models/MedicationSystem");
const { resolveAccessContext } = require("../services/accessControl");

exports.createSchedules = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const data = await MedicationSystem.createSchedules(context.hostUserId, context.roomId, req.body || {});
    return sendSuccess(res, data, "Tạo lịch uống thuốc thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    if (error?.code === "INVALID_ALARM_TIME") {
      return sendFail(res, "Giờ uống không hợp lệ (HH:mm hoặc HH:mm:ss)", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "SCHEDULE_MEDICATIONS_REQUIRED") {
      return sendFail(res, "Vui lòng chọn ít nhất 1 thuốc cho lịch", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "SCHEDULE_TIME_PASSED") {
      return sendFail(res, "Không thể tạo lịch trong quá khứ. Vui lòng chọn giờ hiện tại hoặc muộn hơn.", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "MEDICATION_NOT_FOUND") {
      return sendFail(res, "Thuốc không tồn tại hoặc không thuộc tài khoản", HTTP_STATUS.NOT_FOUND);
    }
    if (error?.code === "MEDICATION_NAME_REQUIRED") {
      return sendFail(res, "Tên thuốc là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi tạo lịch uống thuốc:", error);
    return sendError(res, "Không thể tạo lịch uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.getTodaySchedules = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canReadRoomData || !context.hostUserId) {
      return sendFail(res, "Bạn không có quyền xem dữ liệu trong room", HTTP_STATUS.FORBIDDEN);
    }
    const rows = await MedicationSystem.getTodaySchedules(context.hostUserId, context.roomId);

    const data = rows.map((item) => {
      const alarm = String(item.alarm_time).slice(0, 5);
      const status = item.today_status ? String(item.today_status) : "pending";

      return {
        id: item.id,
        alarm_time: alarm,
        repeat_type: item.repeat_type,
        is_active: !!item.is_active,
        medication_id: item.medication_id,
        name: item.name,
        dosage: item.dosage,
        note: item.note,
        status,
      };
    });

    return sendSuccess(res, data, "Lấy lịch uống thuốc hôm nay thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy lịch uống hôm nay:", error);
    return sendError(res, "Không thể lấy lịch uống hôm nay", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.params.id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "ID lịch uống không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const ok = await MedicationSystem.updateSchedule(context.hostUserId, context.roomId, scheduleId, req.body || {});
    if (!ok) {
      return sendFail(res, "Không tìm thấy lịch uống", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { id: scheduleId }, "Cập nhật lịch uống thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "INVALID_ALARM_TIME") {
      return sendFail(res, "Giờ uống không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi cập nhật lịch uống:", error);
    return sendError(res, "Không thể cập nhật lịch uống", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.deleteSchedulesForSlot = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const alarmTime = String(req.body?.alarm_time || "").trim();
    if (!alarmTime) {
      return sendFail(res, "alarm_time là bắt buộc (HH:mm)", HTTP_STATUS.BAD_REQUEST);
    }
    const result = await MedicationSystem.deleteSchedulesForSlot(
      context.hostUserId,
      context.roomId,
      alarmTime
    );
    return sendSuccess(
      res,
      { deleted: result.deleted, schedule_ids: result.schedule_ids },
      `Đã xóa ${result.deleted} lịch trong khung giờ`,
      HTTP_STATUS.OK
    );
  } catch (error) {
    if (error?.code === "INVALID_ALARM_TIME") {
      return sendFail(res, "Giờ không hợp lệ (HH:mm)", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi xóa lịch theo khung giờ:", error);
    return sendError(res, "Không thể xóa lịch uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.deleteSchedule = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.params.id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "ID lịch uống không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const ok = await MedicationSystem.deleteSchedule(context.hostUserId, context.roomId, scheduleId);
    if (!ok) {
      return sendFail(res, "Không tìm thấy lịch uống", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { id: scheduleId }, "Xóa lịch uống thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi xóa lịch uống:", error);
    return sendError(res, "Không thể xóa lịch uống", HTTP_STATUS.INTERNAL_ERROR);
  }
};
