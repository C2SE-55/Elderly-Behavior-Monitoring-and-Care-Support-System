const jwt = require("jsonwebtoken");
const { JWT_SECRET, HTTP_STATUS } = require("../config/constants");
const { sendError } = require("../utils/response");

// Xác minh JWT Token
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return sendError(res, "Không có token", HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return sendError(res, "Token không hợp lệ", HTTP_STATUS.UNAUTHORIZED);
  }
};

// Kiểm tra quyền hạn người dùng
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.userRole)) {
      return sendError(res, "Truy cập bị từ chối", HTTP_STATUS.FORBIDDEN);
    }
    next();
  };
};

module.exports = {
  verifyToken,
  checkRole,
};
