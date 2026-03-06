const { HTTP_STATUS, API_RESPONSE } = require("../config/constants");

// Phản hồi thành công
const sendSuccess = (res, data, message = "Thành công", statusCode = HTTP_STATUS.OK) => {
  return res.status(statusCode).json({
    status: API_RESPONSE.SUCCESS,
    message,
    data,
  });
};

// Phản hồi lỗi
const sendError = (res, message = "Lỗi", statusCode = HTTP_STATUS.BAD_REQUEST, error = null) => {
  return res.status(statusCode).json({
    status: API_RESPONSE.ERROR,
    message,
    error: error || null,
  });
};

// Phản hồi thất bại (khi dữ liệu không hợp lệ)
const sendFail = (res, message = "Xác thực dữ liệu thất bại", statusCode = HTTP_STATUS.BAD_REQUEST, errors = null) => {
  return res.status(statusCode).json({
    status: API_RESPONSE.FAIL,
    message,
    errors: errors || null,
  });
};

module.exports = {
  sendSuccess,
  sendError,
  sendFail,
};
