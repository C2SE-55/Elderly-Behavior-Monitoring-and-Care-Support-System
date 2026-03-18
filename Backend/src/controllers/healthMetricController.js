const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const HealthMetric = require("../models/HealthMetric");
const { isEmptyField } = require("../utils/validators");

// Tạo / cập nhật chỉ số sức khỏe (ghi vào bảng health_profiles)
exports.createMetric = async (req, res) => {
  try {
    const {
      profileId,
      metricType: rawMetricType,
      valueNumeric,
      valueText,
      age,
      bloodType,
      chronicDiseases,
      allergies,
    } = req.body;

    // Chuẩn hóa metricType (string, trim) để tránh lỗi khi FE gửi kiểu khác
    const metricType =
      rawMetricType != null && rawMetricType !== ""
        ? String(rawMetricType).trim()
        : "";

    // 1. Kiểm tra trường bắt buộc
    if (!profileId) {
      return sendFail(res, "Profile ID là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }
    if (!metricType) {
      return sendFail(res, "Loại chỉ số sức khỏe là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // 2. Kiểm tra loại chỉ số hợp lệ
    const validMetricTypes = [
      "heart_rate",
      "blood_pressure",
      "temperature",
      "blood_sugar",
      "oxygen_saturation",
      "weight",
      "height",
      "steps",
      "calories_burned",
      "sleep_quality",
      "blood_oxygen",
      "heart_rate_variability",
      "age",
      "blood_type",
      "chronic_diseases",
      "allergies",
      "elderly_name",
    ];

    if (!validMetricTypes.includes(metricType)) {
      return sendFail(
        res,
        `Loại chỉ số không hợp lệ: '${metricType}'. Được hỗ trợ: ${validMetricTypes.join(", ")}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // 3. Ràng buộc business cho một số loại chỉ số
    if (metricType === "age" && age != null) {
      const ageNum = Number(age);
      if (Number.isNaN(ageNum) || ageNum <= 10 || ageNum >= 150) {
        return sendFail(
          res,
          "Tuổi phải lớn hơn 10 và nhỏ hơn 150",
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    if (metricType === "blood_pressure" && valueNumeric != null) {
      const bpNum = Number(valueNumeric);
      if (Number.isNaN(bpNum) || bpNum < 50 || bpNum > 250) {
        return sendFail(
          res,
          "Huyết áp phải nằm trong khoảng 50–250 mmHg",
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    if (metricType === "blood_type" && bloodType) {
      const allowedBloodTypes = [
        "A+",
        "A-",
        "B+",
        "B-",
        "AB+",
        "AB-",
        "O+",
        "O-",
        "Rh-null",
      ];
      if (!allowedBloodTypes.includes(bloodType)) {
        return sendFail(
          res,
          `Nhóm máu không hợp lệ. Hỗ trợ: ${allowedBloodTypes.join(", ")}`,
          HTTP_STATUS.BAD_REQUEST
        );
      }
    }

    // 4. Chuẩn bị dữ liệu ghi xuống model
    const metricData = {
      profileId,
      metricType,
      valueNumeric: valueNumeric ?? null,
      valueText: valueText ?? null,
      age: age ?? null,
      bloodType: bloodType ?? null,
      chronicDiseases: chronicDiseases ?? null,
      allergies: allergies ?? null,
    };

    const result = await HealthMetric.create(metricData);

    // 5. Trả về kết quả thành công với đúng format sendSuccess(data, message, status)
    return sendSuccess(
      res,
      {
        id: result.insertId,
        ...metricData,
      },
      "Cập nhật chỉ số sức khỏe thành công",
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating health metric:", error);
    return sendError(
      res,
      "Lỗi khi cập nhật chỉ số sức khỏe",
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
};

// Lấy tất cả chỉ số sức khỏe theo profile ID
exports.getMetricsByProfile = async (req, res) => {
  try {
    const { profileId } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    if (isEmptyField(profileId)) {
      return sendFail(res, "Profile ID là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const metrics = await HealthMetric.getByProfileId(
      profileId,
      parseInt(limit),
      parseInt(offset)
    );

    const count = await HealthMetric.countByProfileId(profileId);

    return sendSuccess(
      res,
      {
        data: metrics,
        pagination: {
          total: count,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < count,
        },
      },
      "Lấy danh sách chỉ số sức khỏe thành công"
    );
  } catch (error) {
    console.error("Error fetching health metrics:", error);
    return sendError(res, "Lỗi khi lấy chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy chỉ số theo loại (metric type)
exports.getMetricsByType = async (req, res) => {
  try {
    const { profileId, metricType } = req.params;
    const { limit = 50 } = req.query;

    if (isEmptyField(profileId) || isEmptyField(metricType)) {
      return sendFail(res, "Profile ID và loại chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const metrics = await HealthMetric.getByMetricType(profileId, metricType, parseInt(limit));

    return sendSuccess(res, "Lấy chỉ số sức khỏe theo loại thành công", {
      metricType,
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching metrics by type:", error);
    return sendError(res, "Lỗi khi lấy chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy chỉ số gần nhất theo loại
exports.getLatestMetricByType = async (req, res) => {
  try {
    const { profileId, metricType } = req.params;

    if (isEmptyField(profileId) || isEmptyField(metricType)) {
      return sendFail(res, "Profile ID và loại chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const metric = await HealthMetric.getLatestByMetricType(profileId, metricType);

    if (!metric) {
      return sendFail(res, "Không tìm thấy chỉ số sức khỏe", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, "Lấy chỉ số gần nhất thành công", metric);
  } catch (error) {
    console.error("Error fetching latest metric:", error);
    return sendError(res, "Lỗi khi lấy chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Danh sách ảnh khuôn mặt tham chiếu (cho Camera Service nhận diện người cần giám sát)
exports.getFaceReferences = async (req, res) => {
  try {
    const pool = require("../config/database");
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        "SELECT id, user_id, elderly_name, face_image_url FROM health_profiles WHERE face_image_url IS NOT NULL AND TRIM(face_image_url) != ''"
      );
      const baseUrl = process.env.BACKEND_URL || (req.protocol + "://" + req.get("host") || "http://localhost:5000");
      const data = (rows || []).map((r) => ({
        id: r.id,
        user_id: r.user_id,
        elderly_name: r.elderly_name || "",
        face_image_url: r.face_image_url,
        image_full_url: baseUrl.replace(/\/$/, "") + (r.face_image_url.startsWith("/") ? r.face_image_url : "/" + r.face_image_url),
      }));
      return sendSuccess(res, { data, count: data.length }, "Lấy danh sách ảnh tham chiếu thành công");
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching face references:", error);
    return sendError(res, "Lỗi khi lấy danh sách ảnh tham chiếu", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy tất cả chỉ số gần nhất (từ health_profiles)
exports.getAllLatestMetrics = async (req, res) => {
  try {
    const { profileId } = req.params; // Thực sự là userId

    if (!profileId) {
      return sendFail(res, "Profile ID là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Lấy dữ liệu từ health_profiles table dùng user_id (profileId thực sự là userId)
    const pool = require("../config/database");
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.execute(
        "SELECT id, elderly_name, face_image_url, age, weight, height, blood_type, blood_pressure, chronic_diseases, allergies FROM health_profiles WHERE user_id = ?",
        [profileId]
      );

      if (!rows || rows.length === 0) {
        return sendFail(res, "Không tìm thấy hồ sơ sức khỏe", HTTP_STATUS.NOT_FOUND);
      }

      const profile = rows[0];
      const metrics = [];

      // Convert thành format metric (elderly_name cho meal plan / cá nhân hóa)
      if (profile.elderly_name) metrics.push({ metric_type: "elderly_name", value_text: profile.elderly_name });
      if (profile.age) metrics.push({ metric_type: "age", value_numeric: profile.age });
      if (profile.weight) metrics.push({ metric_type: "weight", value_numeric: profile.weight });
      if (profile.height) metrics.push({ metric_type: "height", value_numeric: profile.height });
      if (profile.blood_type) metrics.push({ metric_type: "blood_type", value_text: profile.blood_type });
      if (profile.blood_pressure) metrics.push({ metric_type: "blood_pressure", value_numeric: profile.blood_pressure });
      if (profile.chronic_diseases) metrics.push({ metric_type: "chronic_diseases", value_text: profile.chronic_diseases });
      if (profile.allergies) metrics.push({ metric_type: "allergies", value_text: profile.allergies });

      return sendSuccess(res, "Lấy tất cả chỉ số gần nhất thành công", {
        data: metrics,
        count: metrics.length,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching all latest metrics:", error);
    return sendError(res, "Lỗi khi lấy chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy thống kê chỉ số sức khỏe
exports.getMetricStatistics = async (req, res) => {
  try {
    const { profileId, metricType } = req.params;
    const { days = 7 } = req.query;

    if (isEmptyField(profileId) || isEmptyField(metricType)) {
      return sendFail(res, "Profile ID và loại chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const statistics = await HealthMetric.getStatistics(profileId, metricType, parseInt(days));

    if (!statistics) {
      return sendFail(res, "Không tìm thấy dữ liệu thống kê", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, "Lấy thống kê chỉ số thành công", {
      ...statistics,
      period: `${days} ngày`
    });
  } catch (error) {
    console.error("Error fetching metric statistics:", error);
    return sendError(res, "Lỗi khi lấy thống kê chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Cập nhật chỉ số sức khỏe
exports.updateMetric = async (req, res) => {
  try {
    const { id } = req.params;
    const { valueNumeric, valueText, unit, status, notes } = req.body;

    if (isEmptyField(id)) {
      return sendFail(res, "ID chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra chỉ số tồn tại
    const existingMetric = await HealthMetric.findById(id);
    if (!existingMetric) {
      return sendFail(res, "Chỉ số sức khỏe không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    // Kiểm tra status hợp lệ
    if (status && !["normal", "warning", "critical"].includes(status)) {
      return sendFail(res, "Status phải là: normal, warning hoặc critical", HTTP_STATUS.BAD_REQUEST);
    }

    const updateData = {
      valueNumeric: valueNumeric !== undefined ? valueNumeric : existingMetric.value_numeric,
      valueText: valueText !== undefined ? valueText : existingMetric.value_text,
      unit: unit !== undefined ? unit : existingMetric.unit,
      status: status || existingMetric.status,
      notes: notes !== undefined ? notes : existingMetric.notes,
    };

    await HealthMetric.update(id, updateData);

    return sendSuccess(res, "Cập nhật chỉ số sức khỏe thành công", {
      id,
      ...updateData,
    });
  } catch (error) {
    console.error("Error updating health metric:", error);
    return sendError(res, "Lỗi khi cập nhật chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Xóa chỉ số sức khỏe
exports.deleteMetric = async (req, res) => {
  try {
    const { id } = req.params;

    if (isEmptyField(id)) {
      return sendFail(res, "ID chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra chỉ số tồn tại
    const existingMetric = await HealthMetric.findById(id);
    if (!existingMetric) {
      return sendFail(res, "Chỉ số sức khỏe không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    await HealthMetric.delete(id);

    return sendSuccess(res, "Xóa chỉ số sức khỏe thành công", { id });
  } catch (error) {
    console.error("Error deleting health metric:", error);
    return sendError(res, "Lỗi khi xóa chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Lấy chi tiết một chỉ số
exports.getMetricById = async (req, res) => {
  try {
    const { id } = req.params;

    if (isEmptyField(id)) {
      return sendFail(res, "ID chỉ số là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const metric = await HealthMetric.findById(id);

    if (!metric) {
      return sendFail(res, "Chỉ số sức khỏe không tồn tại", HTTP_STATUS.NOT_FOUND);
    }

    return sendSuccess(res, "Lấy chi tiết chỉ số thành công", metric);
  } catch (error) {
    console.error("Error fetching metric by id:", error);
    return sendError(res, "Lỗi khi lấy chi tiết chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
  }
};

// Upload ảnh khuôn mặt (đại diện) — lưu vào health_profiles.face_image_url để dùng cho nhận diện người cần giám sát
exports.uploadFaceImage = async (req, res) => {
  try {
    const { profileId } = req.params; // Thực chất là user_id từ frontend
    const userId = req.userId; // Từ JWT

    if (!profileId || Number(profileId) !== Number(userId)) {
      return sendFail(
        res,
        "Chỉ được cập nhật ảnh đại diện của chính mình",
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (!req.file || !req.file.filename) {
      return sendFail(
        res,
        "Vui lòng chọn ảnh (định dạng jpg, png)",
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // URL tương đối để client ghép với API_BASE_URL (vd: /uploads/face/123_xxx.jpg)
    const faceImageUrl = "/uploads/face/" + req.file.filename;
    await HealthMetric.updateFaceImageByUserId(profileId, faceImageUrl);

    return sendSuccess(
      res,
      { face_image_url: faceImageUrl },
      "Lưu ảnh đại diện thành công. Ảnh sẽ được dùng để nhận diện khi quét khuôn mặt.",
      HTTP_STATUS.OK
    );
  } catch (error) {
    console.error("Error uploading face image:", error);
    return sendError(
      res,
      "Lỗi khi lưu ảnh đại diện",
      HTTP_STATUS.INTERNAL_ERROR
    );
  }
};

// Lấy danh sách các loại metric có sẵn
exports.getAvailableMetricTypes = async (req, res) => {
  try {
    const metricTypes = [
      {
        key: "heart_rate",
        name: "Nhịp tim",
        unit: "bpm",
        normalRange: "60-100",
      },
      {
        key: "blood_pressure",
        name: "Huyết áp",
        unit: "mmHg",
        normalRange: "< 120/80",
      },
      {
        key: "temperature",
        name: "Nhiệt độ",
        unit: "°C",
        normalRange: "36.5-37.5",
      },
      {
        key: "blood_sugar",
        name: "Đường huyết",
        unit: "mg/dL",
        normalRange: "70-100 (empty stomach)",
      },
      {
        key: "oxygen_saturation",
        name: "Nồng độ oxy",
        unit: "%",
        normalRange: ">= 95",
      },
      {
        key: "weight",
        name: "Cân nặng",
        unit: "kg",
        normalRange: "varies",
      },
      {
        key: "steps",
        name: "Số bước đi",
        unit: "steps",
        normalRange: "> 5000",
      },
      {
        key: "calories_burned",
        name: "Calo tiêu thụ",
        unit: "kcal",
        normalRange: "varies",
      },
      {
        key: "sleep_quality",
        name: "Chất lượng giấc ngủ",
        unit: "score (1-5)",
        normalRange: ">= 3",
      },
      {
        key: "blood_oxygen",
        name: "SpO2",
        unit: "%",
        normalRange: ">= 95",
      },
      {
        key: "heart_rate_variability",
        name: "Biến động nhịp tim",
        unit: "ms",
        normalRange: "20-200",
      },
    ];

    return sendSuccess(res, "Lấy danh sách loại chỉ số thành công", {
      data: metricTypes,
      count: metricTypes.length,
    });
  } catch (error) {
    console.error("Error fetching available metric types:", error);
    return sendError(res, "Lỗi khi lấy danh sách loại chỉ số", HTTP_STATUS.INTERNAL_ERROR);
  }
};
