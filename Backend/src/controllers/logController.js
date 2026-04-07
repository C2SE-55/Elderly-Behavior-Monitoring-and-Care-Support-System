const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationSystem = require("../models/MedicationSystem");
const { resolveAccessContext } = require("../services/accessControl");
const { emitMedicationIntake } = require("../services/socketServer");

exports.markTaken = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId || !context.hostUserId) {
      return sendFail(res, "Bạn không thuộc room này", HTTP_STATUS.FORBIDDEN);
    }
    if (!context.canMarkMedicationIntake) {
      return sendFail(
        res,
        "Bạn không có quyền xác nhận uống thuốc trong room này",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.body?.schedule_id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "schedule_id không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const result = await MedicationSystem.markSchedule(
      context.hostUserId,
      context.roomId,
      scheduleId,
      "taken",
      req.userId
    );
    if (!result.ok) {
      return sendFail(res, "Không tìm thấy lịch uống để đánh dấu", HTTP_STATUS.NOT_FOUND);
    }
    await emitMedicationIntake(context.roomId, {
      schedule_id: result.schedule_id,
      schedule_ids: [result.schedule_id],
      status: result.status,
      date: result.intake_date,
      acted_by_user_id: result.acted_by_user_id,
      acted_by_name: result.acted_by_name,
      medication_name: result.medication_name,
    });
    return sendSuccess(
      res,
      {
        schedule_id: result.schedule_id,
        schedule_ids: [result.schedule_id],
        status: result.status,
        inserted: result.inserted,
        intake_date: result.intake_date,
        acted_by_user_id: result.acted_by_user_id,
        acted_by_name: result.acted_by_name,
      },
      result.inserted ? "Đã đánh dấu uống thuốc" : "Lịch này đã được xác nhận hôm nay",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Lỗi mark taken:", error);
    return sendError(res, "Không thể cập nhật trạng thái uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.markSkipped = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId || !context.hostUserId) {
      return sendFail(res, "Bạn không thuộc room này", HTTP_STATUS.FORBIDDEN);
    }
    if (!context.canMarkMedicationIntake) {
      return sendFail(
        res,
        "Bạn không có quyền xác nhận uống thuốc trong room này",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const scheduleId = Number(req.body?.schedule_id);
    if (!scheduleId || Number.isNaN(scheduleId)) {
      return sendFail(res, "schedule_id không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const result = await MedicationSystem.markSchedule(
      context.hostUserId,
      context.roomId,
      scheduleId,
      "skipped",
      req.userId
    );
    if (!result.ok) {
      return sendFail(res, "Không tìm thấy lịch uống để đánh dấu", HTTP_STATUS.NOT_FOUND);
    }
    await emitMedicationIntake(context.roomId, {
      schedule_id: result.schedule_id,
      schedule_ids: [result.schedule_id],
      status: result.status,
      date: result.intake_date,
      acted_by_user_id: result.acted_by_user_id,
      acted_by_name: result.acted_by_name,
      medication_name: result.medication_name,
    });
    return sendSuccess(
      res,
      {
        schedule_id: result.schedule_id,
        schedule_ids: [result.schedule_id],
        status: result.status,
        inserted: result.inserted,
        intake_date: result.intake_date,
        acted_by_user_id: result.acted_by_user_id,
        acted_by_name: result.acted_by_name,
      },
      result.inserted ? "Đã đánh dấu bỏ qua" : "Lịch này đã được xác nhận hôm nay",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Lỗi mark skipped:", error);
    return sendError(res, "Không thể cập nhật trạng thái bỏ qua", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.markSlotTaken = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId || !context.hostUserId) {
      return sendFail(res, "Bạn không thuộc room này", HTTP_STATUS.FORBIDDEN);
    }
    if (!context.canMarkMedicationIntake) {
      return sendFail(
        res,
        "Bạn không có quyền xác nhận uống thuốc trong room này",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const alarmTime = String(req.body?.alarm_time || "").trim();
    if (!alarmTime) {
      return sendFail(res, "alarm_time là bắt buộc (HH:mm)", HTTP_STATUS.BAD_REQUEST);
    }
    const dateOpt = req.body?.date ? String(req.body.date).trim().slice(0, 10) : null;

    const result = await MedicationSystem.markSlot(
      context.hostUserId,
      context.roomId,
      alarmTime,
      "taken",
      req.userId,
      dateOpt
    );
    if (!result.ok) {
      if (result.code === "INVALID_ALARM_TIME") {
        return sendFail(res, "Giờ không hợp lệ (HH:mm)", HTTP_STATUS.BAD_REQUEST);
      }
      return sendFail(res, "Không tìm thấy lịch cho khung giờ này", HTTP_STATUS.NOT_FOUND);
    }
    await emitMedicationIntake(context.roomId, {
      schedule_id: result.schedule_ids[0],
      schedule_ids: result.schedule_ids,
      alarm_time: result.alarm_time,
      status: result.status,
      date: result.intake_date,
      acted_by_user_id: result.acted_by_user_id,
      acted_by_name: result.acted_by_name,
    });
    return sendSuccess(
      res,
      {
        schedule_ids: result.schedule_ids,
        alarm_time: result.alarm_time,
        status: result.status,
        inserted: result.inserted,
        intake_date: result.intake_date,
        acted_by_user_id: result.acted_by_user_id,
        acted_by_name: result.acted_by_name,
      },
      result.inserted ? "Đã xác nhận uống thuốc (cả đơn)" : "Đơn giờ này đã được xác nhận",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Lỗi mark slot taken:", error);
    return sendError(res, "Không thể cập nhật trạng thái uống thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.markSlotSkipped = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.roomId || !context.hostUserId) {
      return sendFail(res, "Bạn không thuộc room này", HTTP_STATUS.FORBIDDEN);
    }
    if (!context.canMarkMedicationIntake) {
      return sendFail(
        res,
        "Bạn không có quyền xác nhận uống thuốc trong room này",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const alarmTime = String(req.body?.alarm_time || "").trim();
    if (!alarmTime) {
      return sendFail(res, "alarm_time là bắt buộc (HH:mm)", HTTP_STATUS.BAD_REQUEST);
    }
    const dateOpt = req.body?.date ? String(req.body.date).trim().slice(0, 10) : null;

    const result = await MedicationSystem.markSlot(
      context.hostUserId,
      context.roomId,
      alarmTime,
      "skipped",
      req.userId,
      dateOpt
    );
    if (!result.ok) {
      if (result.code === "INVALID_ALARM_TIME") {
        return sendFail(res, "Giờ không hợp lệ (HH:mm)", HTTP_STATUS.BAD_REQUEST);
      }
      return sendFail(res, "Không tìm thấy lịch cho khung giờ này", HTTP_STATUS.NOT_FOUND);
    }
    await emitMedicationIntake(context.roomId, {
      schedule_id: result.schedule_ids[0],
      schedule_ids: result.schedule_ids,
      alarm_time: result.alarm_time,
      status: result.status,
      date: result.intake_date,
      acted_by_user_id: result.acted_by_user_id,
      acted_by_name: result.acted_by_name,
    });
    return sendSuccess(
      res,
      {
        schedule_ids: result.schedule_ids,
        alarm_time: result.alarm_time,
        status: result.status,
        inserted: result.inserted,
        intake_date: result.intake_date,
        acted_by_user_id: result.acted_by_user_id,
        acted_by_name: result.acted_by_name,
      },
      result.inserted ? "Đã bỏ qua (cả đơn)" : "Đơn giờ này đã được xác nhận",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Lỗi mark slot skipped:", error);
    return sendError(res, "Không thể cập nhật trạng thái bỏ qua", HTTP_STATUS.INTERNAL_ERROR);
  }
};
