const pool = require("../config/database");

// Model HealthMetric - Quản lý các thao tác với bảng health_profiles
class HealthMetric {
  // Cập nhật chỉ số sức khỏe vào health_profiles (ghi đè lên dữ liệu cũ)
  static async create(metricData) {
    const connection = await pool.getConnection();
    try {
      const {
        profileId, // Thực sự là userId từ frontend
        metricType,
        valueNumeric,
        valueText,
        age,
        bloodType,
        chronicDiseases,
        allergies,
      } = metricData;

      // Bước 1: Tìm health_profiles.id từ user_id
      let [profiles] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? LIMIT 1",
        [profileId]
      );

      let actualProfileId;

      // Nếu chưa có, tự động tạo health_profiles mới
      if (!profiles || profiles.length === 0) {
        const [insertResult] = await connection.execute(
          "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, CONCAT('User ', ?))",
          [profileId, profileId]
        );
        actualProfileId = insertResult.insertId;
      } else {
        actualProfileId = profiles[0].id;
      }

      // Map metricType sang field trong health_profiles (tất cả đều snake_case)
      const metricMap = {
        blood_pressure: "blood_pressure",
        weight: "weight",
        height: "height",
        blood_type: "blood_type",
        age: "age",
        chronic_diseases: "chronic_diseases",
        allergies: "allergies",
        elderly_name: "elderly_name",
      };

      // Tìm field cần update từ metricType
      const fieldName = metricMap[metricType];

      if (!fieldName) {
        throw new Error(`Metric type không được hỗ trợ: ${metricType}`);
      }

      // Xác định giá trị cần update
      let updateValue = null;

      if (metricType === "age" && age !== null) {
        updateValue = age;
      } else if (metricType === "blood_type" && bloodType) {
        updateValue = bloodType;
      } else if (metricType === "chronic_diseases" && chronicDiseases) {
        updateValue = chronicDiseases;
      } else if (metricType === "allergies" && allergies) {
        updateValue = allergies;
      } else if (valueNumeric !== null && valueNumeric !== undefined) {
        updateValue = valueNumeric;
      } else if (valueText) {
        updateValue = valueText;
      }

      // Nếu không có giá trị, skip
      if (updateValue === null || updateValue === undefined) {
        return {
          insertId: actualProfileId,
          affectedRows: 0,
        };
      }

      // Xây dựng và chạy query UPDATE (dùng actual profile ID)
      const query = `UPDATE health_profiles SET ${fieldName} = ? WHERE id = ?`;
      const [result] = await connection.execute(query, [updateValue, actualProfileId]);

      return {
        insertId: actualProfileId,
        affectedRows: result.affectedRows,
      };
    } finally {
      connection.release();
    }
  }

  // Lấy chỉ số sức khỏe mới nhất theo profile ID (profileId thực sự là userId)
  static async getLatest(profileId, limit = 50, offset = 0) {
    // Trả về dữ liệu từ health_profiles
    const connection = await pool.getConnection();
    try {
      // Bước 1: Tìm health_profiles.id từ user_id
      let [profiles] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? LIMIT 1",
        [profileId]
      );

      let actualProfileId;

      // Nếu chưa có, tự động tạo
      if (!profiles || profiles.length === 0) {
        const [insertResult] = await connection.execute(
          "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, CONCAT('User ', ?))",
          [profileId, profileId]
        );
        actualProfileId = insertResult.insertId;
      } else {
        actualProfileId = profiles[0].id;
      }

      const limitNum = Number(limit) || 50;
      const offsetNum = Number(offset) || 0;
      const query =
        "SELECT id, age, weight, height, blood_type, blood_pressure, chronic_diseases, allergies " +
        `FROM health_profiles WHERE id = ? LIMIT ${limitNum} OFFSET ${offsetNum}`;
      const [rows] = await connection.execute(query, [actualProfileId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Cập nhật ảnh khuôn mặt (face_image_url) theo user_id - dùng cho nhận diện người cần giám sát
  static async updateFaceImageByUserId(userId, faceImageUrl) {
    const connection = await pool.getConnection();
    try {
      let [profiles] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? LIMIT 1",
        [userId]
      );
      if (!profiles || profiles.length === 0) {
        await connection.execute(
          "INSERT INTO health_profiles (user_id, elderly_name, face_image_url) VALUES (?, CONCAT('User ', ?), ?)",
          [userId, userId, faceImageUrl]
        );
        return { affectedRows: 1 };
      }
      const [result] = await connection.execute(
        "UPDATE health_profiles SET face_image_url = ? WHERE user_id = ?",
        [faceImageUrl, userId]
      );
      return { affectedRows: result.affectedRows };
    } finally {
      connection.release();
    }
  }

  // Lấy chỉ số sức khỏe theo loại và profile ID
  static async getByMetricType(profileId, metricType, limit = 50) {
    // Stub function - không sử dụng
    return [];
  }

  // Lấy chỉ số sức khỏe theo ID
  static async findById(id) {
    // Stub function - không sử dụng
    return null;
  }

  // Cập nhật chỉ số sức khỏe
  static async update(id, updateData) {
    // Stub function - không sử dụng
    return { affectedRows: 0 };
  }

  // Xóa chỉ số sức khỏe
  static async delete(id) {
    // Stub function - không sử dụng
    return { affectedRows: 0 };
  }

  // Lấy thống kê chỉ số sức khỏe (trung bình, min, max)
  static async getStatistics(profileId, metricType, days = 7) {
    // Stub function - không sử dụng
    return null;
  }

  // Lấy chỉ số sức khỏe gần nhất theo loại
  static async getLatestByMetricType(profileId, metricType) {
    // Stub function - không sử dụng
    return null;
  }

  // Lấy tất cả chỉ số gần nhất
  static async getLatestAllMetrics(profileId) {
    // Stub function - không sử dụng
    return [];
  }

  // Đếm số lượng chỉ số sức khỏe theo profile (profileId thực sự là userId)
  static async countByProfileId(profileId) {
    const connection = await pool.getConnection();
    try {
      // Tìm hoặc tạo health_profiles
      let [profiles] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? LIMIT 1",
        [profileId]
      );

      let actualProfileId;

      if (!profiles || profiles.length === 0) {
        const [insertResult] = await connection.execute(
          "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, CONCAT('User ', ?))",
          [profileId, profileId]
        );
        actualProfileId = insertResult.insertId;
      } else {
        actualProfileId = profiles[0].id;
      }

      const query = "SELECT COUNT(*) as count FROM health_profiles WHERE id = ?";
      const [rows] = await connection.execute(query, [actualProfileId]);
      return rows[0]?.count || 0;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả chỉ số sức khỏe theo profile ID (profileId thực sự là userId)
  static async getByProfileId(profileId, limit = 100, offset = 0) {
    const connection = await pool.getConnection();
    try {
      // Bước 1: Tìm health_profiles.id từ user_id
      let [profiles] = await connection.execute(
        "SELECT id FROM health_profiles WHERE user_id = ? LIMIT 1",
        [profileId]
      );

      let actualProfileId;

      // Nếu chưa có, tự động tạo
      if (!profiles || profiles.length === 0) {
        const [insertResult] = await connection.execute(
          "INSERT INTO health_profiles (user_id, elderly_name) VALUES (?, CONCAT('User ', ?))",
          [profileId, profileId]
        );
        actualProfileId = insertResult.insertId;
      } else {
        actualProfileId = profiles[0].id;
      }

      const limitNum = Number(limit) || 100;
      const offsetNum = Number(offset) || 0;
      const query =
        "SELECT id, user_id, elderly_name, face_image_url, age, weight, height, blood_type, blood_pressure, chronic_diseases, allergies " +
        `FROM health_profiles WHERE id = ? LIMIT ${limitNum} OFFSET ${offsetNum}`;
      const [rows] = await connection.execute(query, [actualProfileId]);
      return rows;
    } finally {
      connection.release();
    }
  }

  // Lấy tất cả các loại metric có sẵn
  static async getAvailableMetricTypes() {
    // Trả về danh sách hỗ trợ
    return [
      { metric_type: "age" },
      { metric_type: "weight" },
      { metric_type: "height" },
      { metric_type: "blood_type" },
      { metric_type: "blood_pressure" },
      { metric_type: "chronic_diseases" },
      { metric_type: "allergies" },
    ];
  }
}

module.exports = HealthMetric;
