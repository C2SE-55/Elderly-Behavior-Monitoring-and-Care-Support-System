const { sendError } = require("../utils/response");
const { HTTP_STATUS } = require("../config/constants");

// Middleware xử lý lỗi
const errorHandler = (err, req, res, next) => {
  console.error("Lỗi server:", err);

  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const message = err.message || "Lỗi máy chủ nội bộ";

  return sendError(res, message, statusCode);
};

module.exports = errorHandler;
