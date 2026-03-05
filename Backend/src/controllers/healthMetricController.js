const { HTTP_STATUS } = require("../config/constants");
const { sendSuccess, sendError, sendFail } = require("../utils/response");
const HealthMetric = require("../models/HealthMetric");
const { isEmptyField } = require("../utils/validators");

// Tạo chỉ số sức khỏe mới
exports.createMetric = async (req, res) => {
  try {
    const { profileId, metricType, valueNumeric, valueText, unit, status, notes } = req.body;
    const userId = req.user?.id; // Lấy từ JWT token

    // Xác thực dữ liệu đầu vào
    if (isEmptyField(profileId) || isEmptyField(metricType)) {
      return sendFail(res, "Profile ID và loại chỉ số sức khỏe là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra metricType hợp lệ
    const validMetricTypes = [
      "heart_rate",
      "blood_pressure",
      "temperature",
      "blood_sugar",
      "oxygen_saturation",
      "weight",
      "steps",
      "calories_burned",
      "sleep_quality",
      "blood_oxygen",
      "heart_rate_variability",
    ];

    if (!validMetricTypes.includes(metricType)) {
      return sendFail(
        res,
        `Loại chỉ số không hợp lệ. Được hỗ trợ: ${validMetricTypes.join(", ")}`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    // Kiểm tra status hợp lệ
    if (status && !["normal", "warning", "critical"].includes(status)) {
      return sendFail(res, "Status phải là: normal, warning hoặc critical", HTTP_STATUS.BAD_REQUEST);
    }

    // Kiểm tra ít nhất một trong valueNumeric hoặc valueText
    if (!valueNumeric && !valueText) {
      return sendFail(res, "Phải cung cấp giá trị số hoặc văn bản", HTTP_STATUS.BAD_REQUEST);
    }

    const metricData = {
      profileId,
      metricType,
      valueNumeric: valueNumeric || null,
      valueText: valueText || null,
      unit: unit || null,
      status: status || "normal",
      notes: notes || null,
      recordedBy: userId || null,
    };

    const result = await HealthMetric.create(metricData);

    return sendSuccess(
      res,
      "Tạo chỉ số sức khỏe thành công",
      {
        id: result.insertId,
        ...metricData,
      },
      HTTP_STATUS.CREATED
    );
  } catch (error) {
    console.error("Error creating health metric:", error);
    return sendError(res, "Lỗi khi tạo chỉ số sức khỏe", HTTP_STATUS.INTERNAL_ERROR);
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

    return sendSuccess(res, "Lấy danh sách chỉ số sức khỏe thành công", {
      data: metrics,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < count,
      },
    });
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

// Lấy tất cả chỉ số gần nhất (tất cả loại)
exports.getAllLatestMetrics = async (req, res) => {
  try {
    const { profileId } = req.params;

    if (isEmptyField(profileId)) {
      return sendFail(res, "Profile ID là bắt buộc", HTTP_STATUS.BAD_REQUEST);
    }

    const metrics = await HealthMetric.getLatestAllMetrics(profileId);

    return sendSuccess(res, "Lấy tất cả chỉ số gần nhất thành công", {
      data: metrics,
      count: metrics.length,
    });
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
