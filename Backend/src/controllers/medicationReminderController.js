const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationReminder = require("../models/MedicationReminder");

exports.getReminders = async (req, res) => {
  try {
    const userId = req.userId;
    const data = await MedicationReminder.getAllByUser(userId);
    return sendSuccess(res, data, "Lấy danh sách nhắc thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy danh sách nhắc thuốc:", error);
    return sendError(res, "Không thể lấy danh sách nhắc thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.createReminder = async (req, res) => {
  try {
    const userId = req.userId;
    const created = await MedicationReminder.createForUser(userId, req.body || {});
    return sendSuccess(res, created, "Tạo lịch nhắc thuốc thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    if (error?.code === "MEDICINE_NAME_REQUIRED") {
      return sendFail(res, "Tên thuốc là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    if (error?.code === "INVALID_REMINDER_TIME") {
      return sendFail(res, "Giờ nhắc không hợp lệ (định dạng HH:mm hoặc HH:mm:ss)", HTTP_STATUS.BAD_REQUEST);
    }

    console.error("Lỗi tạo lịch nhắc thuốc:", error);
    return sendError(res, "Không thể tạo lịch nhắc thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateReminder = async (req, res) => {
  // Chưa cần dùng trong frontend hiện tại. Giữ endpoint để tránh 404.
  return sendFail(res, "Chức năng cập nhật đầy đủ sẽ được bổ sung sau", HTTP_STATUS.BAD_REQUEST);
};

exports.updateStatus = async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    const status = String(req.body?.status || "").trim().toLowerCase();

    if (!id || Number.isNaN(id)) {
      return sendFail(res, "ID nhắc thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    if (!["done", "pending", "early"].includes(status)) {
      return sendFail(res, "Trạng thái phải là done, pending hoặc early", HTTP_STATUS.BAD_REQUEST);
    }

    const ok = await MedicationReminder.updateStatus(userId, id, status);
    if (!ok) {
      return sendFail(res, "Không thể cập nhật trạng thái nhắc thuốc", HTTP_STATUS.BAD_REQUEST);
    }
    return sendSuccess(res, { id, status }, "Cập nhật trạng thái thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi cập nhật trạng thái nhắc thuốc:", error);
    return sendError(res, "Không thể cập nhật trạng thái", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.markDone = async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return sendFail(res, "ID nhắc thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationReminder.markDone(userId, id);
    if (!ok) {
      return sendFail(res, "Không thể đánh dấu đã uống", HTTP_STATUS.BAD_REQUEST);
    }
    return sendSuccess(res, { id, status: "done" }, "Đánh dấu đã uống thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi đánh dấu đã uống:", error);
    return sendError(res, "Không thể cập nhật trạng thái", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.deleteReminder = async (req, res) => {
  try {
    const userId = req.userId;
    const id = Number(req.params.id);
    if (!id || Number.isNaN(id)) {
      return sendFail(res, "ID nhắc thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }

    const ok = await MedicationReminder.deleteById(userId, id);
    if (!ok) {
      return sendFail(res, "Không thể xóa nhắc thuốc", HTTP_STATUS.BAD_REQUEST);
    }
    return sendSuccess(res, { id }, "Xóa nhắc thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi xóa nhắc thuốc:", error);
    return sendError(res, "Không thể xóa nhắc thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};
