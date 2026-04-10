const axios = require("axios");
const AUTOMATIC_PRESCRIPTION_BASE_URL = (
  process.env.AUTOMATIC_PRESCRIPTION_URL || "http://localhost:6000"
).replace(/\/$/, "");

const buildFailResponse = (message) => ({
  status: "fail",
  message,
  medicines: [],
  summary: {
    total_detected: 0,
    high_confidence_count: 0,
  },
});

const extractMedicationsFromImage = async (buffer, mimeType = "image/jpeg") => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return buildFailResponse("Không nhận được dữ liệu ảnh hợp lệ.");
  }

  const imageBase64 = buffer.toString("base64");
  try {
    const response = await axios.post(
      `${AUTOMATIC_PRESCRIPTION_BASE_URL}/extract-medicines`,
      {
        image_base64: imageBase64,
        mime_type: mimeType || "image/jpeg",
      },
      {
        timeout: 45000,
        headers: { "Content-Type": "application/json" },
      }
    );
    const data = response?.data;
    if (!data || typeof data !== "object") {
      return buildFailResponse("Automatic prescription service trả dữ liệu không hợp lệ.");
    }
    return data;
  } catch (error) {
    const status = Number(error?.response?.status || 0);
    const detail =
      error?.response?.data?.detail ||
      error?.response?.data?.message ||
      error?.message ||
      "";
    const msg =
      status === 401 || status === 403
        ? "Automatic prescription service từ chối yêu cầu."
        : status === 429
          ? "Automatic prescription service đang giới hạn tần suất."
          : "Không thể kết nối automatic prescription service.";
    return buildFailResponse(detail ? `${msg} ${String(detail).trim()}` : msg);
  }
};

module.exports = {
  extractMedicationsFromImage,
};
