// Các hằng số sử dụng trong ứng dụng
module.exports = {
  // Mã trạng thái HTTP
  HTTP_STATUS: {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
  },
  // Loại phản hồi API
  API_RESPONSE: {
    SUCCESS: "success",
    ERROR: "error",
    FAIL: "fail",
  },
  JWT_SECRET: process.env.JWT_SECRET || "your_jwt_secret_key",
  JWT_EXPIRE: process.env.JWT_EXPIRE || "7d",
};
