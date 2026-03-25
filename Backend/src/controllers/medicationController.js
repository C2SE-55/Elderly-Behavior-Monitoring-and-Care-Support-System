const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationSystem = require("../models/MedicationSystem");

exports.getMedications = async (req, res) => {
  try {
    const userId = req.userId;
    const data = await MedicationSystem.getMedications(userId);
    return sendSuccess(res, data, "Lấy danh sách thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy danh sách thuốc:", error);
    return sendError(res, "Không thể lấy danh sách thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.createMedication = async (req, res) => {
  try {
    const userId = req.userId;
    const created = await MedicationSystem.createMedication(userId, req.body || {});
    return sendSuccess(res, created, "Tạo thuốc thành công", HTTP_STATUS.CREATED);
  } catch (error) {
    if (error?.code === "MEDICATION_NAME_REQUIRED") {
      return sendFail(res, "Tên thuốc là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi tạo thuốc:", error);
    return sendError(res, "Không thể tạo thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.updateMedication = async (req, res) => {
  try {
    const userId = req.userId;
    const medicationId = Number(req.params.id);
    if (!medicationId || Number.isNaN(medicationId)) {
      return sendFail(res, "ID thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.updateMedication(userId, medicationId, req.body || {});
    if (!ok) {
      return sendFail(res, "Không tìm thấy thuốc", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { id: medicationId }, "Cập nhật thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    if (error?.code === "MEDICATION_NAME_REQUIRED") {
      return sendFail(res, "Tên thuốc là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    console.error("Lỗi cập nhật thuốc:", error);
    return sendError(res, "Không thể cập nhật thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.deleteMedication = async (req, res) => {
  try {
    const userId = req.userId;
    const medicationId = Number(req.params.id);
    if (!medicationId || Number.isNaN(medicationId)) {
      return sendFail(res, "ID thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.deleteMedication(userId, medicationId);
    if (!ok) {
      return sendFail(res, "Không tìm thấy thuốc", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { id: medicationId }, "Xóa thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi xóa thuốc:", error);
    return sendError(res, "Không thể xóa thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};
