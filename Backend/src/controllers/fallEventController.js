const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const FallEvent = require("../models/FallEvent");
const LeftSafeZoneEvent = require("../models/LeftSafeZoneEvent");

/**
 * Tạo sự kiện té ngã: nhận ảnh (multipart) + camera_id, lưu ảnh vào uploads/fall, ghi bản ghi vào fall_events.
 * Camera Service gọi API này khi phát hiện té.
 */
exports.createFallEvent = async (req, res) => {
  try {
    if (!req.file || !req.file.filename) {
      return sendFail(
        res,
        "Vui lòng gửi ảnh (field 'image', JPG/PNG)",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const camera_id = req.body.camera_id != null ? parseInt(req.body.camera_id, 10) : null;
    if (camera_id == null || isNaN(camera_id) || camera_id < 1) {
      return sendFail(res, "camera_id là bắt buộc và phải là số nguyên dương", HTTP_STATUS.BAD_REQUEST);
    }

    const profile_id = req.body.profile_id != null && req.body.profile_id !== ""
      ? parseInt(req.body.profile_id, 10)
      : null;
    const severity_level = (req.body.severity_level || "high").toLowerCase();
    const note = req.body.note != null ? String(req.body.note).trim() : null;

    const image_url = "/uploads/fall/" + req.file.filename;

    const result = await FallEvent.create({
      camera_id,
      profile_id: isNaN(profile_id) ? null : profile_id,
      image_url,
      video_url: null,
      severity_level,
      note: note || null,
    });

    return sendSuccess(
      res,
      { id: result.insertId, image_url },
      "Đã lưu sự kiện té ngã và ảnh vào database.",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating fall event:", error);
    return sendError(
      res,
      "Lỗi khi lưu sự kiện té ngã",
      HTTP_STATUS.INTERNAL_ERROR,
      error.message
    );
  }
};

/**
 * Tạo sự kiện rời khỏi vùng an toàn → bảng left_safe_zone_events.
 */
exports.createLeftSafeZoneEvent = async (req, res) => {
  try {
    if (!req.file || !req.file.filename) {
      return sendFail(
        res,
        "Vui lòng gửi ảnh (field 'image', JPG/PNG)",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const camera_id =
      req.body.camera_id != null ? parseInt(req.body.camera_id, 10) : null;
    const zone_id =
      req.body.zone_id != null && req.body.zone_id !== ""
        ? parseInt(req.body.zone_id, 10)
        : null;
    const severity_level = (req.body.severity_level || "medium").toLowerCase();
    const image_url = "/uploads/fall/" + req.file.filename;

    const result = await LeftSafeZoneEvent.create({
      camera_id: isNaN(camera_id) ? null : camera_id,
      zone_id: isNaN(zone_id) ? null : zone_id,
      image_url,
      severity_level,
    });

    return sendSuccess(
      res,
      { id: result.insertId, image_url },
      "Đã lưu sự kiện rời khỏi vùng an toàn.",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating left safe zone event:", error);
    return sendError(
      res,
      "Lỗi khi lưu sự kiện rời khỏi vùng an toàn",
      HTTP_STATUS.INTERNAL_ERROR,
      error.message
    );
  }
};
