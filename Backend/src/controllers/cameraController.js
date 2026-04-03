const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError } = require("../utils/response");
const { resolveAccessContext } = require("../services/accessControl");
const { Camera } = require("../models/Camera");

/**
 * GET /api/cameras/live-access
 * Header x-room-id hoặc query room_id — user phải là thành viên room và có can_view_live (host luôn được).
 */
exports.getLiveAccess = async (req, res) => {
  try {
    const context = await resolveAccessContext(req, req.userId);
    // Trả 200 + allowed:false để axios không ném lỗi; UI tự hiển thị thông báo
    if (!context.roomId || !context.canReadRoomData) {
      return sendSuccess(
        res,
        {
          allowed: false,
          reason: "not_in_room",
          room_id: context.roomId || null,
          asset_key: null,
          camera_id: null,
        },
        "Bạn không có quyền truy cập camera trong room này",
        HTTP_STATUS.OK
      );
    }
    if (!context.canViewLive) {
      return sendSuccess(
        res,
        {
          allowed: false,
          reason: "host_disabled",
          room_id: context.roomId,
          asset_key: null,
          camera_id: null,
        },
        "Host đã tắt quyền xem camera trực tiếp cho tài khoản của bạn",
        HTTP_STATUS.OK
      );
    }

    const row = await Camera.findActiveByRoomId(context.roomId);
    const assetKey = Camera.resolveAssetKey(row, context.roomId);

    return sendSuccess(
      res,
      {
        allowed: true,
        room_id: context.roomId,
        camera_id: row?.id ?? null,
        asset_key: assetKey,
      },
      "OK",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Lỗi live-access camera:", error);
    return sendError(res, "Không lấy được cấu hình camera", HTTP_STATUS.INTERNAL_ERROR);
  }
};
