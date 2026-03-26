const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const MedicationSystem = require("../models/MedicationSystem");
const { resolveAccessContext } = require("../services/accessControl");

exports.getMedications = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canReadRoomData || !context.hostUserId) {
      return sendFail(res, "Bạn không có quyền xem dữ liệu trong room", HTTP_STATUS.FORBIDDEN);
    }
    const data = await MedicationSystem.getMedications(context.hostUserId, context.roomId);
    return sendSuccess(res, data, "Lấy danh sách thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi lấy danh sách thuốc:", error);
    return sendError(res, "Không thể lấy danh sách thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};

exports.createMedication = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const created = await MedicationSystem.createMedication(context.hostUserId, context.roomId, req.body || {});
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
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const medicationId = Number(req.params.id);
    if (!medicationId || Number.isNaN(medicationId)) {
      return sendFail(res, "ID thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.updateMedication(
      context.hostUserId,
      context.roomId,
      medicationId,
      req.body || {}
    );
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
    const context = await resolveAccessContext(req, req.userId);
    if (!context.canManageMedication || !context.hostUserId) {
      return sendFail(
        res,
        "Bạn không có quyền chỉnh sửa dữ liệu nhắc thuốc trong room",
        HTTP_STATUS.FORBIDDEN
      );
    }
    const medicationId = Number(req.params.id);
    if (!medicationId || Number.isNaN(medicationId)) {
      return sendFail(res, "ID thuốc không hợp lệ", HTTP_STATUS.BAD_REQUEST);
    }
    const ok = await MedicationSystem.deleteMedication(context.hostUserId, context.roomId, medicationId);
    if (!ok) {
      return sendFail(res, "Không tìm thấy thuốc", HTTP_STATUS.NOT_FOUND);
    }
    return sendSuccess(res, { id: medicationId }, "Xóa thuốc thành công", HTTP_STATUS.OK);
  } catch (error) {
    console.error("Lỗi xóa thuốc:", error);
    return sendError(res, "Không thể xóa thuốc", HTTP_STATUS.INTERNAL_ERROR);
  }
};
